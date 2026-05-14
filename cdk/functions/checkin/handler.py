"""
Multi-Tenant Check-in Lambda Function - Version 2.0
Updated for dynamic client configuration and reservationCode validation with fallback scan logic
Supports client-specific settings through environment variables
"""
import json
import re
import os
import urllib.parse
import boto3
from botocore.exceptions import ClientError, ParamValidationError
from boto3.dynamodb.conditions import Key, Attr
from typing import Dict, Any, Optional
from common.g4h import get_client, refresh_on_auth_error
from common.guesty_adapters import (
    use_guesty_app_api,
    normalize_fegw_detail_response,
    G4H_APP_BASE,
    app_json_headers,
    merge_legacy_raw_for_update,
)
from common.ddb import get, put, now_ms, TABLE
from common.config import get_client_config, is_feature_enabled
from common.email_utils import send_checkin_completion_email
from common.models import convert_to_decimal, get_booking_source_display_name
import time
from decimal import Decimal
import base64
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo


# Constants
BASE = "https://api.guestyforhosts.com"
GET_RESERVATION_DETAIL_URL = f"{BASE}/getReservationDetailById"
BUCKET_NAME = os.environ["STORAGE_BUCKET"]
s3_client = boto3.client("s3")
scheduler_client = boto3.client("scheduler")

# Status constants
STATUS_PENDING = "pending"
STATUS_COMPLETED = "completed"
STATUS_EXPIRED = "expired"

# Error codes
ERROR_RESERVATION_NOT_FOUND = "RESERVATION_NOT_FOUND"
ERROR_INVALID_GUEST_NAME = "INVALID_GUEST_NAME"
ERROR_RESERVATION_CANCELED = "RESERVATION_CANCELED"
ERROR_CHECKIN_DEADLINE_PASSED = "CHECKIN_DEADLINE_PASSED"
ERROR_INVALID_FILE = "INVALID_FILE"
ERROR_MISSING_REQUIRED_FIELDS = "MISSING_REQUIRED_FIELDS"
ERROR_INTERNAL_ERROR = "INTERNAL_ERROR"


# Using centralized convert_to_decimal from common.models

def _to_jsonable(obj):
    """Recursively convert objects (Decimal, bytes, etc.) to JSON-serializable types."""
    if isinstance(obj, Decimal):
        # keep integers as int, otherwise use float
        return int(obj) if obj % 1 == 0 else float(obj)
    if isinstance(obj, (bytes, bytearray)):
        return base64.b64encode(obj).decode("utf-8")
    if isinstance(obj, list):
        return [_to_jsonable(x) for x in obj]
    if isinstance(obj, tuple):
        return tuple(_to_jsonable(x) for x in obj)
    if isinstance(obj, dict):
        return {k: _to_jsonable(v) for k, v in obj.items()}
    return obj


def _validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def _validate_phone(phone: str) -> bool:
    """Validate phone number format (basic validation)"""
    # Remove spaces, dashes, parentheses
    cleaned = re.sub(r'[\s\-\(\)]', '', phone)
    # Check if it contains only digits and optional + at start
    pattern = r'^\+?[0-9]{7,15}$'
    return re.match(pattern, cleaned) is not None


def _get_default_checkin_time(checkin_date_ms: int) -> int:
    """
    Convert check-in date to 14:00 Germany time if no time is specified or time is 00:00
    Germany is UTC+1 (CET) or UTC+2 (CEST)
    """
    import datetime

    # Convert milliseconds to datetime
    checkin_dt = datetime.datetime.fromtimestamp(checkin_date_ms / 1000, tz=datetime.timezone.utc)

    # Check if time is 00:00 (midnight) - indicating no specific time was set
    if checkin_dt.hour == 0 and checkin_dt.minute == 0:
        # Set to 14:00 Germany time
        # Germany is UTC+1 in winter, UTC+2 in summer
        # For simplicity, we'll use UTC+1 (CET) and adjust if needed
        germany_tz = datetime.timezone(datetime.timedelta(hours=1))

        # Create new datetime with 14:00 Germany time
        germany_dt = checkin_dt.replace(hour=13, minute=0, second=0, microsecond=0)  # 13:00 UTC = 14:00 CET

        # Convert back to milliseconds
        return int(germany_dt.timestamp() * 1000)

    # Return original time if it's not 00:00
    return checkin_date_ms


