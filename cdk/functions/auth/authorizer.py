"""
Lambda Authorizer for Role-Based Access Control
Validates JWT tokens and enforces fine-grained permissions
"""
import json
import jwt
import requests
import os
from typing import Dict, Any, List, Optional
from functools import lru_cache


# Environment variables
USER_POOL_ID = os.environ["USER_POOL_ID"]
REGION = os.environ.get("AWS_REGION", "eu-central-1")
JWKS_URL = f"https://cognito-idp.{REGION}.amazonaws.com/{USER_POOL_ID}/.well-known/jwks.json"

# Role hierarchy (higher number = more permissions)
ROLE_HIERARCHY = {
    "guest": 1,
    "support": 2, 
    "admin": 3,
    "super_admin": 4,
    "owner": 5
}

# Permission definitions
PERMISSIONS = {
    # DynamoDB permissions
    "dynamodb:read": ["support", "admin", "super_admin", "owner"],
    "dynamodb:write": ["admin", "super_admin", "owner"],
    "dynamodb:delete": ["super_admin", "owner"],

    # S3 permissions
    "s3:read": ["support", "admin", "super_admin", "owner"],
    "s3:write": ["super_admin", "owner"],
    "s3:delete": ["super_admin", "owner"],  # Both owner and super_admin

    # User management permissions - ADMIN REMOVED
    "users:read": ["super_admin", "owner"],
    "users:write": ["super_admin", "owner"],
    "users:delete": ["super_admin", "owner"],
    "users:change_roles": ["super_admin", "owner"],  # Super admin and owner can change roles

    # System permissions
    "system:config": ["super_admin", "owner"],
    "system:logs": ["support", "admin", "super_admin", "owner"],
    
    # Guest permissions (own data only)
    "guest:own_data": ["guest", "support", "admin", "super_admin", "owner"],
}


@lru_cache(maxsize=1)
def get_jwks():
    """Get JWKS from Cognito (cached)"""
    try:
        response = requests.get(JWKS_URL, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error fetching JWKS: {e}")
        raise


def get_public_key(token_header):
    """Get public key for token verification"""
    jwks = get_jwks()
    
    for key in jwks["keys"]:
        if key["kid"] == token_header["kid"]:
            return jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key))
    
    raise ValueError("Public key not found")


def verify_token(token: str) -> Dict[str, Any]:
    """Verify and decode JWT token"""
    try:
        # Decode header to get key ID
        header = jwt.get_unverified_header(token)
        
        # Get public key
        public_key = get_public_key(header)
        
        # Verify and decode token
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=os.environ.get("USER_POOL_CLIENT_ID"),
            issuer=f"https://cognito-idp.{REGION}.amazonaws.com/{USER_POOL_ID}"
        )
        
        return payload
        
    except jwt.ExpiredSignatureError:
        raise ValueError("Token has expired")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Invalid token: {e}")


def get_user_role(token_payload: Dict[str, Any]) -> str:
    """Extract user role from token payload"""
    # Check for Cognito groups
    groups = token_payload.get("cognito:groups", [])
    
    if not groups:
        return "guest"  # Default role
    
    # Return highest priority role
    user_roles = [role for role in groups if role in ROLE_HIERARCHY]
    if not user_roles:
        return "guest"
    
    return max(user_roles, key=lambda x: ROLE_HIERARCHY[x])


def has_permission(user_role: str, required_permission: str) -> bool:
    """Check if user role has required permission"""
    allowed_roles = PERMISSIONS.get(required_permission, [])
    return user_role in allowed_roles


def get_required_permission(method: str, resource: str) -> Optional[str]:
    """Determine required permission based on HTTP method and resource"""
    
    # DynamoDB operations
    if "dynamodb" in resource.lower():
        if method in ["GET"]:
            return "dynamodb:read"
        elif method in ["POST", "PUT", "PATCH"]:
            return "dynamodb:write"
        elif method in ["DELETE"]:
            return "dynamodb:delete"
    
    # S3 operations
    elif "s3" in resource.lower() or "upload" in resource.lower():
        if method in ["GET"]:
            return "s3:read"
        elif method in ["POST", "PUT"]:
            return "s3:write"
        elif method in ["DELETE"]:
            return "s3:delete"
    
    # User management
    elif "user" in resource.lower():
        if method in ["GET"]:
            return "users:read"
        elif method in ["POST", "PUT", "PATCH"]:
            return "users:write"
        elif method in ["DELETE"]:
            return "users:delete"
    
    # System operations
    elif "admin" in resource.lower() or "system" in resource.lower():
        return "system:config"
    
    # Default to guest permissions for public endpoints
    return "guest:own_data"


def generate_policy(effect: str, resource: str, user_id: str, user_role: str) -> Dict[str, Any]:
    """Generate IAM policy for API Gateway"""
    return {
        "principalId": user_id,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "execute-api:Invoke",
                    "Effect": effect,
                    "Resource": resource
                }
            ]
        },
        "context": {
            "userId": user_id,
            "userRole": user_role,
            "permissions": json.dumps([
                perm for perm, roles in PERMISSIONS.items() 
                if user_role in roles
            ])
        }
    }


def handler(event, context):
    """Lambda authorizer handler"""
    try:
        # Extract token from Authorization header
        token = event["authorizationToken"]
        if not token:
            raise ValueError("No authorization token provided")
        
        # Remove 'Bearer ' prefix if present
        if token.startswith("Bearer "):
            token = token[7:]
        
        # Verify token
        payload = verify_token(token)
        
        # Extract user information
        user_id = payload.get("sub")
        user_email = payload.get("email")
        user_role = get_user_role(payload)
        
        print(f"Authorizing user {user_email} with role {user_role}")
        
        # Get required permission for this request
        method_arn = event["methodArn"]
        method = event.get("httpMethod", "GET")
        resource = event.get("resource", "")
        
        required_permission = get_required_permission(method, resource)
        
        # Check if user has required permission
        if required_permission and has_permission(user_role, required_permission):
            print(f"Access granted: {user_role} has {required_permission}")
            return generate_policy("Allow", method_arn, user_id, user_role)
        else:
            print(f"Access denied: {user_role} lacks {required_permission}")
            return generate_policy("Deny", method_arn, user_id, user_role)
    
    except Exception as e:
        print(f"Authorization error: {e}")
        # Return deny policy for any errors
        return generate_policy("Deny", event.get("methodArn", "*"), "unknown", "guest")


def check_user_permission(user_role: str, permission: str) -> bool:
    """Utility function to check permissions in Lambda functions"""
    return has_permission(user_role, permission)


def require_permission(permission: str):
    """Decorator to require specific permission"""
    def decorator(func):
        def wrapper(event, context):
            # Extract user role from authorizer context
            user_role = event.get("requestContext", {}).get("authorizer", {}).get("userRole", "guest")
            
            if not has_permission(user_role, permission):
                return {
                    "statusCode": 403,
                    "headers": {
                        "Access-Control-Allow-Origin": "*",
                        "Content-Type": "application/json"
                    },
                    "body": json.dumps({
                        "success": False,
                        "message": f"Insufficient permissions. Required: {permission}",
                        "errorCode": "INSUFFICIENT_PERMISSIONS"
                    })
                }
            
            return func(event, context)
        return wrapper
    return decorator


def get_user_context(event) -> Dict[str, Any]:
    """Extract user context from API Gateway event"""
    authorizer = event.get("requestContext", {}).get("authorizer", {})
    
    return {
        "user_id": authorizer.get("userId"),
        "user_role": authorizer.get("userRole", "guest"),
        "permissions": json.loads(authorizer.get("permissions", "[]"))
    }
