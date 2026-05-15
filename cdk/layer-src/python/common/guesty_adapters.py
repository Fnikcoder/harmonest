"""
Map Guesty app.guesty.com API shapes to the legacy Harmonest / Guesty-for-hosts flat dicts
stored in `rawData`, while preserving full app payloads in `rawDataGuestyApp`.

Used when G4H_AUTH_MODE=okta (Bearer + app APIs). Legacy auth keeps old handlers without these paths.
"""

from __future__ import annotations

import os
import re
from datetime import datetime
from typing import Any, Dict, Optional

from zoneinfo import ZoneInfo

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


def _parse_local_display_to_ms(date_str: str, tz_name: str) -> Optional[int]:
    """Parse e.g. '2026-05-14 02:00 PM' in account listing timezone."""
    if not date_str or not isinstance(date_str, str):
        return None
    date_str = date_str.strip()
    try:
        tz = ZoneInfo(tz_name or "UTC")
    except Exception:
        tz = ZoneInfo("UTC")
    for fmt in ("%Y-%m-%d %I:%M %p", "%Y-%m-%d %H:%M"):
        try:
            dt = datetime.strptime(date_str, fmt).replace(tzinfo=tz)
            return int(dt.timestamp() * 1000)
        except ValueError:
            continue
    m = re.match(r"^(\d{4}-\d{2}-\d{2})$", date_str)
    if m:
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d").replace(hour=15, minute=0, second=0, tzinfo=tz)
            return int(dt.timestamp() * 1000)
        except ValueError:
            pass
    return None


def _parse_iso_to_ms(iso: Optional[str]) -> Optional[int]:
    if not iso or not isinstance(iso, str):
        return None
    try:
        if iso.endswith("Z"):
            dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        else:
            dt = datetime.fromisoformat(iso)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=ZoneInfo("UTC"))
        return int(dt.timestamp() * 1000)
    except Exception:
        return None


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
    """GET /api/v2/listings result item → legacy room-like dict for create_listing_from_g4h / _project_listing."""
    lid = doc.get("_id")
    title = doc.get("title") or ""
    nickname = doc.get("nickname") or ""
    addr = doc.get("address") or {}
    full = addr.get("full") if isinstance(addr, dict) else None
    city = country = None
    if isinstance(full, str) and "," in full:
        parts = [p.strip() for p in full.split(",")]
        if len(parts) >= 2:
            city = parts[-2]
            country = parts[-1]

    guesty_listing = {
        "guestyListingId": lid,
        "title": title,
        "nickname": nickname,
    }

    return {
        "roomId": lid,
        "groupId": None,
        "roomName": title,
        "roomAlias": nickname or title,
        "maxGuests": None,
        "bedrooms": None,
        "bathrooms": None,
        "beds": None,
        "city": city,
        "country": country,
        "timezone": None,
        "isActive": True,
        "isDeleted": 0,
        "deleted": False,
        "ownerId": doc.get("accountId"),
        "location": None,
        "guestyListing": guesty_listing,
        "roomApiConnection": {},
        "links": [],
        "bookingUserHotel": {},
        "bookingListing": {},
        "bookingRoomTypePricing": {},
        "homeAwayListings": [],
        "homeAwayHosts": [],
        "airbnbHosts": [],
        "primaryHost": {},
        "thirdPartyLinks": [],
        "airbnbListings": [],
        "bookingComListings": [],
        "channelSummary": [],
        "childList": [],
    }


def reservations_report_row_to_legacy_flat(row: Dict[str, Any]) -> Dict[str, Any]:
    """reservations-reports `data[]` row → legacy reservation dict (sparse)."""
    rid = row.get("_id")
    listing_id = unwrap_cell(row.get("listingId"))
    tz_name = unwrap_cell(row.get("timezone")) or "Europe/Berlin"
    status_raw = unwrap_cell(row.get("status"))
    legacy_status = map_v2_status_to_legacy_int(status_raw if isinstance(status_raw, str) else str(status_raw))

    check_in = row.get("checkIn") or {}
    check_out = row.get("checkOut") or {}
    cin = check_in.get("value") if isinstance(check_in, dict) else None
    cout = check_out.get("value") if isinstance(check_out, dict) else None
    cin_ms = _parse_local_display_to_ms(cin, str(tz_name)) if cin else None
    cout_ms = _parse_local_display_to_ms(cout, str(tz_name)) if cout else None

    conf = unwrap_cell(row.get("confirmationCode"))
    guest_block = row.get("guest") if isinstance(row.get("guest"), dict) else {}
    guest_name = guest_block.get("name") or ""
    parts = guest_name.split(None, 1)
    guest_first = parts[0] if parts else ""
    guest_last = parts[1] if len(parts) > 1 else ""

    email_cell = row.get("guest.email")
    email = unwrap_cell(email_cell) if email_cell is not None else ""

    guests_n = unwrap_cell(row.get("guestsCount"))
    try:
        guests_n = int(guests_n) if guests_n is not None else None
    except (TypeError, ValueError):
        guests_n = None

    money = row.get("money.hostPayout") if isinstance(row.get("money.hostPayout"), dict) else {}
    payout = money.get("value")
    currency = money.get("currency") or "EUR"

    listing_block = row.get("listing") if isinstance(row.get("listing"), dict) else {}
    listing_name = listing_block.get("name") or ""

    src = unwrap_cell(row.get("source"))
    source_id = None
    if isinstance(src, str):
        sl = src.lower()
        if "airbnb" in sl:
            source_id = 1
        elif "booking" in sl:
            source_id = 2
        elif "home" in sl or "vrbo" in sl:
            source_id = 3

    return {
        "reservationId": rid,
        "roomId": listing_id,
        "roomName": listing_name,
        "roomAlias": listing_name,
        "sourceId": source_id,
        "reservationCode": conf,
        "guestId": None,
        "guestName": guest_first,
        "guestSurname": guest_last,
        "phoneNumber": "",
        "email": email or "",
        "preferredEmail": email or None,
        "checkInDate": cin_ms,
        "checkOutDate": cout_ms,
        "checkInDateWithTime": cin_ms,
        "checkOutDateWithTime": cout_ms,
        "nights": None,
        "numOfAdults": guests_n,
        "numOfKids": 0,
        "numOfInfants": 0,
        "currency": currency,
        "price": payout,
        "porterReservationPrice": None,
        "status": legacy_status,
        "isDeleted": 0,
        "isModified": 0,
        "note": None,
        "homeAwayReferenceNumber": None,
        "guestFormShortLink": None,
        "addedDate": None,
        "lastUpdateDate": int(__import__("time").time() * 1000),
        "platform": src,
        "source": src,
    }