def _validate_image_file(file_data: bytes) -> bool:
    """Validate if file is a valid image"""
    # Check file size (max 5MB)
    if len(file_data) > 5 * 1024 * 1024:
        return False
    
    # Check magic bytes for common image formats
    image_signatures = [
        b'\xFF\xD8\xFF',  # JPEG
        b'\x89PNG\r\n\x1a\n',  # PNG
        b'GIF87a',  # GIF87a
        b'GIF89a',  # GIF89a
        b'RIFF',  # WebP (starts with RIFF)
    ]
    
    for signature in image_signatures:
        if file_data.startswith(signature):
            return True
    
    return False


def _get_reservation_from_db(reservation_id: str) -> Optional[Dict[str, Any]]:
    """Get reservation from DynamoDB by reservation ID"""
    return get(f"RESERVATION#{reservation_id}", "META")



def _get_reservation_by_code(reservation_code: str) -> Optional[Dict[str, Any]]:
    """
    Look up by reservationCode via GSI (preferred), then scan fallback.
    Also tries homeAwayReferenceNumber as a fallback.
    """
    # 1) GSI lookup (fast path) — requires a GSI "ReservationCodeIndex" with PK = reservationCode
    try:
        resp = TABLE.query(
            IndexName="ReservationCodeIndex",
            KeyConditionExpression=Key("reservationCode").eq(reservation_code),
            Limit=1
        )
        items = resp.get("Items", [])
        if items:
            print(f"Found by ReservationCodeIndex: {reservation_code}")
            return items[0]
    except Exception as e:
        print(f"GSI query failed: {e}. Will try scan.")

    # 2) Scan fallback on reservationCode (slow)
    try:
        resp = TABLE.scan(
            FilterExpression=Attr("reservationCode").eq(reservation_code),
            Limit=1
        )
        items = resp.get("Items", [])
        if items:
            print(f"Found by scan reservationCode: {reservation_code}")
            return items[0]
    except Exception as e:
        print(f"Scan by reservationCode failed: {e}")

    # 3) Scan fallback on homeAwayReferenceNumber (VRBO/etc.)
    try:
        resp = TABLE.scan(
            FilterExpression=Attr("homeAwayReferenceNumber").eq(reservation_code),
            Limit=1
        )
        items = resp.get("Items", [])
        if items:
            print(f"Found by homeAwayReferenceNumber: {reservation_code}")
            return items[0]
    except Exception as e:
        print(f"Scan by homeAwayReferenceNumber failed: {e}")

    print(f"No reservation found for code/reference: {reservation_code}")
    return None



def _fetch_latest_reservation_status(session, user_id: str, reservation_id: str) -> Dict[str, Any]:
    """Fetch latest reservation status from Guesty (legacy POST or app GET fegw)."""
    if use_guesty_app_api():
        rid = urllib.parse.quote(reservation_id, safe="")
        url = f"{G4H_APP_BASE}/api/reservations-fegw/reservations/{rid}?newResponse=true"

        def _call():
            h = {**dict(session.headers), **app_json_headers()}
            return session.get(url, headers=h, timeout=45)

        r = refresh_on_auth_error(_call)
        r.raise_for_status()
        return normalize_fegw_detail_response(r.json())

    payload = {
        "guestyId": False,
        "reservationId": reservation_id,
        "userId": user_id,
        "version": 3,
    }

    def _call():
        return session.post(GET_RESERVATION_DETAIL_URL, json=payload, timeout=45)

    r = refresh_on_auth_error(_call)
    r.raise_for_status()
    js = r.json()

    if not js.get("success"):
        raise RuntimeError(f"G4H API failure: {js}")

    return js


def _update_reservation_in_db(reservation_data: Dict[str, Any]) -> None:
    """
    Update reservation data in DynamoDB using centralized model
    ALWAYS updates the reservation, even if canceled (to keep status in sync)
    """
    reservation = reservation_data.get("reservation", {}).get("reservation", {})
    if not reservation:
        return

    reservation_id = reservation.get("reservationId")
    if not reservation_id:
        return

    # Get existing reservation to preserve customFields
    existing_reservation = get(f"RESERVATION#{reservation_id}", "META")
    existing_custom_fields = {}
    existing_last_custom_update = None
    if existing_reservation:
        existing_custom_fields = existing_reservation.get("customFields", {})
        existing_last_custom_update = existing_reservation.get("lastCustomUpdate")
        print(f"Preserving existing customFields for reservation {reservation_id}")

    from common.models import create_reservation_from_g4h

    merged = merge_legacy_raw_for_update(
        existing_reservation.get("rawData") if existing_reservation else None,
        reservation,
    )
    updated_reservation = create_reservation_from_g4h(merged, existing_custom_fields)

    app_raw = reservation_data.get("_guestyApp")
    if app_raw is not None:
        updated_reservation["rawDataGuestyApp"] = app_raw

    if existing_last_custom_update:
        updated_reservation["lastCustomUpdate"] = existing_last_custom_update

    updated_reservation["lastGuestySync"] = now_ms()

    # Use centralized conversion for DynamoDB compatibility
    put(convert_to_decimal(updated_reservation))

    status = reservation.get("status")
    is_deleted = reservation.get("isDeleted", 0)
    print(f"Reservation {reservation_id} updated in DB (status: {status}, isDeleted: {is_deleted})")


