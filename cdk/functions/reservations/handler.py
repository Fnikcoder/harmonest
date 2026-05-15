from typing import Dict, Any, List, Optional
import os
import urllib.parse

from common.g4h import get_client, refresh_on_auth_error
from common.ddb import put_if_changed, now_ms, get
from common.models import create_reservation_from_g4h, convert_to_decimal
from common.guesty_adapters import (
    use_guesty_app_api,
    app_json_headers,
    reservations_report_row_to_legacy_flat,
    merge_legacy_raw_for_update,
    G4H_APP_BASE,
)

BASE = "https://api.guestyforhosts.com"
URL = f"{BASE}/reservations/recent"

_DEFAULT_RES_COLUMNS = (
    "checkIn+checkOut+confirmationCode+listing+guest+status+source+"
    "guest.email+guestsCount+money.hostPayout+money.totalPaid"
)
_DEFAULT_RES_FILTERS = '{"localTime.checkOutWithPlannedDeparture":{"@in_future":true},"status":{"@in":["confirmed"]}}'


def _fetch_legacy(session, user_id, page) -> Dict[str, Any]:
    def _call():
        return session.post(URL, json={"userId": user_id, "page": page}, timeout=45)

    r = refresh_on_auth_error(_call)
    r.raise_for_status()
    js = r.json()
    if not js.get("success"):
        raise RuntimeError(f"Reservations API failure: {js}")
    return js


def _fetch_app_reservations_page(session, skip: int, limit: int) -> Dict[str, Any]:
    columns = os.getenv("G4H_RES_REPORTS_COLUMNS", _DEFAULT_RES_COLUMNS)
    filters = os.getenv("G4H_RES_REPORTS_FILTERS", _DEFAULT_RES_FILTERS)
    tz = os.getenv("G4H_RES_REPORTS_TIMEZONE", "Europe/Berlin")
    params = {
        "smartView": "true",
        "columns": columns,
        "filters": filters,
        "skip": str(skip),
        "limit": str(limit),
        "sort": "checkIn",
        "lang": "en-US",
        "timezone": tz,
    }
    url = f"{G4H_APP_BASE}/api/reservations-reports?{urllib.parse.urlencode(params)}"

    def _call():
        h = {**dict(session.headers), **app_json_headers()}
        return session.get(url, headers=h, timeout=60)

    r = refresh_on_auth_error(_call)
    r.raise_for_status()
    return r.json()


def _project_reservation(
    raw: Dict[str, Any],
    app_source_row: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    reservation_id = raw.get("reservationId")
    existing_custom_fields = None
    existing_last_custom_update = None
    existing_reservation = None
    if reservation_id:
        existing_reservation = get(f"RESERVATION#{reservation_id}", "META")
        if existing_reservation:
            existing_custom_fields = existing_reservation.get("customFields", {})
            existing_last_custom_update = existing_reservation.get("lastCustomUpdate")

    merged_raw = merge_legacy_raw_for_update(
        existing_reservation.get("rawData") if existing_reservation else None,
        raw,
    )

    reservation = create_reservation_from_g4h(merged_raw, existing_custom_fields)

    if existing_reservation and not reservation.get("reservationCode"):
        prev_code = existing_reservation.get("reservationCode")
        if prev_code:
            reservation["reservationCode"] = prev_code

    if existing_last_custom_update:
        reservation["lastCustomUpdate"] = existing_last_custom_update

    if app_source_row is not None:
        reservation["rawDataGuestyApp"] = app_source_row

    return reservation


def _update_reservation_preserving_door_access(
    reservation_id: str, new_reservation: Dict[str, Any], hash_fields: List[str]
) -> bool:
    changed = put_if_changed(
        pk=f"RESERVATION#{reservation_id}",
        sk="META",
        body=convert_to_decimal(new_reservation),
        hash_fields=hash_fields,
    )
    return changed


def handler(event, context):
    if os.getenv("RESERVATIONS_SYNC_ENABLED", "true").lower() not in ("1", "true", "yes"):
        return {
            "success": True,
            "skipped": True,
            "reason": "RESERVATIONS_SYNC_ENABLED is false",
        }

    s, user_id = get_client()
    all_rows: List[Dict[str, Any]] = []
    app_rows: List[Dict[str, Any]] = []
    page = 0
    last_response = None
    seven_days_ago_ms = now_ms() - (7 * 24 * 60 * 60 * 1000)

    if use_guesty_app_api():
        skip = 0
        limit = int(os.getenv("G4H_RES_REPORTS_LIMIT", "50"))
        total = None
        while True:
            js = _fetch_app_reservations_page(s, skip, limit)
            last_response = js
            batch = js.get("data") or []
            if not batch:
                break
            for row in batch:
                flat = reservations_report_row_to_legacy_flat(row)
                all_rows.append(flat)
                app_rows.append(row)
            total = int(js.get("total") or len(all_rows))
            skip += len(batch)
            if skip >= total or skip > 10000:
                break
        page = skip // max(limit, 1)
    else:
        while True:
            js = _fetch_legacy(s, user_id, page)
            if not js:
                break
            last_response = js

            reservations = js.get("reservationList", [])
            if not reservations:
                break

            oldest_update = None
            for reservation in reservations:
                last_update = reservation.get("lastUpdateDate")
                if last_update and (oldest_update is None or last_update < oldest_update):
                    oldest_update = last_update

            all_rows.extend(reservations)

            if oldest_update and oldest_update < seven_days_ago_ms:
                break

            page += 1
            if page >= 20:
                break

    api_metadata = {
        "type": "api_response",
        "apiTier": "guesty_app" if use_guesty_app_api() else "legacy",
        "success": last_response.get("success") if last_response and not use_guesty_app_api() else True,
        "errorCode": last_response.get("errorCode") if last_response else -1,
        "errorMessage": last_response.get("errorMessage") if last_response else "",
        "message": last_response.get("message") if last_response else "",
        "totalReservations": len(all_rows),
        "pagesProcessed": page,
        "sourceUpdatedAt": now_ms(),
        "updatedAt": now_ms(),
    }

    put_if_changed(
        pk="API_RESPONSE#SYNC_RESERVATION",
        sk="METADATA",
        body=api_metadata,
        hash_fields=["success", "totalReservations", "pagesProcessed"],
    )

    reservations_written = 0
    hash_fields = ["rawDataHash"]

    for i, raw in enumerate(all_rows):
        app_row = app_rows[i] if use_guesty_app_api() and i < len(app_rows) else None
        reservation_model = _project_reservation(raw, app_source_row=app_row)
        rid = reservation_model["reservationId"]
        if not rid:
            continue

        changed = _update_reservation_preserving_door_access(rid, reservation_model, hash_fields)
        if changed:
            reservations_written += 1

    return {
        "success": True,
        "apiTier": "guesty_app" if use_guesty_app_api() else "legacy",
        "totalReservations": len(all_rows),
        "reservationsWritten": reservations_written,
        "pagesProcessed": page,
    }
