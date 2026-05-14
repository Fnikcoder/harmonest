"""
Multi-Tenant Email Verification Lambda Function
Handles sending verification emails and verifying codes for check-in process
Supports dynamic client configuration for branding and email settings
"""
import json
import os
import boto3
import random
import string
from typing import Dict, Any, Optional
from common.ddb import get, put, now_ms
from common.config import get_email_template_vars, get_client_config
from common.email_utils import send_email_via_zoho
from common.models import convert_to_decimal

# Environment variables
ENVIRONMENT = os.environ.get("ENVIRONMENT", "prod")
CLIENT_NAME = os.environ.get("CLIENT_NAME", "client")
CLIENT_DISPLAY_NAME = os.environ.get("CLIENT_DISPLAY_NAME", "Hotel Management System")

# Constants
VERIFICATION_CODE_LENGTH = 6
VERIFICATION_CODE_EXPIRY_MINUTES = 10
VERIFICATION_CODE_EXPIRY_MS = VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000

# Error codes
ERROR_MISSING_REQUIRED_FIELDS = "MISSING_REQUIRED_FIELDS"
ERROR_INVALID_EMAIL = "INVALID_EMAIL"
ERROR_INVALID_OPERATION = "INVALID_OPERATION"
ERROR_VERIFICATION_CODE_EXPIRED = "VERIFICATION_CODE_EXPIRED"
ERROR_INVALID_VERIFICATION_CODE = "INVALID_VERIFICATION_CODE"
ERROR_EMAIL_SEND_FAILED = "EMAIL_SEND_FAILED"
ERROR_INTERNAL_ERROR = "INTERNAL_ERROR"


def _validate_email(email: str) -> bool:
    """Validate email format"""
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def _generate_verification_code() -> str:
    """Generate a random 6-digit verification code"""
    return ''.join(random.choices(string.digits, k=VERIFICATION_CODE_LENGTH))