def _download_and_encode_document(s3_key: str) -> Optional[str]:
    """Download document from S3 and encode as base64"""
    try:
        # Extract bucket and key from S3 URL
        if s3_key.startswith("s3://"):
            parts = s3_key[5:].split("/", 1)
            bucket = parts[0]
            key = parts[1]
        else:
            print(f"Invalid S3 key format: {s3_key}")
            return None

        # Download file from S3
        response = s3_client.get_object(Bucket=bucket, Key=key)
        file_data = response['Body'].read()

        # Encode as base64
        encoded_data = base64.b64encode(file_data).decode('utf-8')
        print(f"Successfully downloaded and encoded document from {s3_key}")
        return encoded_data

    except Exception as e:
        print(f"Error downloading document from {s3_key}: {str(e)}")
        return None


def _get_checkin_record(reservation_id: str) -> Optional[Dict[str, Any]]:
    """Get check-in record from reservation customFields"""
    print(f"Getting check-in record for reservation {reservation_id}")

    reservation = get(f"RESERVATION#{reservation_id}", "META")
    if not reservation:
        print(f"No reservation found for ID {reservation_id}")
        return None

    custom_fields = reservation.get("customFields", {})
    print(f"Custom fields for reservation {reservation_id}: {custom_fields}")

    checkin_data = custom_fields.get("checkin", {})
    print(f"Found custom fields for reservation {reservation_id}: checkin data exists = {bool(checkin_data)}")

    # Return None if checkin data is empty or in initial state
    if not checkin_data or checkin_data.get("status") == "pending":
        print(f"Check-in data is empty or pending for reservation {reservation_id}, status: {checkin_data.get('status') if checkin_data else 'None'}")
        return None

    # Download and encode documents if they exist
    documents = checkin_data.get("documents", [])
    if documents:
        print(f"Processing {len(documents)} documents for reservation {reservation_id}")
        for doc in documents:
            s3_key = doc.get("s3Key")
            if s3_key:
                encoded_data = _download_and_encode_document(s3_key)
                if encoded_data:
                    doc["fileData"] = encoded_data
                    # Also determine file extension from S3 key for frontend
                    if "." in s3_key:
                        doc["fileExtension"] = s3_key.split(".")[-1].lower()

    # Add reservation ID for compatibility
    checkin_data["reservationId"] = reservation_id

    # Add booking source information if available
    booking_source = reservation.get("bookingSource")
    if booking_source:
        checkin_data["bookingSource"] = booking_source
        checkin_data["bookingSourceDisplay"] = get_booking_source_display_name(booking_source)

    return checkin_data


def _create_or_update_checkin_record(reservation_id: str, checkin_data: Dict[str, Any]) -> None:
    """Create or update check-in record in reservation customFields"""
    current_time = now_ms()

    # Get existing reservation
    reservation = get(f"RESERVATION#{reservation_id}", "META")
    if not reservation:
        print(f"Warning: Reservation {reservation_id} not found when updating check-in")
        return

    # Get existing custom fields
    custom_fields = reservation.get("customFields", {})
    existing_checkin = custom_fields.get("checkin", {})

    # Update check-in data
    updated_checkin = {
        "status": checkin_data.get("status", "completed"),
        "submittedAt": current_time,
        "createdAt": existing_checkin.get("createdAt", current_time),
        "updatedAt": current_time,
        "mainGuestFirstname": checkin_data.get("firstName", ""),
        "mainGuestLastname": checkin_data.get("lastName", ""),
        "mainGuestEmail": checkin_data.get("email", ""),
        "mainGuestPhoneNumber": checkin_data.get("phone", ""),
        "documents": existing_checkin.get("documents", []),
        "validationResults": existing_checkin.get("validationResults", {
            "documentsValid": True,
            "identityVerified": True,
            "validatedAt": current_time
        }),
        "accessNotificationFunctionScheduled": checkin_data.get("accessNotificationFunctionScheduled", False),
        # Preserve any existing fields
        **{k: v for k, v in existing_checkin.items() if k not in [
            "status", "submittedAt", "updatedAt", "mainGuestFirstname", "mainGuestLastname",
            "mainGuestEmail", "mainGuestPhoneNumber",
        ]}
    }

    # Add document if ID card was uploaded
    if checkin_data.get("idCardUrl"):
        document = {
            "type": "id",
            "fileName": f"idCard_{current_time}",
            "s3Key": checkin_data["idCardUrl"],
            "uploadedAt": current_time
        }
        updated_checkin["documents"] = [document]

    # Update custom fields
    custom_fields["checkin"] = updated_checkin
    reservation["customFields"] = custom_fields
    reservation["lastCustomUpdate"] = current_time
    reservation["updatedAt"] = current_time

    # Save updated reservation
    put(reservation)


