"""
DynamoDB Handler Lambda Function
Provides role-based access to DynamoDB operations for frontend
"""
import json
import boto3
import os
from typing import Dict, Any, List, Optional
from botocore.exceptions import ClientError
from decimal import Decimal

# Import authorization functions from layer
import sys
sys.path.append('/opt/python')
sys.path.append('/opt/python/auth')
from authorizer import require_permission, get_user_context

# AWS clients
dynamodb = boto3.resource("dynamodb", region_name="eu-central-1")
table = dynamodb.Table(os.environ["APP_TABLE"])

# CORS headers
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Content-Type": "application/json"
}

def decimal_default(obj):
    """JSON serializer for DynamoDB Decimal objects"""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")

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
        "body": json.dumps(response_body, default=decimal_default)
    }

@require_permission("dynamodb:read")
def get_item(event, context):
    """Get single item from DynamoDB"""
    try:
        body = json.loads(event.get("body", "{}"))
        pk = body.get("pk")
        sk = body.get("sk")
        
        if not pk or not sk:
            return create_response(400, False, "Missing required fields: pk, sk", error_code="MISSING_FIELDS")
        
        user_context = get_user_context(event)
        user_role = user_context['user_role']
        
        # Role-based access control
        if user_role in ['support']:
            # Support can only read certain entity types
            allowed_prefixes = ['LISTING#', 'GROUP#', 'RESERVATION#']
            if not any(pk.startswith(prefix) for prefix in allowed_prefixes):
                return create_response(403, False, "Access denied to this data type", error_code="ACCESS_DENIED")
        
        response = table.get_item(Key={"PK": pk, "SK": sk})
        item = response.get("Item")
        
        if not item:
            return create_response(404, False, "Item not found", error_code="ITEM_NOT_FOUND")
        
        return create_response(200, True, "Item retrieved successfully", item)
        
    except ClientError as e:
        return create_response(500, False, f"DynamoDB error: {e.response['Error']['Message']}", error_code="DYNAMODB_ERROR")
    except Exception as e:
        return create_response(500, False, f"Internal error: {str(e)}", error_code="INTERNAL_ERROR")

@require_permission("dynamodb:read")
def query_items(event, context):
    """Query items from DynamoDB"""
    try:
        body = json.loads(event.get("body", "{}"))
        pk = body.get("pk")
        sk_condition = body.get("sk_condition")  # Optional: begins_with, between, etc.
        sk_value = body.get("sk_value")
        index_name = body.get("index_name")  # Optional: for GSI queries
        limit = body.get("limit", 50)
        last_evaluated_key = body.get("last_evaluated_key")
        
        if not pk:
            return create_response(400, False, "Missing required field: pk", error_code="MISSING_FIELDS")
        
        user_context = get_user_context(event)
        user_role = user_context['user_role']
        
        # Role-based access control
        if user_role in ['support']:
            allowed_prefixes = ['LISTING#', 'GROUP#', 'RESERVATION#']
            if not any(pk.startswith(prefix) for prefix in allowed_prefixes):
                return create_response(403, False, "Access denied to this data type", error_code="ACCESS_DENIED")
        
        # Build query parameters
        query_params = {
            "KeyConditionExpression": boto3.dynamodb.conditions.Key("PK").eq(pk),
            "Limit": min(limit, 100)  # Cap at 100 items
        }
        
        # Add sort key condition if provided
        if sk_condition and sk_value:
            if sk_condition == "begins_with":
                query_params["KeyConditionExpression"] &= boto3.dynamodb.conditions.Key("SK").begins_with(sk_value)
            elif sk_condition == "eq":
                query_params["KeyConditionExpression"] &= boto3.dynamodb.conditions.Key("SK").eq(sk_value)
        
        # Add index if specified
        if index_name:
            query_params["IndexName"] = index_name
            # For GSI, use appropriate key names
            if index_name.startswith("GSI"):
                gsi_pk = f"{index_name}PK"
                query_params["KeyConditionExpression"] = boto3.dynamodb.conditions.Key(gsi_pk).eq(pk)
        
        # Add pagination
        if last_evaluated_key:
            query_params["ExclusiveStartKey"] = last_evaluated_key
        
        response = table.query(**query_params)
        
        return create_response(200, True, "Query completed successfully", {
            "items": response.get("Items", []),
            "count": response.get("Count", 0),
            "last_evaluated_key": response.get("LastEvaluatedKey")
        })
        
    except ClientError as e:
        return create_response(500, False, f"DynamoDB error: {e.response['Error']['Message']}", error_code="DYNAMODB_ERROR")
    except Exception as e:
        return create_response(500, False, f"Internal error: {str(e)}", error_code="INTERNAL_ERROR")

