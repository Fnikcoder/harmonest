"""
S3 Handler Lambda Function
Provides role-based access to S3 operations for frontend
"""
import json
import boto3
import os
import base64
from typing import Dict, Any, List, Optional
from botocore.exceptions import ClientError
from urllib.parse import unquote

# Import authorization functions from layer
import sys
sys.path.append('/opt/python')
sys.path.append('/opt/python/auth')
from authorizer import require_permission, get_user_context

# AWS clients
s3_client = boto3.client("s3", region_name="eu-central-1")
BUCKET_NAME = os.environ["S3_BUCKET"]

# CORS headers
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Content-Type": "application/json"
}

def create_response(status_code: int, success: bool, message: str, data: Any = None, error_code: str = None):
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

def get_role_based_prefix(user_role: str, user_id: str) -> List[str]:
    """Get allowed S3 prefixes based on user role"""
    if user_role in ['owner', 'super_admin']:
        # Full access to all folders
        return ['public/', 'protected/', 'private/', 'admin/', 'system/']
    elif user_role == 'admin':
        # Access to public, protected, and admin folders
        return ['public/', 'protected/', 'admin/']
    elif user_role == 'support':
        # Read-only access to public and protected folders
        return ['public/', 'protected/']
    else:
        # Guest users can only access their own private folder
        return [f'private/{user_id}/']

def validate_access(user_role: str, user_id: str, key: str, operation: str) -> bool:
    """Validate if user can access the specified S3 key"""
    allowed_prefixes = get_role_based_prefix(user_role, user_id)
    
    # Check if key starts with any allowed prefix
    has_access = any(key.startswith(prefix) for prefix in allowed_prefixes)
    
    if not has_access:
        return False
    
    # Additional write restrictions for support role
    if user_role == 'support' and operation in ['write', 'delete']:
        return False
    
    return True

@require_permission("s3:read")
def get_presigned_url(event, context):
    """Generate presigned URL for file download"""
    try:
        body = json.loads(event.get("body", "{}"))
        key = body.get("key")
        expires_in = body.get("expires_in", 3600)  # Default 1 hour
        
        if not key:
            return create_response(400, False, "Missing required field: key", error_code="MISSING_FIELDS")
        
        user_context = get_user_context(event)
        user_role = user_context['user_role']
        user_id = user_context['user_id']
        
        # Validate access
        if not validate_access(user_role, user_id, key, 'read'):
            return create_response(403, False, "Access denied to this file", error_code="ACCESS_DENIED")
        
        # Generate presigned URL
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': BUCKET_NAME, 'Key': key},
            ExpiresIn=min(expires_in, 7200)  # Max 2 hours
        )
        
        return create_response(200, True, "Presigned URL generated successfully", {
            "url": url,
            "expires_in": expires_in,
            "key": key
        })
        
    except ClientError as e:
        return create_response(500, False, f"S3 error: {e.response['Error']['Message']}", error_code="S3_ERROR")
    except Exception as e:
        return create_response(500, False, f"Internal error: {str(e)}", error_code="INTERNAL_ERROR")

@require_permission("s3:write")
def get_upload_url(event, context):
    """Generate presigned URL for file upload"""
    try:
        body = json.loads(event.get("body", "{}"))
        key = body.get("key")
        content_type = body.get("content_type", "application/octet-stream")
        expires_in = body.get("expires_in", 3600)
        
        if not key:
            return create_response(400, False, "Missing required field: key", error_code="MISSING_FIELDS")
        
        user_context = get_user_context(event)
        user_role = user_context['user_role']
        user_id = user_context['user_id']
        
        # Validate access
        if not validate_access(user_role, user_id, key, 'write'):
            return create_response(403, False, "Access denied to this location", error_code="ACCESS_DENIED")
        
        # Generate presigned URL for upload
        url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': key,
                'ContentType': content_type
            },
            ExpiresIn=min(expires_in, 3600)  # Max 1 hour for uploads
        )
        
        return create_response(200, True, "Upload URL generated successfully", {
            "upload_url": url,
            "expires_in": expires_in,
            "key": key,
            "content_type": content_type
        })
        
    except ClientError as e:
        return create_response(500, False, f"S3 error: {e.response['Error']['Message']}", error_code="S3_ERROR")
    except Exception as e:
        return create_response(500, False, f"Internal error: {str(e)}", error_code="INTERNAL_ERROR")