def _upload_file_to_s3(reservation_id: str, file_data: bytes, file_extension: str) -> str:
    """Upload file to S3 and return the URL"""
    timestamp = now_ms()
    file_key = f"private/reservations/{reservation_id}/idCard/{timestamp}.{file_extension}"
    
    # Upload to S3
    s3_client.put_object(
        Bucket=BUCKET_NAME,
        Key=file_key,
        Body=file_data,
        ContentType=f"image/{file_extension}",
        ServerSideEncryption="AES256"
    )
    
    return f"s3://{BUCKET_NAME}/{file_key}"


def _schedule_access_notification_trigger(reservation_id: str, checkin_time_ms: int) -> bool:
    """
    Schedule access notification as a one-time EventBridge Scheduler schedule.
    Uses one schedule per reservation so each booking keeps its own trigger time.
    If that time is already past, schedule for 5 minutes from now.
    Returns True on successful scheduling, False otherwise.
    """
    current_time_ms = now_ms()

    # Convert check-in to aware datetimes
    dt_checkin_utc = datetime.fromtimestamp(checkin_time_ms / 1000, tz=timezone.utc)
    berlin = ZoneInfo("Europe/Berlin")
    dt_checkin_berlin = dt_checkin_utc.astimezone(berlin)

    # Target trigger: day before check-in at 14:00 Berlin time
    day_before = dt_checkin_berlin.date() - timedelta(days=1)
    trigger_local = datetime(day_before.year, day_before.month, day_before.day, 14, 0, 0, tzinfo=berlin)
    trigger_utc = trigger_local.astimezone(timezone.utc)
    trigger_time_ms = int(trigger_utc.timestamp() * 1000)

    # If already past (inside 24h or late creation), schedule for 10 minutes from now
    if trigger_time_ms <= current_time_ms:
        trigger_time_ms = current_time_ms + 5 * 60 * 1000
        print(f"Check-in within 24h (or trigger past). Scheduling in 5 minutes for {reservation_id}.")
    else:
        print(f"Scheduling access notification for {reservation_id} at local 14:00 day-before (Berlin).")

    # Only schedule if trigger time is in the future
    if trigger_time_ms <= current_time_ms:
        print(f"Door access trigger time has passed for reservation {reservation_id}, not scheduling")
        return False

    try:
        schedule_name = f"access-notification-{reservation_id}"
        trigger_dt = datetime.fromtimestamp(trigger_time_ms / 1000, tz=timezone.utc)
        schedule_expression = f"at({trigger_dt.strftime('%Y-%m-%dT%H:%M:%S')})"

        # Resolve target Lambda ARN and Scheduler execution role ARN.
        cf_client = boto3.client('cloudformation')
        env_name = os.environ.get('ENVIRONMENT', 'prod')
        access_notification_function_arn = None
        scheduler_role_arn = None

        try:
            exports = cf_client.list_exports()
            for export in exports.get('Exports', []):
                if export['Name'] == f"harmonest-{env_name}-access-notification-function-arn":
                    access_notification_function_arn = export['Value']
                elif export['Name'] == f"harmonest-{env_name}-access-notification-scheduler-role-arn":
                    scheduler_role_arn = export['Value']
        except Exception as cf_error:
            print(f"Error reading CloudFormation exports: {cf_error}")

        region = os.environ.get('AWS_REGION', 'eu-central-1')
        account_id_env = os.environ.get('AWS_ACCOUNT_ID')
        if account_id_env:
            account_id = account_id_env
        else:
            # Fallback to STS if env not provided
            account_id = boto3.client('sts').get_caller_identity()['Account']

        if not access_notification_function_arn:
            access_notification_function_arn = (
                f"arn:aws:lambda:{region}:{account_id}:function:"
                f"harmonest-{env_name}-lambda_access_notification"
            )

        if not scheduler_role_arn:
            scheduler_role_arn = (
                f"arn:aws:iam::{account_id}:role/"
                f"harmonest-{env_name}-scheduler-access-notification-role"
            )

        schedule_payload = {
            "Name": schedule_name,
            "ScheduleExpression": schedule_expression,
            "FlexibleTimeWindow": {"Mode": "OFF"},
            "Target": {
                "Arn": access_notification_function_arn,
                "RoleArn": scheduler_role_arn,
                "Input": json.dumps({
                    "detail": {
                        "reservationId": reservation_id,
                        "triggerType": "scheduled",
                        "scheduledTime": trigger_time_ms
                    }
                })
            },
            "Description": f"one-time access notification for reservation {reservation_id}",
            "State": "ENABLED",
        }

        # Replace any previous schedule for the same reservation to keep one active trigger.
        try:
            scheduler_client.delete_schedule(Name=schedule_name)
            print(f"Deleted existing access notification schedule for reservation {reservation_id}")
        except ClientError as delete_error:
            error_code = delete_error.response.get("Error", {}).get("Code")
            if error_code not in ("ResourceNotFoundException", "ValidationException"):
                raise

        try:
            scheduler_client.create_schedule(
                **schedule_payload,
                ActionAfterCompletion="DELETE"
            )
        except ParamValidationError:
            # Older boto3/botocore builds may not expose ActionAfterCompletion yet.
            scheduler_client.create_schedule(**schedule_payload)

        print(f"Access notification trigger scheduled successfully for reservation {reservation_id} at {trigger_time_ms}")
        return True

    except Exception as e:
        print(f"Error scheduling door access trigger for reservation {reservation_id}: {e}")
        print(f"(Fallback) Logged intended schedule time {trigger_time_ms}")
        return False

