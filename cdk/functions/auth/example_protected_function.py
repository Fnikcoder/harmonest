"""
Example of how to use the authorization system in your Lambda functions
"""
import json
from authorizer import require_permission, get_user_context


# CORS headers
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Content-Type": "application/json"
}


def create_response(status_code: int, success: bool, message: str, data=None):
    """Create standardized API response"""
    response_body = {
        "success": success,
        "message": message
    }
    
    if data is not None:
        response_body["data"] = data
    
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(response_body)
    }


@require_permission("dynamodb:read")
def get_admin_data(event, context):
    """Example function that requires DynamoDB read permission"""
    user_context = get_user_context(event)
    
    return create_response(200, True, "Admin data retrieved", {
        "message": f"Hello {user_context['user_role']}!",
        "data": "This is sensitive admin data",
        "user_permissions": user_context['permissions']
    })


@require_permission("s3:write")
def upload_file(event, context):
    """Example function that requires S3 write permission"""
    user_context = get_user_context(event)
    
    return create_response(200, True, "File upload authorized", {
        "message": f"User {user_context['user_id']} can upload files",
        "user_role": user_context['user_role']
    })


@require_permission("users:change_roles")
def change_user_role(event, context):
    """Example function that requires owner-level permissions"""
    user_context = get_user_context(event)
    
    return create_response(200, True, "Role change authorized", {
        "message": "Only owners can change user roles",
        "current_user": user_context['user_id']
    })


def public_endpoint(event, context):
    """Example of a public endpoint that doesn't require authentication"""
    return create_response(200, True, "This is a public endpoint", {
        "message": "Anyone can access this"
    })


def guest_endpoint(event, context):
    """Example endpoint that allows guests to access their own data"""
    user_context = get_user_context(event)
    
    # Even guests can access this, but they get user context
    return create_response(200, True, "Guest data retrieved", {
        "message": f"Welcome {user_context['user_role']}!",
        "user_id": user_context['user_id'],
        "note": "Guests can only see their own data"
    })


def handler(event, context):
    """Main handler that routes to different functions"""
    try:
        http_method = event.get("httpMethod", "")
        path = event.get("path", "")
        
        # Handle CORS preflight
        if http_method == "OPTIONS":
            return {
                "statusCode": 200,
                "headers": CORS_HEADERS,
                "body": ""
            }
        
        # Route based on path
        if "/admin-data" in path:
            return get_admin_data(event, context)
        elif "/upload" in path:
            return upload_file(event, context)
        elif "/change-role" in path:
            return change_user_role(event, context)
        elif "/public" in path:
            return public_endpoint(event, context)
        elif "/guest" in path:
            return guest_endpoint(event, context)
        else:
            return create_response(404, False, "Endpoint not found")
    
    except Exception as e:
        print(f"Error: {e}")
        return create_response(500, False, "Internal server error")


# Example of how to check permissions programmatically
def example_conditional_logic(event, context):
    """Example of conditional logic based on user role"""
    user_context = get_user_context(event)
    user_role = user_context['user_role']
    
    response_data = {
        "basic_info": "This is available to everyone"
    }
    
    # Add more data based on role
    if user_role in ["support", "admin", "super_admin", "owner"]:
        response_data["support_info"] = "This is available to support and above"
    
    if user_role in ["admin", "super_admin", "owner"]:
        response_data["admin_info"] = "This is available to admins and above"
    
    if user_role in ["super_admin", "owner"]:
        response_data["super_admin_info"] = "This is available to super admins and owners"
    
    if user_role == "owner":
        response_data["owner_info"] = "This is only available to owners"
    
    return create_response(200, True, "Data retrieved based on role", response_data)


# Example of how to restrict data access for guests
def get_user_reservations(event, context):
    """Example of how guests can only see their own data"""
    user_context = get_user_context(event)
    user_id = user_context['user_id']
    user_role = user_context['user_role']
    
    # For guests, only return their own reservations
    if user_role == "guest":
        # In real implementation, you'd query DynamoDB with user_id filter
        reservations = [
            {"id": "123", "user_id": user_id, "status": "confirmed"},
            {"id": "124", "user_id": user_id, "status": "pending"}
        ]
    else:
        # Support and above can see all reservations
        reservations = [
            {"id": "123", "user_id": user_id, "status": "confirmed"},
            {"id": "124", "user_id": user_id, "status": "pending"},
            {"id": "125", "user_id": "other_user", "status": "confirmed"},
            {"id": "126", "user_id": "another_user", "status": "cancelled"}
        ]
    
    return create_response(200, True, "Reservations retrieved", {
        "reservations": reservations,
        "user_role": user_role,
        "total": len(reservations)
    })
