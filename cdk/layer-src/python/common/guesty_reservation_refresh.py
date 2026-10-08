"""
Shared Guesty reservation refresh for check-in and access notification.

Legacy G4H rows use UUID reservationIds; app.guesty.com fegw only accepts 24-char
Guesty ids. Callers should skip API refresh for legacy rows and fall back to DynamoDB.
"""

from __future__ import annotations

import re
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from common.g4h import refresh_on_auth_error
from common.guesty_adapters import (
    app_json_headers,
    normalize_fegw_detail_response,
    use_guesty_app_api,
)
from common.guesty_reservations_fegw import fegw_detail_url
from common.guesty_schema import SOURCE_LEGACY_G4H

G4H_GET_RESERVATION_DETAIL_URL = (
    "https://api.guestyforhosts.com/getReservationDetailById"
)


def is_guesty_object_id(reservation_id: str) -> bool:
    """Guesty app API ids are 24-char hex; legacy G4H uses UUIDs."""
    return bool(re.fullmatch(r"[a-f0-9]{24}", str(reservation_id or "").lower()))


def should_skip_guesty_refresh(db_row: Dict[str, Any]) -> bool:
    """True when fegw / app Guesty APIs cannot be called for this META row."""
    rid = str(db_row.get("reservationId") or "")
    source = str(db_row.get("guestySource") or "")
    if source == SOURCE_LEGACY_G4H:
        return True
    if rid and not is_guesty_object_id(rid):
        return True
    return False


def ddb_int(value: Any) -> Any:
    if isinstance(value, Decimal):
        return int(value)
    return value


def reservation_row_to_flat(row: Dict[str, Any]) -> Dict[str, Any]:
    """Map DynamoDB META → flat reservation dict for status checks and UI."""
    return {
        "reservationId": row.get("reservationId"),
        "reservationCode": row.get("reservationCode"),
        "guestName": row.get("guestName"),
        "guestSurname": row.get("guestSurname"),
        "email": row.get("email"),
        "phoneNumber": row.get("phoneNumber"),
        "status": row.get("status", 1),
        "guestyStatus": row.get("guestyStatus"),
        "isDeleted": row.get("isDeleted", 0),
        "checkInDate": ddb_int(row.get("checkInDate")),
        "checkOutDate": ddb_int(row.get("checkOutDate")),
        "checkInDateWithTime": ddb_int(
            row.get("checkInDateWithTime") or row.get("checkInDate")
        ),
        "checkOutDateWithTime": ddb_int(
            row.get("checkOutDateWithTime") or row.get("checkOutDate")
        ),
        "roomName": row.get("roomName"),
        "roomAlias": row.get("roomAlias"),
        "timezone": row.get("timezone") or "Europe/Berlin",
    }


def pick_best_reservation_row(
    items: List[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """Prefer Guesty v2 / reports row when duplicate reservation codes exist."""
    if not items:
        return None
    if len(items) == 1:
        return items[0]

    def _score(it: Dict[str, Any]) -> int:
        score = 0
        src = str(it.get("guestySource") or "")
        if src == "reservations-reports":
            score += 10
        elif src == "reservations-fegw":
            score += 8
        if is_guesty_object_id(str(it.get("reservationId") or "")):
            score += 5
        return score

    return max(items, key=_score)


def fetch_latest_reservation_status(
    session, user_id: str, reservation_id: str
) -> Dict[str, Any]:
    """Fetch latest reservation from Guesty (legacy POST or app GET fegw)."""
    if use_guesty_app_api():
        url = fegw_detail_url(reservation_id)

        def _call():
            headers = {**dict(session.headers), **app_json_headers()}
            return session.get(url, headers=headers, timeout=45)

        response = refresh_on_auth_error(_call)
        response.raise_for_status()
        return normalize_fegw_detail_response(response.json())

    payload = {
        "guestyId": False,
        "reservationId": reservation_id,
        "userId": user_id,
        "version": 3,
    }

    def _call():
        return session.post(
            G4H_GET_RESERVATION_DETAIL_URL, json=payload, timeout=45
        )

    response = refresh_on_auth_error(_call)
    response.raise_for_status()
    body = response.json()
    if not body.get("success"):
        raise RuntimeError(f"G4H API failure: {body}")
    return body


def refresh_reservation_for_checkin(
    session,
    user_id: str,
    db_row: Dict[str, Any],
) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]]]:
    """
    Returns (flat reservation detail, optional Guesty payload for DB update).
    Legacy rows skip API refresh; errors fall back to the DB snapshot.
    """
    reservation_id = db_row.get("reservationId")
    if should_skip_guesty_refresh(db_row):
        print(f"Skipping Guesty refresh for legacy reservation {reservation_id}")
        return reservation_row_to_flat(db_row), None

    try:
        latest_data = fetch_latest_reservation_status(session, user_id, reservation_id)
        detail = latest_data.get("reservation", {}).get("reservation", {}) or {}
        if not (
            str(detail.get("guestName") or "").strip()
            or str(detail.get("guestSurname") or "").strip()
        ):
            detail = reservation_row_to_flat(db_row)
        return detail, latest_data
    except Exception as exc:
        print(f"Guesty refresh failed for {reservation_id}, using DB snapshot: {exc}")
        return reservation_row_to_flat(db_row), None