def _create_response(status_code: int, success: bool, message: str, data: Optional[Dict] = None, error_code: Optional[str] = None) -> Dict[str, Any]:
    """Create standardized API response (JSON-safe, handles Decimal/bytes)."""
    payload = {
        "success": success,
        "message": message,
        "data": data or {},
        "errorCode": error_code,
        "timestamp": now_ms()
    }
    # Make everything JSON serializable in one place
    safe_payload = _to_jsonable(payload)

    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        "body": json.dumps(safe_payload)
    }


def _normalize_guest_name_whitespace(s: str) -> str:
    return " ".join((s or "").split()).lower()


def _guest_name_row_has_parts(row: Optional[Dict[str, Any]]) -> bool:
    if not row:
        return False
    return bool(
        (str(row.get("guestName") or "").strip()) or (str(row.get("guestSurname") or "").strip())
    )


def _guest_hint_matches_reservation(typed_name: str, reservation_row: Dict[str, Any]) -> bool:
    """
    True if normalized typed_name is contained in the booking guest full name
    (guestName + guestSurname). Case- and extra-whitespace-insensitive.
    """
    needle = _normalize_guest_name_whitespace(typed_name)
    if len(needle) < 2:
        return False
    first = str((reservation_row or {}).get("guestName") or "").strip()
    last = str((reservation_row or {}).get("guestSurname") or "").strip()
    hay = _normalize_guest_name_whitespace(f"{first} {last}".strip())
    if not hay:
        return False
    return needle in hay


def validate_reservation(event: Dict[str, Any]) -> Dict[str, Any]:
    """Validate reservation code and guest name (name hint must match part of the booking guest name)."""
    try:
        body = json.loads(event.get("body", "{}"))
        reservation_code = body.get("reservationCode", "").strip()
        guest_name_hint = (body.get("guestName") or body.get("guestFirstName") or "").strip()

        if not reservation_code or not guest_name_hint:
            return _create_response(
                400, False,
                "Reservation code and guest name are required",
                error_code=ERROR_MISSING_REQUIRED_FIELDS
            )

        # Get reservation from database by reservation code
        reservation = _get_reservation_by_code(reservation_code)
        if not reservation:
            return _create_response(
                404, False,
                "Reservation not found. If you have recently booked, please wait for 15 minutes for system update.",
                error_code=ERROR_RESERVATION_NOT_FOUND
            )

        # Get reservation ID from the found reservation
        reservation_id = reservation.get("reservationId")
        if not reservation_id:
            return _create_response(
                500, False,
                "Invalid reservation data",
                error_code=ERROR_INTERNAL_ERROR
            )

        # Fetch latest guest name from G4H, then validate hint before writing to DB
        session, user_id = get_client()
        latest_data = _fetch_latest_reservation_status(session, user_id, reservation_id)
        reservation_detail = latest_data.get("reservation", {}).get("reservation", {}) or {}
        name_src = reservation_detail if _guest_name_row_has_parts(reservation_detail) else reservation

        if not _guest_hint_matches_reservation(guest_name_hint, name_src):
            return _create_response(
                400, False,
                "Guest name does not match reservation",
                error_code=ERROR_INVALID_GUEST_NAME
            )

        _update_reservation_in_db(latest_data)

        # Check reservation status
        status = reservation_detail.get("status")

        if status == 0:  # Canceled
            return _create_response(
                400, False,
                "This reservation has been canceled",
                error_code=ERROR_RESERVATION_CANCELED
            )

