"""
Access Notification Lambda Function
Complete door access notification system following the 6-step task flow:
1. Check latest reservation status on Guesty and update DB
2. Check preferred notification type if still active
3. Get listing from DB (doors, address, info4guest, etc.)
4. Create door accesses (QR codes/PINs) based on doors list
5. Create notification templates (email with full details, SMS with link)
6. Store all access info in DB
"""
import json
import os
import urllib.parse
from typing import Dict, Any, Optional, List
from common.ddb import get, put, now_ms
from common.g4h import get_client, refresh_on_auth_error
from common.guesty_adapters import (
    use_guesty_app_api,
    normalize_fegw_detail_response,
    G4H_APP_BASE,
    app_json_headers,
    merge_legacy_raw_for_update,
)
from common.config import get_client_config
from common.models import convert_to_decimal, get_booking_source_display_name, create_reservation_from_g4h
from door_access_manager import generate_qr_code, generate_pin_code
from email_service import send_door_access_email, create_qr_attachment
from sms_service_simple import send_combined_access_sms
from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

# Constants
BASE = "https://api.guestyforhosts.com"
GET_RESERVATION_DETAIL_URL = f"{BASE}/getReservationDetailById"

# Environment variables
ENVIRONMENT = os.environ.get("ENVIRONMENT", "prod")

# Error codes
ERROR_RESERVATION_NOT_FOUND = "RESERVATION_NOT_FOUND"
ERROR_RESERVATION_CANCELED = "RESERVATION_CANCELED"
ERROR_INTERNAL_ERROR = "INTERNAL_ERROR"

# Using centralized convert_to_decimal from common.models

def _check_if_already_scheduled(reservation_id: str) -> bool:
    """Check if access notification has already been scheduled for this reservation"""
    try:
        reservation = get(f"RESERVATION#{reservation_id}", "META")
        if not reservation:
            return False

        # Check the new accessNotificationScheduled field
        custom_fields = reservation.get("customFields", {})
        door_accesses = custom_fields.get("doorAccesses", {})

        already_scheduled = door_accesses.get("accessNotificationScheduled", False)
        if already_scheduled:
            scheduled_at = door_accesses.get("accessNotificationScheduledAt")
            print(f"Access notification already scheduled for reservation {reservation_id} at {scheduled_at}")
            return True

        return False

    except Exception as e:
        print(f"Error checking if access notification already scheduled: {str(e)}")
        return False


def _mark_access_notification_scheduled(reservation_id: str) -> bool:
    """Mark access notification as scheduled in the reservation"""
    try:
        reservation = get(f"RESERVATION#{reservation_id}", "META")
        if not reservation:
            return False

        # Update the accessNotificationScheduled fields
        custom_fields = reservation.get("customFields", {})
        if "doorAccesses" not in custom_fields:
            custom_fields["doorAccesses"] = {}

        custom_fields["doorAccesses"]["accessNotificationScheduled"] = True
        custom_fields["doorAccesses"]["accessNotificationScheduledAt"] = now_ms()

        reservation["customFields"] = custom_fields
        reservation["lastCustomUpdate"] = now_ms()

        # Use centralized conversion for DynamoDB compatibility
        put(convert_to_decimal(reservation))

        print(f"Marked access notification as scheduled for reservation {reservation_id}")
        return True

    except Exception as e:
        print(f"Error marking access notification as scheduled: {str(e)}")
        return False


