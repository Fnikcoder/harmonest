"""
Map Guesty app.guesty.com API shapes to denormalized flat fields for DynamoDB META items.

Native payloads are stored on `guesty` (see common.guesty_schema). Adapters here convert
listings v2, reservations-reports rows, and reservations-fegw detail into legacy-shaped
dicts for create_*_from_g4h and check-in flows.

Used when G4H_AUTH_MODE=okta (Bearer + app APIs). Legacy auth keeps old handlers without these paths.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

from common.guesty_dates import (
    parse_guesty_display_to_ms,
    parse_iso_to_ms,
    resolve_stay_timestamps,
    stay_nights,
)

G4H_APP_BASE = os.getenv("G4H_APP_BASE", "https://app.guesty.com")


def use_guesty_app_api() -> bool:
    return os.getenv("G4H_AUTH_MODE", "legacy").lower().strip() == "okta"


def app_json_headers() -> Dict[str, str]:
    return {"Accept": "application/json", "x-agni-version": "2"}


def unwrap_cell(obj: Any) -> Any:
    """reservations-reports uses {children: ...} or {value: ...} wrappers."""
    if not isinstance(obj, dict):
        return obj
    if "children" in obj and len(obj) <= 3:
        return obj.get("children")
    if "value" in obj:
        return obj.get("value")
    return obj


# Backward-compatible aliases for older imports
_parse_local_display_to_ms = parse_guesty_display_to_ms
_parse_iso_to_ms = parse_iso_to_ms


def map_v2_status_to_legacy_int(status: Any) -> Any:
    """Frontend / checkin expect numeric 1 active, 0 canceled for legacy paths."""
    if isinstance(status, (int, float)):
        return int(status)
    if not isinstance(status, str):
        return 1
    s = status.strip().lower().replace(" ", "_")
    if s in ("canceled", "cancelled", "declined", "expired", "void"):
        return 0
    return 1


def merge_legacy_raw_for_update(old: Optional[Dict[str, Any]], new: Dict[str, Any]) -> Dict[str, Any]:
    """Shallow merge: new keys overlay old so sparse app rows do not wipe rich legacy blobs."""
    if not old:
        return dict(new)
    out = dict(old)
    for key, value in new.items():
        # Do not let sparse API rows clear fields (e.g. reservationCode) with null.
        if value is not None:
            out[key] = value
    return out


def listing_v2_to_legacy_room_shape(doc: Dict[str, Any]) -> Dict[str, Any]:
    from common.guesty_listings_v2 import listing_v2_to_legacy_room_shape as _v2_shape

    return _v2_shape(doc)


def _source_id_from_platform(platform: str) -> Optional[int]:
    if not platform:
        return None
    sl = platform.lower()
    if "airbnb" in sl:
        return 1
    if "booking" in sl:
        return 2
    if "home" in sl or "vrbo" in sl:
        return 3
    return None


def reservations_report_row_to_legacy_flat(row: Dict[str, Any]) -> Dict[str, Any]:
    """reservations-reports `data[]` row → denormalized flat dict for DynamoDB META."""
    from common.guesty_reservations_reports import parse_report_row

    parsed = parse_report_row(row)
    tz_name = parsed.get("timezone") or "Europe/Berlin"
    cin_ms, cout_ms, cin, cout = resolve_stay_timestamps(
        check_in_display=parsed.get("checkInDisplay"),
        check_out_display=parsed.get("checkOutDisplay"),
        timezone=str(tz_name),
        use_12h_display=True,
    )
    nights = stay_nights(cin_ms, cout_ms)

    status_str = parsed.get("guestyStatus") or ""
    legacy_status = map_v2_status_to_legacy_int(status_str)
    platform = parsed.get("platform") or ""
    source_id = _source_id_from_platform(platform)
    email = parsed.get("email") or ""
    guests_n = parsed.get("guestsCount")
    listing_name = parsed.get("listingName") or ""

    return {
        "reservationId": parsed.get("reservationId"),
        "accountId": parsed.get("accountId"),
        "roomId": parsed.get("listingId"),
        "roomName": listing_name,
        "roomAlias": listing_name,
        "listingImage": parsed.get("listingImage"),
        "sourceId": source_id,
        "reservationCode": parsed.get("confirmationCode"),
        "guestId": None,
        "guestName": parsed.get("guestName") or "",
        "guestSurname": parsed.get("guestSurname") or "",
        "guestFullName": parsed.get("guestFullName") or "",
        "phoneNumber": "",
        "email": email,
        "preferredEmail": email or None,
        "checkInDate": cin_ms,
        "checkOutDate": cout_ms,
        "checkInDateWithTime": cin_ms,
        "checkOutDateWithTime": cout_ms,
        "checkInDisplay": cin,
        "checkOutDisplay": cout,
        "nights": nights,
        "guestsCount": guests_n,
        "numOfAdults": guests_n,
        "numOfKids": 0,
        "numOfInfants": 0,
        "currency": parsed.get("currency") or "EUR",
        "price": parsed.get("hostPayout"),
        "hostPayout": parsed.get("hostPayout"),
        "totalPaid": parsed.get("totalPaid"),
        "porterReservationPrice": None,
        "status": legacy_status,
        "guestyStatus": status_str,
        "isDeleted": 0,
        "isModified": 0,
        "note": None,
        "homeAwayReferenceNumber": None,
        "guestFormShortLink": None,
        "addedDate": None,
        "lastUpdateDate": int(__import__("time").time() * 1000),
        "platform": platform,
        "source": platform,
        "timezone": tz_name,
    }


def fegw_reservation_to_legacy_flat(res: Dict[str, Any]) -> Dict[str, Any]:
    """Delegate to guesty_reservations_fegw (single source of truth)."""
    from common.guesty_reservations_fegw import fegw_reservation_to_legacy_flat as _fegw_flat

    return _fegw_flat(res)


def normalize_fegw_detail_response(js: Dict[str, Any]) -> Dict[str, Any]:
    from common.guesty_reservations_fegw import normalize_fegw_detail_response as _norm

    return _norm(js)