#         if status != 1:  # Not active
#             return _create_response(
#                 400, False,
#                 "This reservation is not active",
#                 error_code=ERROR_RESERVATION_CANCELED
#             )

        # Get check-in time and apply default if needed
        checkin_time = reservation_detail.get("checkInDateWithTime") or reservation_detail.get("checkInDate")
        if checkin_time:
            # Convert Decimal to int if needed (DynamoDB returns Decimal objects)
            if isinstance(checkin_time, Decimal):
                checkin_time = int(checkin_time)
            checkin_time = _get_default_checkin_time(checkin_time)

        # Get existing check-in record if any
        checkin_record = _get_checkin_record(reservation_id)

        # Check if check-in deadline has passed (configurable hours before check-in)
        # Only apply deadline check for completed check-ins
        skipp = False
        if checkin_record and checkin_record.get("status") == STATUS_COMPLETED and checkin_time and skipp:
            config = get_client_config()
            deadline_hours = config.get_feature_config("checkin").get("deadlineHours", 25)
            deadline = checkin_time - (deadline_hours * 60 * 60 * 1000)
            if now_ms() > deadline:
                return _create_response(
                    400, False,
                    f"Check-in deadline has passed ({deadline_hours} hours before check-in)",
                    error_code=ERROR_CHECKIN_DEADLINE_PASSED
                )

        # Create pending check-in record if it doesn't exist
        # Keep reservation info for display, user will provide their current info
        if not checkin_record:
            checkin_data = {
                # User-provided information (empty initially)
                "firstName": "",  # User will provide actual info
                "lastName": "",   # User will provide actual info
                "email": "",      # User will provide actual info
                "phone": "",      # User will provide actual info
                "idCardUrl": "",

                # Reservation reference
                "reservationCode": reservation_code,  # Add reservation code

                # Original reservation information (for display/reference)
                "reservationFirstName": reservation_detail.get("guestName", ""),
                "reservationLastName": reservation_detail.get("guestSurname", ""),
                "reservationEmail": reservation_detail.get("email", ""),
                "reservationPhone": reservation_detail.get("phoneNumber", ""),

                # Status and metadata
                "status": STATUS_PENDING,
                "reservationStatus": reservation_detail.get("status"),
                "canUpdateUntil": checkin_time - (25 * 60 * 60 * 1000) if checkin_time else 0,
                "accessNotificationFunctionScheduled": False,
            }

            _create_or_update_checkin_record(reservation_id, checkin_data)
            checkin_record = checkin_data
        print(f"Reservation validated successfully for {reservation_id}")
        return _create_response(
            200, True,
            "Reservation validated successfully. Please provide your current guest information.",
            data={
                "reservation": {
                    "reservationCode": reservation_code,
                    "reservationId": reservation_id,
                    "checkInDate": checkin_time,
                    "checkOutDate": reservation_detail.get("checkOutDateWithTime") or reservation_detail.get("checkOutDate"),
                    "roomName": reservation_detail.get("roomName"),
                    "roomAlias": reservation_detail.get("roomAlias"),
                    # Original reservation guest information (for display)
                    "originalGuestName": reservation_detail.get("guestName"),
                    "originalGuestSurname": reservation_detail.get("guestSurname"),
                    "originalEmail": reservation_detail.get("email"),
                    "originalPhoneNumber": reservation_detail.get("phoneNumber"),
                },
                "checkin": {
                    "exists": True,
                    "status": checkin_record.get("status"),
                    "canUpdate": checkin_record.get("canUpdateUntil", 0) > now_ms(),
                    "requiresGuestInfo": True,  # Frontend should collect guest information
                    # Current check-in information (if any)
                    "currentFirstName": checkin_record.get("mainGuestFirstname", ""),
                    "currentLastName": checkin_record.get("mainGuestLastname", ""),
                    "currentEmail": checkin_record.get("mainGuestEmail", ""),
                    "currentPhone": checkin_record.get("mainGuestPhoneNumber", ""),
                    "documents": checkin_record.get("documents", []),
                }
            }
        )

    except Exception as e:
        print(f"Error in validate_reservation: {str(e)}")
        return _create_response(
            500, False,
            "Internal server error",
            error_code=ERROR_INTERNAL_ERROR
        )