def _create_response(status_code: int, success: bool, message: str, data: Optional[Dict[str, Any]] = None, error_code: Optional[str] = None) -> Dict[str, Any]:
    """Create standardized API response"""
    response = {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Content-Type": "application/json"
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
        raise RuntimeError(f"Guesty API failure: {js}")

    return js


def _step1_sync_reservation_from_guesty(reservation_id: str) -> Dict[str, Any]:
    """
    STEP 1: Check latest reservation status on Guesty and update our DB
    ALWAYS updates the reservation in DB, even if canceled (to keep status in sync)
    Returns: {"success": bool, "reservation": dict, "response": dict}
    """
    try:
        # Get Guesty session
        session, user_id = get_client()

        # Fetch latest data from Guesty
        latest_data = _fetch_latest_reservation_status(session, user_id, reservation_id)
        reservation_detail = latest_data.get("reservation", {}).get("reservation", {})
        app_raw = latest_data.get("_guestyApp")
        status = reservation_detail.get("status")
        is_deleted = reservation_detail.get("isDeleted", 0)

        existing_reservation = get(f"RESERVATION#{reservation_id}", "META")
        if not existing_reservation:
            return {
                "success": False,
                "response": _create_response(
                    404,
                    False,
                    f"Reservation not found in local database: {reservation_id}",
                    error_code=ERROR_RESERVATION_NOT_FOUND,
                ),
            }

        existing_custom_fields = existing_reservation.get("customFields", {})

        merged = merge_legacy_raw_for_update(
            existing_reservation.get("rawData"),
            reservation_detail,
        )
        updated_reservation = create_reservation_from_g4h(merged, existing_custom_fields)

        if app_raw is not None:
            updated_reservation["rawDataGuestyApp"] = app_raw

        updated_reservation["lastCustomUpdate"] = existing_reservation.get("lastCustomUpdate")
        updated_reservation["guestyStatus"] = status
        updated_reservation["lastGuestySync"] = now_ms()

        put(convert_to_decimal(updated_reservation))

        print(
            f"Reservation {reservation_id} synced from Guesty (status: {status}, isDeleted: {is_deleted}) - customFields preserved"
        )

        if status == 0 or is_deleted == 1:
            return {
                "success": False,
                "reservation": updated_reservation,
                "response": _create_response(
                    400,
                    False,
                    "Cannot generate door access: reservation has been canceled in Guesty",
                    error_code=ERROR_RESERVATION_CANCELED,
                ),
            }

        return {"success": True, "reservation": updated_reservation}

    except Exception as e:
        print(f"Error in step 1 - Guesty sync: {str(e)}")
        return {
            "success": False,
            "response": _create_response(
                500, False,
                f"Failed to sync reservation from Guesty: {str(e)}",
                error_code=ERROR_INTERNAL_ERROR
            )
        }


def process_access_notification(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main function to process complete access notification following 6-step task flow:
    1. Check latest reservation status on Guesty and update DB
    2. Check preferred notification type if still active
    3. Get listing from DB (doors, address, info4guest, etc.)
    4. Create door accesses (QR codes/PINs) based on doors list
    5. Create notification templates (email with full details, SMS with link)
    6. Store all access info in DB
    """
    try:
        # Parse event data
        if "detail" in event:
            detail = event["detail"]
            reservation_id = detail.get("reservationId")
        else:
            body = json.loads(event.get("body", "{}"))
            reservation_id = body.get("reservationId")

        if not reservation_id:
            return _create_response(
                400, False,
                "Reservation ID is required",
                error_code=ERROR_RESERVATION_NOT_FOUND
            )

        print(f"Starting 6-step access notification process for reservation: {reservation_id}")

        # STEP 0: Check if access notification has already been scheduled
        if _check_if_already_scheduled(reservation_id):
            return _create_response(
                200, True,
                f"Access notification already scheduled for reservation {reservation_id}",
                data={"reservationId": reservation_id, "status": "already_scheduled"}
            )

        # STEP 1: Check latest reservation status on Guesty and update DB
        print("STEP 1: Checking latest reservation status on Guesty and updating DB")
        reservation_data = _step1_sync_reservation_from_guesty(reservation_id)
        if not reservation_data["success"]:
            return reservation_data["response"]

        reservation = reservation_data["reservation"]

        # STEP 2: Check preferred notification type if still active
        print("STEP 2: Checking preferred notification type")
        notification_data = _step2_get_notification_preference(reservation_id)
        if not notification_data["success"]:
            return notification_data["response"]

        preferred_notification = notification_data["preferred_notification"]
        guest_info = notification_data["guest_info"]

        # STEP 3: Get listing from DB
        print("STEP 3: Getting listing from DB")
        listing_data = _step3_get_listing_info(reservation)
        if not listing_data["success"]:
            return listing_data["response"]

        listing = listing_data["listing"]

        # STEP 4: Create door accesses based on doors list
        print("STEP 4: Creating door accesses based on doors list")
        access_data = _step4_create_door_accesses(reservation, guest_info, listing)
        if not access_data["success"]:
            return access_data["response"]

        door_accesses = access_data["door_accesses"]
        checkin_time = access_data["checkin_time"]
        checkout_time = access_data["checkout_time"]
        print(f"Generated door access codes:{door_accesses}")
        # STEP 5: Create notification templates
        print("STEP 5: Creating notification templates")
        notification_result = _step5_send_notification(
            preferred_notification, guest_info, listing, door_accesses, checkin_time, checkout_time
        )
        if not notification_result["success"]:
            return notification_result["response"]

        # STEP 6: Store all access info in DB
        print("STEP 6: Storing all access info in DB")
        storage_result = _step6_store_access_info(reservation_id, door_accesses, notification_result["sent"])
        if not storage_result["success"]:
            return storage_result["response"]

        # STEP 7: Mark access notification as scheduled (prevent re-scheduling)
        print("STEP 7: Marking access notification as scheduled")
        _mark_access_notification_scheduled(reservation_id)

        # Success response
        return _create_response(
            200, True,
            f"Access notification completed successfully via {preferred_notification}",
            data={
                "reservationId": reservation_id,
                "notificationType": preferred_notification,
                "doorCount": len(door_accesses),
                "accessTypes": list(set([access["type"] for access in door_accesses])),
                "notificationSent": notification_result["sent"]
            }
        )

    except Exception as e:
        print(f"Error in process_access_notification: {str(e)}")
        return _create_response(
            500, False,
            "Internal server error",
            error_code=ERROR_INTERNAL_ERROR
        )


def resend_access_email_admin(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Admin-only: resend existing door-access email to a (possibly new) email address.
    IMPORTANT:
      - Does NOT generate new access codes.
      - Uses existing customFields.doorAccesses from the reservation.
      - Intended to be invoked only from the authenticated management UI.
    Expected event body:
      {
        "reservationId": "<id>",
        "email": "<target email>",
        "force": true|false  # optional, ignore if missing
      }
    """
    try:
        # Parse input
        if "body" in event and isinstance(event.get("body"), str):
            body = json.loads(event["body"] or "{}")
        else:
            body = event

        reservation_id = body.get("reservationId")
        target_email = (body.get("email") or "").strip()

        if not reservation_id or not target_email:
            return _create_response(
                400,
                False,
                "reservationId and email are required",
                error_code="MISSING_FIELDS",
            )

        print(f"[admin-resend] reservationId={reservation_id}, email={target_email}")

        # Load reservation with existing access data
        reservation = get(f"RESERVATION#{reservation_id}", "META")
        if not reservation:
            return _create_response(
                404,
                False,
                f"Reservation {reservation_id} not found",
                error_code=ERROR_RESERVATION_NOT_FOUND,
            )

        custom_fields = reservation.get("customFields", {})
        door_accesses_info = custom_fields.get("doorAccesses") or {}
        qr_code = door_accesses_info.get("qrCode")
        pin_codes = door_accesses_info.get("pinCodes") or {}
        door_info = (door_accesses_info.get("doorInfo") or {})

        # Rebuild minimal door_accesses list from stored info
        door_accesses: List[Dict[str, Any]] = []
        for qr_door in door_info.get("qr_doors", []):
            # We don't know exact validity timestamps anymore; omit them in template.
            door_accesses.append(
                {
                    "doorName": qr_door.get("name", ""),
                    "doorLocation": qr_door.get("location", ""),
                    "type": "qr_code",
                    "accessCode": qr_code,
                }
            )

        for pin_door in door_info.get("pin_doors", []):
            name = pin_door.get("name")
            if not name:
                continue
            code = pin_codes.get(name)
            if not code:
                continue
            door_accesses.append(
                {
                    "doorName": name,
                    "doorLocation": pin_door.get("location", ""),
                    "type": "pin_code",
                    "accessCode": code,
                }
            )

        if not door_accesses:
            return _create_response(
                400,
                False,
                "No existing door access data to resend",
                error_code="NO_ACCESS_DATA",
            )

        # Build guest+listing context
        listing_id = reservation.get("listingId") or reservation.get("roomId")
        listing = get(f"LISTING#{listing_id}", "META") if listing_id else None
        if not listing:
            return _create_response(
                404,
                False,
                f"Listing not found for reservation {reservation_id}",
                error_code="LISTING_NOT_FOUND",
            )

        # Guest info based on stored reservation
        full_name = f"{reservation.get('guestName', '')} {reservation.get('guestSurname', '')}".strip() or "Guest"
        guest_info = {
            "firstName": reservation.get("guestName", "Guest"),
            "lastName": reservation.get("guestSurname", ""),
            "email": target_email,
            "phone": reservation.get("phoneNumber"),
            "fullName": full_name,
            "bookingSource": reservation.get("bookingSource", "unknown"),
            "bookingSourceDisplay": get_booking_source_display_name(reservation.get("bookingSource", "unknown")),
        }

        # For resend, we always go through email path.
        # Use stored check-in/check-out if present, but they are optional here.
        checkin_time = reservation.get("checkInDateWithTime") or reservation.get("checkInDate") or 0
        checkout_time = reservation.get("checkOutDateWithTime") or reservation.get("checkOutDate") or 0
        try:
            if isinstance(checkin_time, Decimal):
                checkin_time = int(checkin_time)
            if isinstance(checkout_time, Decimal):
                checkout_time = int(checkout_time)
        except Exception:
            pass

        # Reuse the existing notification step for email, but with overridden guest email.
        print(f"[admin-resend] Re-sending door access to {target_email}")
        config = get_client_config()
        frontend_link = f"https://{config.primary_domain}/access"
        listing_cf = listing.get("customFields", {})
        email_data = {
            "guest_name": guest_info["fullName"],
            "listing_name": listing.get("roomName", "Your Accommodation"),
            "address": listing_cf.get("address", ""),
            "info4guest": listing_cf.get("info4guest", ""),
            "contact_person": listing_cf.get("responsiblePerson", ""),
            "door_accesses": door_accesses,
            "frontend_link": frontend_link,
            "qr_images": [],
        }

        for access in door_accesses:
            if access["type"] == "qr_code":
                qr_attachment = create_qr_attachment(
                    access["accessCode"],
                    config.client_display_name,
                    access["doorName"],
                )
                if qr_attachment:
                    email_data["qr_images"].append(qr_attachment)

        sent = send_door_access_email(target_email, email_data, door_accesses, checkin_time, checkout_time)
        if not sent:
            return _create_response(
                500,
                False,
                "Failed to resend door access email",
                error_code="RESEND_FAILED",
            )

        print(f"[admin-resend] Door access email resent successfully to {target_email}")
        return _create_response(
            200,
            True,
            "Door access email resent successfully",
            data={"reservationId": reservation_id, "email": target_email},
        )

    except Exception as e:
        print(f"Error in resend_access_email_admin: {str(e)}")
        return _create_response(
            500,
            False,
            "Internal server error",
            error_code=ERROR_INTERNAL_ERROR,
        )


def handler(event, context):
    """Lambda handler function"""
    try:
        print(f"Received event: {json.dumps(event)}")

        # Handle CORS preflight
        if event.get("httpMethod") == "OPTIONS":
            return {
                "statusCode": 200,
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type,Authorization",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                },
                "body": "",
            }

        # If invoked via API Gateway for admin resend, route by path.
        path = event.get("path") or ""
        http_method = event.get("httpMethod") or ""
        if http_method == "POST" and "/admin/resend-door-access" in path:
            # This path must be wired only behind the management/admin authorizer.
            return resend_access_email_admin(event)

        # Default: scheduled or test access notification
        return process_access_notification(event)

    except Exception as e:
        print(f"Error in handler: {str(e)}")
        return _create_response(
            500, False,
            "Internal server error",
            error_code=ERROR_INTERNAL_ERROR
        )


def _step2_get_notification_preference(reservation_id: str) -> Dict[str, Any]:
    """
    STEP 2: Check preferred notification type if still active
    Returns: {"success": bool, "preferred_notification": str, "guest_info": dict, "response": dict}
    """
    try:
        # Get check-in details
        checkin = get(f"RESERVATION#{reservation_id}", "META")
        if not checkin:
            return {
                "success": False,
                "response": _create_response(
                    404, False,
                    f"RESERVATION record not found: {reservation_id}",
                    error_code="CHECKIN_NOT_FOUND"
                )
            }

        # Extract guest information and preferences
        guest_info = {
            "firstName": checkin.get("customFields", {}).get("checkin", {}).get("mainGuestFirstname", "Guest"),
            "lastName": checkin.get("customFields", {}).get("checkin", {}).get("mainGuestLastname", ""),
            "email": checkin.get("customFields", {}).get("checkin", {}).get("mainGuestEmail"),
            "phone": checkin.get("customFields", {}).get("checkin", {}).get("mainGuestPhoneNumber"),
            "fullName": f"{checkin.get("customFields", {}).get("checkin", {}).get('mainGuestFirstname', 'Guest')} {checkin.get("customFields", {}).get("checkin", {}).get("mainGuestLastname", "")}".strip(),
            # Add booking source information
            "bookingSource": checkin.get("bookingSource", "unknown"),
            "bookingSourceDisplay": get_booking_source_display_name(checkin.get("bookingSource", "unknown"))
        }

        # Determine notification preference
        preferred_notification = checkin.get("customFields", {}).get("checkin", {}).get("notificationPreference", "email")

        # Validate notification preference against available contact info
        if preferred_notification == "email" and not guest_info["email"]:
            return {
                "success": False,
                "response": _create_response(
                    400, False,
                    "Guest email not found and email notification requested",
                    error_code="EMAIL_REQUIRED"
                )
            }

        if preferred_notification == "sms" and not guest_info["phone"]:
            return {
                "success": False,
                "response": _create_response(
                    400, False,
                    "Guest phone not found and SMS notification requested",
                    error_code="PHONE_REQUIRED"
                )
            }

        print(f"Notification preference: {preferred_notification} for guest: {guest_info['fullName']}")
        return {
            "success": True,
            "preferred_notification": preferred_notification,
            "guest_info": guest_info
        }

    except Exception as e:
        print(f"Error in step 2 - notification preference: {str(e)}")
        return {
            "success": False,
            "response": _create_response(
                500, False,
                f"Failed to get notification preference: {str(e)}",
                error_code=ERROR_INTERNAL_ERROR
            )
        }


def _step3_get_listing_info(reservation: Dict[str, Any]) -> Dict[str, Any]:
    """STEP 3: Get listing from DB (doors, address, info4guest, etc.)"""
    try:
        listing_id = reservation.get("listingId") or reservation.get("roomId")
        if not listing_id:
            return {
                "success": False,
                "response": _create_response(400, False, "Listing ID not found in reservation", error_code="LISTING_ID_MISSING")
            }

        listing = get(f"LISTING#{listing_id}", "META")
        if not listing:
            return {
                "success": False,
                "response": _create_response(404, False, f"Listing not found: {listing_id}", error_code="LISTING_NOT_FOUND")
            }

        custom_fields = listing.get("customFields", {})
        doors_list = custom_fields.get("doors", [])
        if not doors_list:
            return {
                "success": False,
                "response": _create_response(404, False, f"No doors configured for listing: {listing_id}", error_code="NO_DOORS_CONFIGURED")
            }

        print(f"Listing loaded: {len(doors_list)} doors configured")
        return {"success": True, "listing": listing}

    except Exception as e:
        print(f"Error in step 3 - get listing: {str(e)}")
        return {
            "success": False,
            "response": _create_response(500, False, f"Failed to get listing: {str(e)}", error_code=ERROR_INTERNAL_ERROR)
        }


def _step4_create_door_accesses(reservation: Dict[str, Any], guest_info: Dict[str, Any], listing: Dict[str, Any]) -> Dict[str, Any]:
    """STEP 4: Create door accesses (QR codes/PINs) based on doors list"""
    try:
        from common.email_utils import send_support_notification_failed_door_access

        roomId = listing.get("roomId", "")
        listing = get(f"LISTING#{roomId}", "META")
        custom_fields = listing.get("customFields", {})
        doors_list = custom_fields.get("doors", [])
        door_accesses = []
        failed_doors = []
        error_details = {}
        config = get_client_config()

        checkin_time_ = reservation.get("checkInDate", 0)
        checkin_time = normalize_checkin(checkin_time_)
        checkout_time_ = reservation.get("checkOutDate", 0)
        checkout_time = normalize_checkout(checkout_time_)
        room_name = reservation.get("roomName") or reservation.get("listingName", "Unknown Room")

        for door_index, door_config in enumerate(doors_list):
            door_name = door_config.get("name", f"Door {door_index + 1}")
            door_type = door_config.get("type", "unknown")
            door_location = door_config.get("location", "")

            print(f"Processing door: {door_name} (type: {door_type})")

            try:
                access_created = False

                if door_type == "qrlock":
                    qr_result = generate_qr_code(door_config, checkin_time, checkout_time)
                    if qr_result:
                        door_accesses.append({
                            "doorIndex": door_index,
                            "doorName": door_name,
                            "doorLocation": door_location,
                            "type": "qr_code",
                            "accessCode": qr_result,
                            "validFrom": checkin_time,
                            "validTo": checkout_time,
                            "doorConfig": door_config,
                            "generatedAt": now_ms()
                        })
                        access_created = True
                    else:
                        error_details[door_name] = "QR code generation failed"

                elif door_type == "ttlock":
                    pin_result = generate_pin_code(
                        door_config, checkin_time, checkout_time,
                        guest_info["fullName"], guest_info.get("phone")
                    )
                    if pin_result:
                        door_accesses.append({
                            "doorIndex": door_index,
                            "doorName": door_name,
                            "doorLocation": door_location,
                            "type": "pin_code",
                            "accessCode": pin_result,
                            "validFrom": checkin_time,
                            "validTo": checkout_time,
                            "doorConfig": door_config,
                            "generatedAt": now_ms()
                        })
                        access_created = True
                    else:
                        error_details[door_name] = "PIN code generation failed"

                # If access creation failed, add to failed doors list
                if not access_created:
                    failed_doors.append(door_config)
                    print(f"❌ Failed to create access for door: {door_name}")

            except Exception as door_error:
                error_msg = str(door_error)
                print(f"Failed to generate access for door {door_name}: {error_msg}")
                failed_doors.append(door_config)
                error_details[door_name] = error_msg
                continue

        # Send support notification if any doors failed
        if failed_doors:
            reservation_id = reservation.get("reservationId", "Unknown")
            print(f"⚠️ Sending support notification for {len(failed_doors)} failed door(s)")

            try:
                notification_sent = send_support_notification_failed_door_access(
                    reservation_id=reservation_id,
                    guest_info=guest_info,
                    listing_info=listing,
                    failed_doors=failed_doors,
                    error_details=error_details
                )
                if notification_sent:
                    print("✅ Support notification sent successfully")
                else:
                    print("❌ Failed to send support notification")
            except Exception as notify_error:
                print(f"❌ Error sending support notification: {str(notify_error)}")

        if not door_accesses:
            return {
                "success": False,
                "response": _create_response(500, False, "Failed to generate any door access codes", error_code="NO_ACCESS_CODES_GENERATED")
            }

        print(f"Generated {len(door_accesses)} door access codes")
        if failed_doors:
            print(f"⚠️ {len(failed_doors)} door(s) failed - support has been notified")

        return {"success": True, "door_accesses": door_accesses, "checkin_time": checkin_time, "checkout_time": checkout_time}

    except Exception as e:
        print(f"Error in step 4 - door accesses: {str(e)}")
        return {
            "success": False,
            "response": _create_response(500, False, f"Failed to create door accesses: {str(e)}", error_code=ERROR_INTERNAL_ERROR)
        }


def _step5_send_notification(preferred_notification: str, guest_info: Dict[str, Any],
                           listing: Dict[str, Any], door_accesses: List[Dict[str, Any]],
                           checkin_time: int, checkout_time: int) -> Dict[str, Any]:
    """STEP 5: Create and send notification templates"""
    try:
        config = get_client_config()
        frontend_link = f"https://{config.primary_domain}/access"
        custom_fields = listing.get("customFields", {})

        if preferred_notification == "email":
            # Create comprehensive email data
            email_data = {
                "guest_name": guest_info["fullName"],
                "listing_name": listing.get("roomName", "Your Accommodation"),
                "address": custom_fields.get("address", ""),
                "info4guest": custom_fields.get("info4guest", ""),
                "contact_person": custom_fields.get("responsiblePerson", ""),
                "door_accesses": door_accesses,
                "frontend_link": frontend_link,
                "qr_images": []
            }

            # Generate QR code images for email attachments
            for access in door_accesses:
                if access["type"] == "qr_code":
                    qr_attachment = create_qr_attachment(
                        access["accessCode"],
                        config.client_display_name,
                        access["doorName"]
                    )
                    if qr_attachment:
                        email_data["qr_images"].append(qr_attachment)

            sent = send_door_access_email(guest_info["email"], email_data, door_accesses, checkin_time, checkout_time)

        elif preferred_notification == "sms":
            # Create short SMS with essential info
            pin_codes = {access["doorName"]: access["accessCode"] for access in door_accesses if access["type"] == "pin_code"}

            sent = send_combined_access_sms(
                guest_info["phone"], guest_info["firstName"],
                None, pin_codes, listing.get("roomName", ""),
                frontend_link, config.client_display_name
            )

        else:
            return {
                "success": False,
                "response": _create_response(400, False, f"Invalid notification type: {preferred_notification}", error_code="INVALID_NOTIFICATION_TYPE")
            }

        return {
            "success": True,
            "sent": sent,
            "response": _create_response(200, True, "Notification processed") if sent else
                       _create_response(500, False, "Notification sending failed", error_code="NOTIFICATION_FAILED")
        }

    except Exception as e:
        print(f"Error in step 5 - notification: {str(e)}")
        return {
            "success": False,
            "response": _create_response(500, False, f"Failed to send notification: {str(e)}", error_code=ERROR_INTERNAL_ERROR)
        }


def _step6_store_access_info(reservation_id: str, door_accesses: List[Dict[str, Any]], notification_sent: bool) -> Dict[str, Any]:
    """STEP 6: Store all access info in reservation customFields.doorAccesses"""
    try:
        # Get existing reservation
        reservation = get(f"RESERVATION#{reservation_id}", "META")
        if not reservation:
            return {
                "success": False,
                "response": _create_response(404, False, f"Reservation {reservation_id} not found", error_code="RESERVATION_NOT_FOUND")
            }

        # Get existing custom fields
        custom_fields = reservation.get("customFields", {})

        # Prepare QR codes and PIN codes
        qr_code = ""
        pin_codes = {}
        door_info = {
            "qr_doors": [],
            "pin_doors": [],
            "total_doors": len(door_accesses)
        }

        for access in door_accesses:
            if access["type"] == "qr_code":
                qr_code = access["accessCode"]  # Use the last QR code if multiple
                door_info["qr_doors"].append({
                    "name": access["doorName"],
                    "location": access.get("doorLocation", ""),
                    "config": access.get("doorConfig", {})
                })
            elif access["type"] == "pin_code":
                pin_codes[access["doorName"]] = access["accessCode"]
                door_info["pin_doors"].append({
                    "name": access["doorName"],
                    "location": access.get("doorLocation", ""),
                    "config": access.get("doorConfig", {})
                })

        # Update door accesses in custom fields
        generation_time = now_ms()
        custom_fields["doorAccesses"] = {
            "qrCode": qr_code,
            "pinCodes": pin_codes,
            "doorInfo": door_info,
            "generatedAt": generation_time,
            "status": "active",
            "usageHistory": custom_fields.get("doorAccesses", {}).get("usageHistory", []),
            # Keep existing scheduling fields if they exist
            "accessNotificationScheduled": custom_fields.get("doorAccesses", {}).get("accessNotificationScheduled", False),
            "accessNotificationScheduledAt": custom_fields.get("doorAccesses", {}).get("accessNotificationScheduledAt")
        }

        # Update check-in to mark QR code as generated
        if "checkin" in custom_fields:
            custom_fields["checkin"]["updatedAt"] = generation_time

        # Update reservation
        reservation["customFields"] = custom_fields
        reservation["lastCustomUpdate"] = generation_time
        reservation["updatedAt"] = generation_time

        # Use centralized conversion for DynamoDB compatibility
        put(convert_to_decimal(reservation))

        print(f"Stored door access info in reservation {reservation_id} customFields")
        return {"success": True}

    except Exception as e:
        print(f"Error in step 6 - store access info: {str(e)}")
        return {
            "success": False,
            "response": _create_response(500, False, f"Failed to store access info: {str(e)}", error_code=ERROR_INTERNAL_ERROR)
        }



def normalize_checkin(ts_ms: int, tz_name: str = "Europe/Berlin") -> int:
    """Force timestamp to 14:00 local time of that date (returns ms)."""
    tz = ZoneInfo(tz_name)
    dt = datetime.fromtimestamp(ts_ms / 1000, tz=tz)
    dt_norm = datetime.combine(dt.date(), time(14, 0), tzinfo=tz)
    return int(dt_norm.timestamp() * 1000)

def normalize_checkout(ts_ms: int, tz_name: str = "Europe/Berlin") -> int:
    """Force timestamp to 11:00 local time of that date (returns ms)."""
    tz = ZoneInfo(tz_name)
    dt = datetime.fromtimestamp(ts_ms / 1000, tz=tz)
    dt_norm = datetime.combine(dt.date(), time(11, 0), tzinfo=tz)
    return int(dt_norm.timestamp() * 1000)