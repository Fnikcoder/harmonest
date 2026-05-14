"""
User Management Lambda Function
Handles user CRUD operations and role management
"""
import json
import boto3
import os
from typing import Dict, Any, List, Optional
from botocore.exceptions import ClientError
from authorizer import require_permission, get_user_context


# AWS clients
cognito_client = boto3.client("cognito-idp")
USER_POOL_ID = os.environ["USER_POOL_ID"]

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


@require_permission("users:read")
def list_users(event, context):
    """List all users with their roles"""
    try:
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


@require_permission("users:read")
def get_user(event, context):
    """Get specific user details"""
    try:
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


@require_permission("users:write")
def create_user(event, context):
    """Create new user"""
    try:
        body = json.loads(event["body"])
        email = body.get("email")
        temporary_password = body.get("temporaryPassword")
        groups = body.get("groups", ["guest"])
        
        if not email or not temporary_password:
            return create_response(400, False, "Email and temporary password are required", error_code="MISSING_REQUIRED_FIELDS")
        
        # Create user in Cognito
        create_response_data = cognito_client.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=email,
            UserAttributes=[
                {"Name": "email", "Value": email},
                {"Name": "email_verified", "Value": "true"}
            ],
            TemporaryPassword=temporary_password,
            MessageAction="SUPPRESS"  # Don't send welcome email
        )
        
        user_id = create_response_data["User"]["Username"]
        
        # Add user to groups
        for group in groups:
            try:
                cognito_client.admin_add_user_to_group(
                    UserPoolId=USER_POOL_ID,
                    Username=user_id,
                    GroupName=group
                )
            except ClientError as e:
                print(f"Warning: Failed to add user to group {group}: {e}")
        
        return create_response(201, True, "User created successfully", {
            "userId": user_id,
            "email": email,
            "groups": groups
        })
        
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        if error_code == "UsernameExistsException":
            return create_response(409, False, "User already exists", error_code="USER_EXISTS")
        else:
            print(f"Error creating user: {e}")
            return create_response(500, False, "Failed to create user", error_code="INTERNAL_ERROR")
    except Exception as e:
        print(f"Error creating user: {e}")
        return create_response(500, False, "Failed to create user", error_code="INTERNAL_ERROR")


@require_permission("users:change_roles")
def update_user_groups(event, context):
    """Update user's group memberships"""
    try:
        user_id = event["pathParameters"]["userId"]
        body = json.loads(event["body"])
        new_groups = body.get("groups", [])
        
        # Get current groups
        current_groups_response = cognito_client.admin_list_groups_for_user(
            UserPoolId=USER_POOL_ID,
            Username=user_id
        )
        current_groups = [group["GroupName"] for group in current_groups_response["Groups"]]
        
        # Remove user from groups they're no longer in
        for group in current_groups:
            if group not in new_groups:
                cognito_client.admin_remove_user_from_group(
                    UserPoolId=USER_POOL_ID,
                    Username=user_id,
                    GroupName=group
                )
        
        # Add user to new groups
        for group in new_groups:
            if group not in current_groups:
                cognito_client.admin_add_user_to_group(
                    UserPoolId=USER_POOL_ID,
                    Username=user_id,
                    GroupName=group
                )
        
        return create_response(200, True, "User groups updated successfully", {
            "userId": user_id,
            "groups": new_groups
        })
        
    except ClientError as e:
        if e.response["Error"]["Code"] == "UserNotFoundException":
            return create_response(404, False, "User not found", error_code="USER_NOT_FOUND")
        else:
            print(f"Error updating user groups: {e}")
            return create_response(500, False, "Failed to update user groups", error_code="INTERNAL_ERROR")
    except Exception as e:
        print(f"Error updating user groups: {e}")
        return create_response(500, False, "Failed to update user groups", error_code="INTERNAL_ERROR")


@require_permission("users:write")
def enable_disable_user(event, context):
    """Enable or disable user account"""
    try:
        user_id = event["pathParameters"]["userId"]
        body = json.loads(event["body"])
        enabled = body.get("enabled", True)
        
        if enabled:
            cognito_client.admin_enable_user(
                UserPoolId=USER_POOL_ID,
                Username=user_id
            )
            message = "User enabled successfully"
        else:
            cognito_client.admin_disable_user(
                UserPoolId=USER_POOL_ID,
                Username=user_id
            )
            message = "User disabled successfully"
        
        return create_response(200, True, message, {
            "userId": user_id,
            "enabled": enabled
        })
        
    except ClientError as e:
        if e.response["Error"]["Code"] == "UserNotFoundException":
            return create_response(404, False, "User not found", error_code="USER_NOT_FOUND")
        else:
            print(f"Error updating user status: {e}")
            return create_response(500, False, "Failed to update user status", error_code="INTERNAL_ERROR")
    except Exception as e:
        print(f"Error updating user status: {e}")
        return create_response(500, False, "Failed to update user status", error_code="INTERNAL_ERROR")


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
        elif http_method == "POST":
            return create_user(event, context)
        elif http_method == "PUT":
            if "/groups" in path:
                return update_user_groups(event, context)
            elif "/status" in path:
                return enable_disable_user(event, context)
        else:
            return create_response(405, False, "Method not allowed", error_code="METHOD_NOT_ALLOWED")
    
    except Exception as e:
        print(f"Unexpected error: {e}")
        return create_response(500, False, "Internal server error", error_code="INTERNAL_ERROR")
