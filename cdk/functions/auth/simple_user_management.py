"""
Simple User Management Lambda Function
Simplified version that works with existing infrastructure
"""
import json
import boto3
import os
from typing import Dict, Any, List, Optional
from botocore.exceptions import ClientError


# AWS clients
cognito_client = boto3.client("cognito-idp")
USER_POOL_ID = os.environ.get("USER_POOL_ID", "")

# CORS headers
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Content-Type": "application/json"
}


def create_response(status_code: int, success: bool, message: str, data: Any = None, error_code: str = None) -> Dict[str, Any]:
    """Create standardized API response"""
    response_body = {
        "success": success,
        "message": message
    }
    
    if data is not None:
        response_body["data"] = data
    
    if error_code:
        response_body["errorCode"] = error_code
    
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(response_body)
    }


def check_permission(event, required_permission: str) -> bool:
    """Check if user has required permission"""
    user_role = event.get("requestContext", {}).get("authorizer", {}).get("userRole", "guest")
    
    # Simple permission check
    permissions = {
        "users:read": ["super_admin", "owner"],
        "users:write": ["super_admin", "owner"],
        "users:change_roles": ["super_admin", "owner"]
    }
    
    allowed_roles = permissions.get(required_permission, [])
    return user_role in allowed_roles


def list_users(event, context):
    """List all users with their roles"""
    try:
        if not check_permission(event, "users:read"):
            return create_response(403, False, "Insufficient permissions", error_code="INSUFFICIENT_PERMISSIONS")
        
        # Get pagination parameters
        query_params = event.get("queryStringParameters") or {}
        limit = int(query_params.get("limit", 50))
        next_token = query_params.get("nextToken")
        
        # List users from Cognito
        list_params = {
            "UserPoolId": USER_POOL_ID,
            "Limit": min(limit, 60)  # Cognito max is 60
        }
        
        if next_token:
            list_params["PaginationToken"] = next_token
        
        response = cognito_client.list_users(**list_params)
        
        # Format user data
        users = []
        for user in response["Users"]:
            user_data = {
                "userId": user["Username"],
                "email": next((attr["Value"] for attr in user["Attributes"] if attr["Name"] == "email"), None),
                "status": user["UserStatus"],
                "enabled": user["Enabled"],
                "createdDate": user["UserCreateDate"].isoformat(),
                "lastModifiedDate": user["UserLastModifiedDate"].isoformat(),
                "groups": []
            }
            
            # Get user groups
            try:
                groups_response = cognito_client.admin_list_groups_for_user(
                    UserPoolId=USER_POOL_ID,
                    Username=user["Username"]
                )
                user_data["groups"] = [group["GroupName"] for group in groups_response["Groups"]]
            except ClientError:
                pass  # User might not be in any groups
            
            users.append(user_data)
        
        result = {
            "users": users,
            "count": len(users)
        }
        
        if "PaginationToken" in response:
            result["nextToken"] = response["PaginationToken"]
        
        return create_response(200, True, "Users retrieved successfully", result)
        
    except Exception as e:
        print(f"Error listing users: {e}")
        return create_response(500, False, "Failed to list users", error_code="INTERNAL_ERROR")


def get_user(event, context):
    """Get specific user details"""
    try:
        if not check_permission(event, "users:read"):
            return create_response(403, False, "Insufficient permissions", error_code="INSUFFICIENT_PERMISSIONS")
        
        user_id = event["pathParameters"]["userId"]
        
        # Get user from Cognito
        user_response = cognito_client.admin_get_user(
            UserPoolId=USER_POOL_ID,
            Username=user_id
        )
        
        # Format user data
        user_data = {
            "userId": user_response["Username"],
            "status": user_response["UserStatus"],
            "enabled": user_response["Enabled"],
            "createdDate": user_response["UserCreateDate"].isoformat(),
            "lastModifiedDate": user_response["UserLastModifiedDate"].isoformat(),
            "attributes": {attr["Name"]: attr["Value"] for attr in user_response["UserAttributes"]},
            "groups": []
        }
        
        # Get user groups
        try:
            groups_response = cognito_client.admin_list_groups_for_user(
                UserPoolId=USER_POOL_ID,
                Username=user_id
            )
            user_data["groups"] = [group["GroupName"] for group in groups_response["Groups"]]
        except ClientError:
            pass
        
        return create_response(200, True, "User retrieved successfully", user_data)
        
    except ClientError as e:
        if e.response["Error"]["Code"] == "UserNotFoundException":
            return create_response(404, False, "User not found", error_code="USER_NOT_FOUND")
        else:
            print(f"Error getting user: {e}")
            return create_response(500, False, "Failed to get user", error_code="INTERNAL_ERROR")
    except Exception as e:
        print(f"Error getting user: {e}")
        return create_response(500, False, "Failed to get user", error_code="INTERNAL_ERROR")


def handle_cors(event, context):
    """Handle CORS preflight requests"""
    return {
        "statusCode": 200,
        "headers": CORS_HEADERS,
        "body": ""
    }


def handler(event, context):
    """Main Lambda handler"""
    try:
        http_method = event.get("httpMethod", "")
        path = event.get("path", "")
        
        print(f"Received {http_method} request to {path}")
        
        # Handle CORS preflight
        if http_method == "OPTIONS":
            return handle_cors(event, context)
        
        # Route requests
        if http_method == "GET":
            if "/users/" in path:
                return get_user(event, context)
            else:
                return list_users(event, context)
        else:
            return create_response(405, False, "Method not allowed", error_code="METHOD_NOT_ALLOWED")
    
    except Exception as e:
        print(f"Unexpected error: {e}")
        return create_response(500, False, "Internal server error", error_code="INTERNAL_ERROR")