@require_permission("s3:write")
def upload_file(event, context):
    """Direct file upload (for small files)"""
    try:
        body = json.loads(event.get("body", "{}"))
        key = body.get("key")
        file_content = body.get("file_content")  # Base64 encoded
        content_type = body.get("content_type", "application/octet-stream")
        
        if not key or not file_content:
            return create_response(400, False, "Missing required fields: key, file_content", error_code="MISSING_FIELDS")
        
        user_context = get_user_context(event)
        user_role = user_context['user_role']
        user_id = user_context['user_id']
        
        # Validate access
        if not validate_access(user_role, user_id, key, 'write'):
            return create_response(403, False, "Access denied to this location", error_code="ACCESS_DENIED")
        
        # Decode base64 content
        try:
            file_data = base64.b64decode(file_content)
        except Exception:
            return create_response(400, False, "Invalid base64 file content", error_code="INVALID_FILE_CONTENT")
        
        # Check file size (limit to 5MB for direct upload)
        if len(file_data) > 5 * 1024 * 1024:
            return create_response(400, False, "File too large. Use presigned URL for files > 5MB", error_code="FILE_TOO_LARGE")
        
        # Upload to S3
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=key,
            Body=file_data,
            ContentType=content_type,
            Metadata={
                'uploaded_by': user_id,
                'uploaded_by_role': user_role
            }
        )
        
        return create_response(200, True, "File uploaded successfully", {
            "key": key,
            "size": len(file_data),
            "content_type": content_type
        })
        
    except ClientError as e:
        return create_response(500, False, f"S3 error: {e.response['Error']['Message']}", error_code="S3_ERROR")
    except Exception as e:
        return create_response(500, False, f"Internal error: {str(e)}", error_code="INTERNAL_ERROR")

@require_permission("s3:read")
def list_files(event, context):
    """List files in S3 bucket"""
    try:
        query_params = event.get("queryStringParameters") or {}
        prefix = query_params.get("prefix", "")
        max_keys = int(query_params.get("max_keys", 100))
        continuation_token = query_params.get("continuation_token")
        
        user_context = get_user_context(event)
        user_role = user_context['user_role']
        user_id = user_context['user_id']
        
        # Validate prefix access
        if prefix and not validate_access(user_role, user_id, prefix, 'read'):
            return create_response(403, False, "Access denied to this location", error_code="ACCESS_DENIED")
        
        # If no prefix specified, use role-based default
        if not prefix:
            allowed_prefixes = get_role_based_prefix(user_role, user_id)
            if len(allowed_prefixes) == 1:
                prefix = allowed_prefixes[0]
            else:
                # For multiple prefixes, return list of available prefixes
                return create_response(200, True, "Available prefixes", {
                    "prefixes": allowed_prefixes,
                    "message": "Specify a prefix parameter to list files"
                })
        
        # List objects
        list_params = {
            "Bucket": BUCKET_NAME,
            "Prefix": prefix,
            "MaxKeys": min(max_keys, 1000)  # Cap at 1000
        }
        
        if continuation_token:
            list_params["ContinuationToken"] = continuation_token
        
        response = s3_client.list_objects_v2(**list_params)
        
        # Format response
        files = []
        for obj in response.get("Contents", []):
            files.append({
                "key": obj["Key"],
                "size": obj["Size"],
                "last_modified": obj["LastModified"].isoformat(),
                "etag": obj["ETag"].strip('"')
            })
        
        return create_response(200, True, "Files listed successfully", {
            "files": files,
            "count": len(files),
            "prefix": prefix,
            "is_truncated": response.get("IsTruncated", False),
            "next_continuation_token": response.get("NextContinuationToken")
        })
        
    except ClientError as e:
        return create_response(500, False, f"S3 error: {e.response['Error']['Message']}", error_code="S3_ERROR")
    except Exception as e:
        return create_response(500, False, f"Internal error: {str(e)}", error_code="INTERNAL_ERROR")

@require_permission("s3:delete")
def delete_file(event, context):
    """Delete file from S3"""
    try:
        body = json.loads(event.get("body", "{}"))
        key = body.get("key")
        
        if not key:
            return create_response(400, False, "Missing required field: key", error_code="MISSING_FIELDS")
        
        user_context = get_user_context(event)
        user_role = user_context['user_role']
        user_id = user_context['user_id']
        
        # Validate access
        if not validate_access(user_role, user_id, key, 'delete'):
            return create_response(403, False, "Access denied to delete this file", error_code="ACCESS_DENIED")
        
        # Delete from S3
        s3_client.delete_object(Bucket=BUCKET_NAME, Key=key)
        
        return create_response(200, True, "File deleted successfully", {"key": key})
        
    except ClientError as e:
        return create_response(500, False, f"S3 error: {e.response['Error']['Message']}", error_code="S3_ERROR")
    except Exception as e:
        return create_response(500, False, f"Internal error: {str(e)}", error_code="INTERNAL_ERROR")

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
        
        # Route requests based on path and method
        if "/s3/download" in path and http_method == "POST":
            return get_presigned_url(event, context)
        elif "/s3/upload-url" in path and http_method == "POST":
            return get_upload_url(event, context)
        elif "/s3/upload" in path and http_method == "POST":
            return upload_file(event, context)
        elif "/s3/list" in path and http_method == "GET":
            return list_files(event, context)
        elif "/s3/delete" in path and http_method == "POST":
            return delete_file(event, context)
        else:
            return create_response(404, False, "Endpoint not found", error_code="ENDPOINT_NOT_FOUND")
    
    except Exception as e:
        print(f"Handler error: {e}")
        return create_response(500, False, f"Internal server error: {str(e)}", error_code="INTERNAL_ERROR")