def submit_checkin(event: Dict[str, Any]) -> Dict[str, Any]:
    """Submit complete check-in information"""
    try:
        body = json.loads(event.get("body", "{}"))

        # Required fields
        reservation_code = body.get("reservationCode", "").strip()
        first_name = body.get("firstName", "").strip()
        last_name = body.get("lastName", "").strip()
        email = body.get("email", "").strip()
        phone = body.get("phone", "").strip()
        id_card_file = body.get("idCardFile", "")  # Base64 encoded
        file_extension = body.get("fileExtension", "jpg").lower()

        # Validate required fields
        if not all([reservation_code, first_name, last_name, email, phone, id_card_file]):
            return _create_response(
                400, False,
                "All fields are required: reservationCode, firstName, lastName, email, phone, idCardFile",
                error_code=ERROR_MISSING_REQUIRED_FIELDS
            )

        # Validate email format
        if not _validate_email(email):
            return _create_response(
                400, False,
                "Invalid email format",
                error_code=ERROR_INVALID_FILE
            )

        # Validate phone format
        if not _validate_phone(phone):
            return _create_response(
                400, False,
                "Invalid phone number format",
                error_code=ERROR_INVALID_FILE
            )

        # Get reservation from database by reservation code
        reservation = _get_reservation_by_code(reservation_code)
        if not reservation:
            return _create_response(
                404, False,
                "Reservation not found",
                error_code=ERROR_RESERVATION_NOT_FOUND
            )

        # Get reservation ID from the found reservation
        reservation_id = reservation.get("reservationId")
        if not reservation_id:
            return _create_response(
                500, False,
                "Invalid reservation data",
                error_code=ERROR_INTERNAL_ERROR
            )

        # Get check-in time and apply default if needed
        checkin_time = reservation.get("checkInDateWithTime") or reservation.get("checkInDate")
        if checkin_time:
            # Convert Decimal to int if needed (DynamoDB returns Decimal objects)
            if isinstance(checkin_time, Decimal):
                checkin_time = int(checkin_time)
            checkin_time = _get_default_checkin_time(checkin_time)

        # Check if updates are still allowed (configurable hours before check-in)
        # Only apply deadline check for completed check-ins
        existing_checkin = _get_checkin_record(reservation_id)
        if existing_checkin and existing_checkin.get("status") == STATUS_COMPLETED and checkin_time:
            config = get_client_config()
            deadline_hours = config.get_feature_config("checkin").get("deadlineHours", 25)
            deadline = checkin_time - (deadline_hours * 60 * 60 * 1000)
            if now_ms() > deadline:
                return _create_response(
                    400, False,
                    f"Check-in deadline has passed ({deadline_hours} hours before check-in)",
                    error_code=ERROR_CHECKIN_DEADLINE_PASSED
                )

        # Decode and validate file
        try:
            file_data = base64.b64decode(id_card_file)
        except Exception:
            return _create_response(
                400, False,
                "Invalid file encoding",
                error_code=ERROR_INVALID_FILE
            )

        if not _validate_image_file(file_data):
            return _create_response(
                400, False,
                "Invalid image file. Please upload a valid image (JPEG, PNG, GIF, WebP) under 5MB",
                error_code=ERROR_INVALID_FILE
            )

        # Upload file to S3
        file_url = _upload_file_to_s3(reservation_id, file_data, file_extension)
        # Schedule access notification trigger if check-in time is available
        access_notification_function_Scheduled = False
        if checkin_time:
            access_notification_function_Scheduled = _schedule_access_notification_trigger(reservation_id, checkin_time)
        # Create/update check-in record
        checkin_data = {
            # User-provided current information
            "firstName": first_name,
            "lastName": last_name,
            "email": email,
            "phone": phone,
            "idCardUrl": file_url,
            "checkinTime": checkin_time,
            "checkoutTime": reservation.get("checkOutDateWithTime") or reservation.get("checkOutDate"),
            "roomName": reservation.get("roomName"),
            # Reservation reference
            "reservationCode": reservation_code,  # Add reservation code

            # Original reservation information (preserved)
            "reservationFirstName": reservation.get("guestName", ""),
            "reservationLastName": reservation.get("guestSurname", ""),
            "reservationEmail": reservation.get("email", ""),
            "reservationPhone": reservation.get("phoneNumber", ""),

            # Status and metadata
            "status": STATUS_COMPLETED,
            "reservationStatus": reservation.get("status"),
            "canUpdateUntil": checkin_time - (25 * 60 * 60 * 1000) if checkin_time else 0,
            "accessNotificationFunctionScheduled": access_notification_function_Scheduled
        }


        _create_or_update_checkin_record(reservation_id, checkin_data)

        # Send check-in completion email to guest
        try:
            email_sent = send_checkin_completion_email(reservation, checkin_data)
            if email_sent:
                print(f"Check-in completion email sent successfully to {email}")
            else:
                print(f"Failed to send check-in completion email to {email}")
        except Exception as email_error:
            print(f"Error sending check-in completion email: {str(email_error)}")


        return _create_response(
            200, True,
            "Check-in completed successfully",
            data={
                "reservationCode": reservation_code,
                "reservationId": reservation_id,
                "status": STATUS_COMPLETED,
                "message": "Your check-in has been completed. You will receive your access code 24 hours before your check-in date."
            }
        )

    except Exception as e:
        print(f"Error in submit_checkin: {str(e)}")
        return _create_response(
            500, False,
            "Internal server error",
            error_code=ERROR_INTERNAL_ERROR
        )


