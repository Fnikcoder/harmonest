from typing import Dict, Any, List
from decimal import Decimal
from common.g4h import get_client, refresh_on_auth_error
from common.ddb import put_if_changed, now_ms, get, put
from common.models import create_reservation_from_g4h, convert_to_decimal

BASE = "https://api.guestyforhosts.com"
URL = f"{BASE}/reservations/recent"



"""
response example of each request:

"""


def _fetch(session, user_id, page) -> Dict[str, Any]:
    def _call(): return session.post(URL, json={"userId": user_id, "page": page}, timeout=45)
    r = refresh_on_auth_error(_call); r.raise_for_status()
    js = r.json()
    if not js.get("success"): raise RuntimeError(f"Reservations API failure: {js}")
    return js


def _project_reservation(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Project reservation data into comprehensive format using helper function"""

    # Get reservation ID to check for existing reservation
    reservation_id = raw.get("reservationId")
    existing_custom_fields = None
    existing_last_custom_update = None
    if reservation_id:
        existing_reservation = get(f"RESERVATION#{reservation_id}", "META")
        if existing_reservation:
            # CRITICAL: Preserve existing customFields - never update from G4H
            existing_custom_fields = existing_reservation.get("customFields", {})
            existing_last_custom_update = existing_reservation.get("lastCustomUpdate")

    # Create reservation using helper function
    reservation = create_reservation_from_g4h(raw, existing_custom_fields)

    # Set the lastCustomUpdate from existing data
    if existing_last_custom_update:
        reservation["lastCustomUpdate"] = existing_last_custom_update

    return reservation

def _update_reservation_preserving_door_access(reservation_id: str, new_reservation: Dict[str, Any], hash_fields: List[str]) -> bool:
    """Update reservation while preserving door access data using dictionary"""

    # Use put_if_changed with the dictionary - convert to DynamoDB format
    changed = put_if_changed(
        pk=f"RESERVATION#{reservation_id}",
        sk="META",
        body=convert_to_decimal(new_reservation),
        hash_fields=hash_fields
    )

    return changed


def handler(event, context):
    s, user_id = get_client()
    all_rows = []
    page = 0
    last_response = None
    seven_days_ago_ms = (now_ms() - (7 * 24 * 60 * 60 * 1000))  # 7 days ago in milliseconds

    while True:
        js = _fetch(s, user_id, page)
        if not js:
            print(f"page {page}: No response from API, stopping")
            break
        last_response = js  # Keep track of the last successful response

        print(f"page {page}: API response keys: {list(js.keys())}")
        print(f"page {page}: success = {js.get('success')}")

        reservations = js.get("reservationList", [])
        if not reservations:  # No more reservations
            print(f"page {page}: No reservations in response (reservationList is empty), stopping")
            break

        # Check if we've reached reservations that haven't been modified recently
        # The /reservations/recent endpoint returns reservations sorted by lastUpdateDate (most recent first)
        # So we should stop when we reach reservations with old lastUpdateDate, not old checkInDate
        oldest_update = None
        for reservation in reservations:
            last_update = reservation.get("lastUpdateDate")
            if last_update and (oldest_update is None or last_update < oldest_update):
                oldest_update = last_update

        all_rows.extend(reservations)
        print(f"page {page}: +{len(reservations)} reservations (total {len(all_rows)})")

        # Stop if the oldest lastUpdateDate in this page is older than 7 days
        # This means we've reached reservations that haven't been modified in the last 7 days
        if oldest_update and oldest_update < seven_days_ago_ms:
            print(f"page {page}: Reached reservations not modified in last 7 days (oldest update: {oldest_update}), stopping")
            break

        page += 1
        # Safety limit to prevent infinite loops
        if page >= 20:
            print(f"page {page}: Reached safety limit of 20 pages, stopping")
            break
        # time.sleep(sleep_s)  # be polite

    # Store API response metadata
    api_metadata = {
        "type": "api_response",
        "success": last_response.get("success") if last_response else False,
        "errorCode": last_response.get("errorCode") if last_response else -1,
        "errorMessage": last_response.get("errorMessage") if last_response else "",
        "message": last_response.get("message") if last_response else "",
        "totalReservations": len(all_rows),
        "pagesProcessed": page,
        "sourceUpdatedAt": now_ms(),
        "updatedAt": now_ms()
    }

    put_if_changed(
        pk="API_RESPONSE#SYNC_RESERVATION", sk="METADATA", body=api_metadata,
        hash_fields=["success", "totalReservations", "pagesProcessed"]
    )

    # Store individual reservations
    reservations_written = 0
    print(f"Processing {len(all_rows)} total reservations for storage...")

    for i, raw in enumerate(all_rows):
        reservation_model = _project_reservation(raw)
        rid = reservation_model["reservationId"]
        if not rid:
            print(f"Reservation {i}: Skipping - no reservationId")
            continue

        print(f"Reservation {i}: Processing {rid}")

        # Use key fields that would indicate a reservation has changed
        # NOTE: Removed lastUpdateDate because Guesty API sometimes returns stale values
        # even when status/isDeleted changes. Using rawDataHash instead for comprehensive change detection.
        hash_fields = ["rawDataHash"]

        # Check if reservation needs updating and preserve door access data
        changed = _update_reservation_preserving_door_access(rid, reservation_model, hash_fields)
        if changed:
            reservations_written += 1
            print(f"Reservation {i}: Written to DB (new/changed)")
        else:
            print(f"Reservation {i}: Skipped (no changes)")

    result = {
        "success": True,
        "totalReservations": len(all_rows),
        "reservationsWritten": reservations_written,
        "pagesProcessed": page
    }

    print(f"Final result: {result}")
    return result