def _unwrap_fegw_value(obj: Any) -> Any:
    if isinstance(obj, dict) and "value" in obj and "status" in obj:
        return obj.get("value")
    return obj


def fegw_reservation_to_legacy_flat(res: Dict[str, Any]) -> Dict[str, Any]:
    """GET reservations-fegw/... `reservation` object → legacy flat dict."""
    rid = res.get("_id")
    unit_id = res.get("unitId") or res.get("unitTypeId")
    conf = res.get("confirmationCode")
    status_raw = res.get("status")
    legacy_status = map_v2_status_to_legacy_int(status_raw)

    guest_wrap = _unwrap_fegw_value(res.get("guest")) or {}
    guest = guest_wrap if isinstance(guest_wrap, dict) else {}
    g_first = guest.get("firstName") or ""
    g_last = guest.get("lastName") or ""
    phone = guest.get("phone") or (guest.get("phones") or [None])[0]
    emails = guest.get("emails") or []
    email = emails[0] if emails else ""

    money_wrap = _unwrap_fegw_value(res.get("money")) or {}
    money = money_wrap if isinstance(money_wrap, dict) else {}
    currency = money.get("currency") or "EUR"
    host_payout = money.get("hostPayout")

    nog = res.get("numberOfGuests") or {}
    adults = nog.get("numberOfAdults")
    kids = nog.get("numberOfChildren") or 0
    infants = nog.get("numberOfInfants") or 0

    cin_ms = _parse_iso_to_ms(res.get("eta"))
    cout_ms = _parse_iso_to_ms(res.get("etd"))

    stay = res.get("stay") or []
    if isinstance(stay, list) and stay:
        st0 = stay[0]
        if isinstance(st0, dict):
            cin_ms = cin_ms or _parse_iso_to_ms(st0.get("eta"))
            cout_ms = cout_ms or _parse_iso_to_ms(st0.get("etd"))

    nights = None
    if cin_ms and cout_ms and cout_ms > cin_ms:
        nights = max(1, int(round((cout_ms - cin_ms) / (86400000.0))))

    listing_wrap = _unwrap_fegw_value(res.get("listing")) or {}
    listing = listing_wrap if isinstance(listing_wrap, dict) else {}
    room_name = listing.get("title") or listing.get("nickname") or ""

    src = res.get("source") or res.get("platform")
    source_id = None
    if isinstance(src, str):
        sl = src.lower()
        if "airbnb" in sl:
            source_id = 1
        elif "booking" in sl:
            source_id = 2
        elif "home" in sl or "vrbo" in sl:
            source_id = 3

    is_deleted = 1 if legacy_status == 0 else int(res.get("isDeleted") or 0)

    return {
        "reservationId": rid,
        "roomId": unit_id,
        "roomName": room_name,
        "roomAlias": listing.get("nickname") or room_name,
        "sourceId": source_id,
        "reservationCode": conf,
        "guestId": guest.get("_id"),
        "guestName": g_first,
        "guestSurname": g_last,
        "phoneNumber": phone or "",
        "email": email or "",
        "preferredEmail": email or None,
        "checkInDate": cin_ms,
        "checkOutDate": cout_ms,
        "checkInDateWithTime": cin_ms,
        "checkOutDateWithTime": cout_ms,
        "nights": nights,
        "numOfAdults": adults,
        "numOfKids": kids,
        "numOfInfants": infants,
        "currency": currency,
        "price": host_payout,
        "porterReservationPrice": None,
        "status": legacy_status,
        "isDeleted": is_deleted,
        "isModified": 0,
        "note": None,
        "homeAwayReferenceNumber": res.get("conversationExternalId"),
        "guestFormShortLink": None,
        "addedDate": _parse_iso_to_ms(res.get("createdAt")),
        "lastUpdateDate": _parse_iso_to_ms(res.get("confirmedAt")) or int(__import__("time").time() * 1000),
        "platform": src,
        "source": src,
        "guestyListing": {"guestyListingId": unit_id},
    }


def normalize_fegw_detail_response(js: Dict[str, Any]) -> Dict[str, Any]:
    """Wrap fegw JSON into the legacy { success, reservation: { reservation } } shape."""
    inner = js.get("reservation")
    if not isinstance(inner, dict):
        raise RuntimeError("fegw response missing reservation object")
    flat = fegw_reservation_to_legacy_flat(inner)
    return {"success": True, "reservation": {"reservation": flat}, "_guestyApp": inner}