def get_status(event: Dict[str, Any]) -> Dict[str, Any]:
    """Get check-in status for a reservation"""
    try:
        # Get reservation code from query parameters
        query_params = event.get("queryStringParameters") or {}
        reservation_code = query_params.get("reservationCode", "").strip()

        if not reservation_code:
            return _create_response(
                400, False,
                "Reservation code is required",
                error_code=ERROR_MISSING_REQUIRED_FIELDS
            )

        # Get reservation from database by reservation code
        reservation = _get_reservation_by_code(reservation_code)
        if not reservation:
            return _create_response(
                404, False,
                "Reservation not found. If you have recently booked, please wait for 15 minutes for system update.",
                error_code=ERROR_RESERVATION_NOT_FOUND
            )

        # Get reservation ID from the found reservation
        reservation_id = reservation.get("reservationId")
        if not reservation_id:
            return _create_response(
                500, False,
                "Invalid reservation data",
                error_code=ERROR_INTERNAL_ERROR
            )

        # Get check-in record
        checkin_record = _get_checkin_record(reservation_id)

        if not checkin_record:
            return _create_response(
                200, True,
                "No check-in record found",
                data={
                    "reservationCode": reservation_code,
                    "reservationId": reservation_id,
                    "status": None,
                    "hasCheckedIn": False
                }
            )

        return _create_response(
            200, True,
            "Check-in status retrieved successfully",
            data={
                "reservationCode": reservation_code,
                "reservationId": reservation_id,
                "status": checkin_record.get("status"),
                "hasCheckedIn": True,
                "firstName": checkin_record.get("mainGuestFirstname"),
                "lastName": checkin_record.get("mainGuestLastname"),
                "email": checkin_record.get("mainGuestEmail"),
                "phone": checkin_record.get("mainGuestPhoneNumber"),
                "canUpdate": True,  # Can be updated through frontend now
                "submittedAt": checkin_record.get("submittedAt"),
                "documents": checkin_record.get("documents", []),
                "accessNotificationFunctionScheduled": checkin_record.get("accessNotificationFunctionScheduled", False)
            }
        )

    except Exception as e:
        print(f"Error in get_status: {str(e)}")
        return _create_response(
            500, False,
            "Internal server error",
            error_code=ERROR_INTERNAL_ERROR
        )


def handler(event, context):
    """Main Lambda handler"""
    try:
        # Check if checkin feature is enabled
        if not is_feature_enabled("checkin"):
            return _create_response(
                503, False,
                "Check-in feature is currently disabled",
                error_code="FEATURE_DISABLED"
            )

        http_method = event.get("httpMethod", "")
        path = event.get("path", "")

        print(f"Received {http_method} request to {path}")

        # Handle different operations based on query parameters or body
        if http_method == "POST":
            body = json.loads(event.get("body", "{}"))
            operation = body.get("operation", "validate")

            if operation == "validate":
                return validate_reservation(event)
            elif operation == "submit":
                return submit_checkin(event)
            else:
                return _create_response(
                    400, False,
                    f"Unknown operation: {operation}. Supported operations: validate, submit"
                )

        elif http_method == "GET":
            return get_status(event)

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