def _get_email_template(verification_code: str, email_type: str) -> Dict[str, str]:
    """Get email template based on type"""
    # Get client-specific information from configuration
    template_vars = get_email_template_vars()
    client_display_name = template_vars["client_display_name"]
    client_domain = template_vars["primary_domain"]
    support_email = template_vars["support_email"]

    # Use Harmonest brand colors
    primary_color = "#3f7eb1"  # Blue
    secondary_color = "#b3c37d"  # Green

    templates = {
        "checkin": {
            "subject": f"{client_display_name} - Email Verification for Check-in",
            "html": f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
                        <h2 style="color: {primary_color}; margin-top: 0;">{client_display_name} Check-in Verification</h2>
                        <p>Your verification code for check-in is:</p>
                        <div style="background: #e8f4fd; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; border-left: 4px solid {primary_color};">
                            <span style="font-size: 32px; font-weight: bold; color: {primary_color}; letter-spacing: 5px;">{verification_code}</span>
                        </div>
                        <p>This code will expire in {VERIFICATION_CODE_EXPIRY_MINUTES} minutes.</p>
                        <p>If you didn't request this verification, please ignore this email.</p>

                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
                        <div style="color: #6c757d; font-size: 14px;">
                            <p style="margin: 0; font-weight: bold; color: {primary_color};">{client_display_name}</p>
                            <p style="margin: 5px 0 0 0;">{client_domain}</p>
                            <p style="margin: 5px 0 0 0;">Support: <a href="mailto:{support_email}" style="color: {primary_color};">{support_email}</a></p>
                            <br>
                            <p style="margin: 0; font-style: italic;">
                                This is an automated message from {client_display_name}. Please do not reply to this email.
                            </p>
                        </div>
                    </div>
                </div>
            """,
            "text": f"""
                {client_display_name} Check-in Verification

                Your verification code is: {verification_code}

                This code will expire in {VERIFICATION_CODE_EXPIRY_MINUTES} minutes.

                If you didn't request this verification, please ignore this email.

                ---
                {client_display_name}
                {client_domain}
                Support: {support_email}

                This is an automated message from {client_display_name}. Please do not reply to this email.
            """
        }
    }

    return templates.get(email_type, templates["checkin"])


def _store_verification_code(email: str, verification_code: str, email_type: str) -> None:
    """Store verification code in DynamoDB with TTL"""
    current_time = now_ms()
    expiry_time = current_time + VERIFICATION_CODE_EXPIRY_MS
    
    verification_record = {
        "PK": f"EMAIL_VERIFICATION#{email}",
        "SK": f"CODE#{email_type}",
        "email": email,
        "verificationCode": verification_code,
        "type": email_type,
        "createdAt": current_time,
        "expiresAt": expiry_time,
        "ttl": int(expiry_time / 1000),  # DynamoDB TTL in seconds
        "verified": False
    }

    # Use centralized conversion for DynamoDB compatibility
    put(convert_to_decimal(verification_record))


def _get_verification_record(email: str, email_type: str) -> Optional[Dict[str, Any]]:
    """Get verification record from DynamoDB"""
    return get(f"EMAIL_VERIFICATION#{email}", f"CODE#{email_type}")


def _mark_as_verified(email: str, email_type: str) -> None:
    """Mark verification code as used"""
    record = _get_verification_record(email, email_type)
    if record:
        record["verified"] = True
        record["verifiedAt"] = now_ms()
        # Use centralized conversion for DynamoDB compatibility
        put(convert_to_decimal(record))


def _create_response(status_code: int, success: bool, message: str, data: Optional[Dict] = None, error_code: Optional[str] = None) -> Dict[str, Any]:
    """Create standardized API response"""
    response = {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        "body": json.dumps({
            "success": success,
            "message": message,
            "data": data or {},
            "errorCode": error_code,
            "timestamp": now_ms()
        })
    }
    return response


def send_verification_email(event: Dict[str, Any]) -> Dict[str, Any]:
    """Send verification email with code"""
    try:
        body = json.loads(event.get("body", "{}"))
        email = body.get("email", "").strip().lower()
        email_type = body.get("type", "checkin").strip()
        
        # Validate required fields
        if not email:
            return _create_response(
                400, False,
                "Email is required",
                error_code=ERROR_MISSING_REQUIRED_FIELDS
            )
        
        # Validate email format
        if not _validate_email(email):
            return _create_response(
                400, False,
                "Invalid email format",
                error_code=ERROR_INVALID_EMAIL
            )
        
        # Generate verification code
        verification_code = _generate_verification_code()
        
        # Store verification code in database
        _store_verification_code(email, verification_code, email_type)
        
        # Get email template
        template = _get_email_template(verification_code, email_type)
        
        # Send email via Zoho SMTP
        try:
            email_sent = send_email_via_zoho(
                to_email=email,
                subject=template["subject"],
                html_content=template["html"],
                text_content=template["text"]
            )

            if not email_sent:
                raise Exception("Failed to send email via Zoho SMTP")
            
            return _create_response(
                200, True,
                f"Verification code sent successfully to {email}",
                data={
                    "email": email,
                    "type": email_type,
                    "expiresInMinutes": VERIFICATION_CODE_EXPIRY_MINUTES
                }
            )
            
        except Exception as email_error:
            print(f"Zoho SMTP Error: {str(email_error)}")
            return _create_response(
                500, False,
                "Failed to send verification email",
                error_code=ERROR_EMAIL_SEND_FAILED
            )
    
    except Exception as e:
        print(f"Error in send_verification_email: {str(e)}")
        return _create_response(
            500, False,
            "Internal server error",
            error_code=ERROR_INTERNAL_ERROR
        )


def verify_email_code(event: Dict[str, Any]) -> Dict[str, Any]:
    """Verify email verification code"""
    try:
        body = json.loads(event.get("body", "{}"))
        email = body.get("email", "").strip().lower()
        verification_code = body.get("verificationCode", "").strip()
        email_type = body.get("type", "checkin").strip()
        
        # Validate required fields
        if not email or not verification_code:
            return _create_response(
                400, False,
                "Email and verification code are required",
                error_code=ERROR_MISSING_REQUIRED_FIELDS
            )
        
        # Validate email format
        if not _validate_email(email):
            return _create_response(
                400, False,
                "Invalid email format",
                error_code=ERROR_INVALID_EMAIL
            )
        
        # Get verification record from database
        verification_record = _get_verification_record(email, email_type)
        
        if not verification_record:
            return _create_response(
                400, False,
                "No verification code found for this email",
                error_code=ERROR_INVALID_VERIFICATION_CODE
            )
        
        # Check if code has expired
        current_time = now_ms()
        if current_time > verification_record.get("expiresAt", 0):
            return _create_response(
                400, False,
                "Verification code has expired",
                error_code=ERROR_VERIFICATION_CODE_EXPIRED
            )
        
        # Check if code has already been used
        if verification_record.get("verified", False):
            return _create_response(
                400, False,
                "Verification code has already been used",
                error_code=ERROR_INVALID_VERIFICATION_CODE
            )
        
        # Verify the code
        stored_code = verification_record.get("verificationCode", "")
        if stored_code != verification_code:
            return _create_response(
                400, False,
                "Invalid verification code",
                error_code=ERROR_INVALID_VERIFICATION_CODE
            )
        
        # Mark as verified
        _mark_as_verified(email, email_type)
        
        return _create_response(
            200, True,
            "Email verified successfully",
            data={
                "email": email,
                "type": email_type,
                "verifiedAt": now_ms()
            }
        )
    
    except Exception as e:
        print(f"Error in verify_email_code: {str(e)}")
        return _create_response(
            500, False,
            "Internal server error",
            error_code=ERROR_INTERNAL_ERROR
        )


def handler(event, context):
    """Main Lambda handler"""
    try:
        http_method = event.get("httpMethod", "")
        path = event.get("path", "")
        
        print(f"Received {http_method} request to {path}")
        print(f"Event: {json.dumps(event)}")
        
        # Handle CORS preflight requests
        if http_method == "OPTIONS":
            return _create_response(200, True, "CORS preflight")
        
        # Handle POST requests with operations
        if http_method == "POST":
            body = json.loads(event.get("body", "{}"))
            operation = body.get("operation", "")
            
            if operation == "send-verification-email":
                return send_verification_email(event)
            elif operation == "verify-email-code":
                return verify_email_code(event)
            else:
                return _create_response(
                    400, False,
                    f"Unknown operation: {operation}. Supported operations: send-verification-email, verify-email-code",
                    error_code=ERROR_INVALID_OPERATION
                )
        
        else:
            return _create_response(
                405, False,
                f"Method {http_method} not allowed"
            )
    
    except Exception as e:
        print(f"Error in main handler: {str(e)}")
        return _create_response(
            500, False,
            "Internal server error",
            error_code=ERROR_INTERNAL_ERROR
        )