@require_permission("dynamodb:write")
def put_item(event, context):
    """Put item to DynamoDB"""
    try:
        body = json.loads(event.get("body", "{}"))
        item = body.get("item")
        
        if not item or not item.get("PK") or not item.get("SK"):
            return create_response(400, False, "Missing required fields: item with PK and SK", error_code="MISSING_FIELDS")
        
        user_context = get_user_context(event)
        user_role = user_context['user_role']
        
        # Role-based access control for writes
        if user_role == 'admin':
            # Admin can write to most entities but not user management data
            restricted_prefixes = ['USER#', 'ADMIN#']
            if any(item["PK"].startswith(prefix) for prefix in restricted_prefixes):
                return create_response(403, False, "Access denied to this data type", error_code="ACCESS_DENIED")
        
        # Add metadata
        import time
        item["updatedAt"] = int(time.time() * 1000)
        item["updatedBy"] = user_context['user_id']
        
        table.put_item(Item=item)
        
        return create_response(200, True, "Item saved successfully", {"pk": item["PK"], "sk": item["SK"]})
        
    except ClientError as e:
        return create_response(500, False, f"DynamoDB error: {e.response['Error']['Message']}", error_code="DYNAMODB_ERROR")
    except Exception as e:
        return create_response(500, False, f"Internal error: {str(e)}", error_code="INTERNAL_ERROR")

@require_permission("dynamodb:write")
def update_item(event, context):
    """Update item in DynamoDB"""
    try:
        body = json.loads(event.get("body", "{}"))
        pk = body.get("pk")
        sk = body.get("sk")
        updates = body.get("updates")
        
        if not pk or not sk or not updates:
            return create_response(400, False, "Missing required fields: pk, sk, updates", error_code="MISSING_FIELDS")
        
        user_context = get_user_context(event)
        user_role = user_context['user_role']
        
        # Role-based access control
        if user_role == 'admin':
            restricted_prefixes = ['USER#', 'ADMIN#']
            if any(pk.startswith(prefix) for prefix in restricted_prefixes):
                return create_response(403, False, "Access denied to this data type", error_code="ACCESS_DENIED")
        
        # Build update expression
        update_expression = "SET "
        expression_attribute_values = {}
        expression_attribute_names = {}
        
        for key, value in updates.items():
            if key in ['PK', 'SK']:  # Don't allow updating keys
                continue
            attr_name = f"#{key}"
            attr_value = f":{key}"
            update_expression += f"{attr_name} = {attr_value}, "
            expression_attribute_names[attr_name] = key
            expression_attribute_values[attr_value] = value
        
        # Add metadata
        import time
        update_expression += "#updatedAt = :updatedAt, #updatedBy = :updatedBy"
        expression_attribute_names["#updatedAt"] = "updatedAt"
        expression_attribute_names["#updatedBy"] = "updatedBy"
        expression_attribute_values[":updatedAt"] = int(time.time() * 1000)
        expression_attribute_values[":updatedBy"] = user_context['user_id']
        
        response = table.update_item(
            Key={"PK": pk, "SK": sk},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_attribute_names,
            ExpressionAttributeValues=expression_attribute_values,
            ReturnValues="ALL_NEW"
        )
        
        return create_response(200, True, "Item updated successfully", response.get("Attributes"))
        
    except ClientError as e:
        return create_response(500, False, f"DynamoDB error: {e.response['Error']['Message']}", error_code="DYNAMODB_ERROR")
    except Exception as e:
        return create_response(500, False, f"Internal error: {str(e)}", error_code="INTERNAL_ERROR")

@require_permission("dynamodb:delete")
def delete_item(event, context):
    """Delete item from DynamoDB"""
    try:
        body = json.loads(event.get("body", "{}"))
        pk = body.get("pk")
        sk = body.get("sk")
        
        if not pk or not sk:
            return create_response(400, False, "Missing required fields: pk, sk", error_code="MISSING_FIELDS")
        
        user_context = get_user_context(event)
        
        # Only super_admin and owner can delete
        table.delete_item(Key={"PK": pk, "SK": sk})
        
        return create_response(200, True, "Item deleted successfully")
        
    except ClientError as e:
        return create_response(500, False, f"DynamoDB error: {e.response['Error']['Message']}", error_code="DYNAMODB_ERROR")
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
        if "/dynamodb/get" in path and http_method == "POST":
            return get_item(event, context)
        elif "/dynamodb/query" in path and http_method == "POST":
            return query_items(event, context)
        elif "/dynamodb/put" in path and http_method == "POST":
            return put_item(event, context)
        elif "/dynamodb/update" in path and http_method == "POST":
            return update_item(event, context)
        elif "/dynamodb/delete" in path and http_method == "POST":
            return delete_item(event, context)
        else:
            return create_response(404, False, "Endpoint not found", error_code="ENDPOINT_NOT_FOUND")
    
    except Exception as e:
        print(f"Handler error: {e}")
        return create_response(500, False, f"Internal server error: {str(e)}", error_code="INTERNAL_ERROR")
