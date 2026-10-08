"""
Guesty app.guesty.com reservations-fegw API (single reservation detail).

GET /api/reservations-fegw/reservations/{id}?newResponse=true

Used by check-in and access_notification to refresh status, guest contact, and money
before door access / validation. Merges into existing META items (preserves customFields).
"""

from __future__ import annotations

import urllib.parse
from typing import Any, Dict, Optional, Tuple

from common.guesty_adapters import (
    G4H_APP_BASE,
    _source_id_from_platform,
    app_json_headers,
    map_v2_status_to_legacy_int,
)
from common.guesty_dates import (
    DEFAULT_GUESTY_TIMEZONE,
    parse_iso_to_ms,
    resolve_stay_timestamps,
    stay_nights,
)
from common.guesty_schema import SOURCE_RESERVATIONS_FEGW, upgrade_reservation_item_with_fegw
from common.models import now_ms

FEGW_PATH = "/api/reservations-fegw/reservations"


def fegw_detail_url(reservation_id: str) -> str:
    rid = urllib.parse.quote(reservation_id, safe="")
    return f"{G4H_APP_BASE}{FEGW_PATH}/{rid}?newResponse=true"


def unwrap_fegw_value(obj: Any) -> Any:
    """Fields like guest, money, listing use { value, status }."""
    if isinstance(obj, dict) and "value" in obj and "status" in obj:
        return obj.get("value")
    return obj


def fetch_fegw_reservation(session, reservation_id: str) -> Dict[str, Any]:
    """Raw `reservation` object from API response."""
    from common.g4h import refresh_on_auth_error

    url = fegw_detail_url(reservation_id)

    def _call():
        headers = {**dict(session.headers), **app_json_headers()}
        return session.get(url, headers=headers, timeout=60)

    response = refresh_on_auth_error(_call)
    response.raise_for_status()
    body = response.json()
    inner = body.get("reservation")
    if not isinstance(inner, dict):
        raise RuntimeError("reservations-fegw response missing reservation object")
    return inner


def parse_fegw_reservation(res: Dict[str, Any]) -> Dict[str, Any]:
    """Extract normalized fields from fegw `reservation` object."""
    guest = unwrap_fegw_value(res.get("guest")) or {}
    if not isinstance(guest, dict):
        guest = {}

    money = unwrap_fegw_value(res.get("money")) or {}
    if not isinstance(money, dict):
        money = {}

    payments = unwrap_fegw_value(res.get("payments")) or {}
    if not isinstance(payments, dict):
        payments = {}

    listing = unwrap_fegw_value(res.get("listing")) or {}
    if not isinstance(listing, dict):
        listing = {}

    picture = listing.get("picture") or {}
    thumbnail = picture.get("thumbnail") if isinstance(picture, dict) else None

    emails = guest.get("emails") or []
    email = guest.get("email") or (emails[0] if emails else "")
    phones = guest.get("phones") or []
    phone = guest.get("phone") or (phones[0] if phones else "")

    nog = res.get("numberOfGuests") or {}
    guests_count = res.get("guestsCount")
    if guests_count is None and isinstance(nog, dict):
        guests_count = nog.get("numberOfAdults")

    channel_meta = res.get("channelMetadata") or {}
    external_res_id = channel_meta.get("externalReservationId")

    platform = res.get("source") or res.get("platform") or ""
    status_str = str(res.get("status") or "").strip()

    host_payout = money.get("hostPayout")
    if host_payout is None:
        host_payout = payments.get("hostPayout")
    total_paid = money.get("totalPaid")
    if total_paid is None:
        total_paid = payments.get("totalPaid")

    cin_local = res.get("checkInDateLocalized")
    cout_local = res.get("checkOutDateLocalized")
    check_in_display = None
    check_out_display = None
    if cin_local and listing.get("defaultCheckInTime"):
        check_in_display = f"{cin_local} {listing.get('defaultCheckInTime')}"
    elif cin_local:
        check_in_display = str(cin_local)
    if cout_local and listing.get("defaultCheckOutTime"):
        check_out_display = f"{cout_local} {listing.get('defaultCheckOutTime')}"
    elif cout_local:
        check_out_display = str(cout_local)

    return {
        "reservationId": res.get("_id"),
        "accountId": res.get("accountId"),
        "listingId": res.get("unitId") or res.get("unitTypeId"),
        "confirmationCode": res.get("confirmationCode"),
        "conversationId": res.get("conversationId"),
        "conversationExternalId": res.get("conversationExternalId"),
        "externalReservationId": external_res_id,
        "guestId": guest.get("_id"),
        "guestName": guest.get("firstName") or "",
        "guestSurname": guest.get("lastName") or "",
        "guestFullName": guest.get("fullName")
        or f"{guest.get('firstName', '')} {guest.get('lastName', '')}".strip(),
        "email": email or "",
        "phoneNumber": phone or "",
        "guestsCount": guests_count,
        "numberOfAdults": nog.get("numberOfAdults") if isinstance(nog, dict) else None,
        "numberOfChildren": nog.get("numberOfChildren") if isinstance(nog, dict) else 0,
        "numberOfInfants": nog.get("numberOfInfants") if isinstance(nog, dict) else 0,
        "currency": money.get("currency") or payments.get("currency") or "EUR",
        "hostPayout": host_payout,
        "totalPaid": total_paid,
        "guestyStatus": status_str,
        "platform": platform,
        "source": platform,
        "listingName": listing.get("title") or listing.get("nickname") or "",
        "listingNickname": listing.get("nickname"),
        "listingImage": thumbnail,
        "listingTimezone": listing.get("timezone"),
        "checkInDateLocalized": cin_local,
        "checkOutDateLocalized": cout_local,
        "checkInDisplay": check_in_display,
        "checkOutDisplay": check_out_display,
        "eta": res.get("eta"),
        "etd": res.get("etd"),
    }


def fegw_reservation_to_legacy_flat(res: Dict[str, Any]) -> Dict[str, Any]:
    """fegw `reservation` → denormalized flat dict for DynamoDB META / legacy consumers."""
    parsed = parse_fegw_reservation(res)
    status_str = parsed.get("guestyStatus") or ""
    legacy_status = map_v2_status_to_legacy_int(status_str)
    platform = parsed.get("platform") or ""

    tz_name = parsed.get("listingTimezone") or DEFAULT_GUESTY_TIMEZONE
    check_in_iso = parsed.get("eta")
    check_out_iso = parsed.get("etd")
    stay = res.get("stay") or []
    if isinstance(stay, list) and stay:
        st0 = stay[0]
        if isinstance(st0, dict):
            check_in_iso = check_in_iso or st0.get("eta")
            check_out_iso = check_out_iso or st0.get("etd")

    cin_ms, cout_ms, cin_disp, cout_disp = resolve_stay_timestamps(
        check_in_display=parsed.get("checkInDisplay"),
        check_out_display=parsed.get("checkOutDisplay"),
        timezone=tz_name,
        check_in_iso=check_in_iso,
        check_out_iso=check_out_iso,
        use_12h_display=True,
    )
    nights = stay_nights(cin_ms, cout_ms)

    listing = unwrap_fegw_value(res.get("listing")) or {}
    if not isinstance(listing, dict):
        listing = {}

    is_deleted = 1 if legacy_status == 0 else int(res.get("isDeleted") or 0)

    return {
        "reservationId": parsed.get("reservationId"),
        "accountId": parsed.get("accountId"),
        "roomId": parsed.get("listingId"),
        "roomName": parsed.get("listingName") or "",
        "roomAlias": parsed.get("listingNickname") or parsed.get("listingName") or "",
        "listingImage": parsed.get("listingImage"),
        "sourceId": _source_id_from_platform(platform),
        "reservationCode": parsed.get("confirmationCode"),
        "guestId": parsed.get("guestId"),
        "guestName": parsed.get("guestName") or "",
        "guestSurname": parsed.get("guestSurname") or "",
        "guestFullName": parsed.get("guestFullName") or "",
        "phoneNumber": parsed.get("phoneNumber") or "",
        "email": parsed.get("email") or "",
        "preferredEmail": parsed.get("email") or None,
        "checkInDate": cin_ms,
        "checkOutDate": cout_ms,
        "checkInDateWithTime": cin_ms,
        "checkOutDateWithTime": cout_ms,
        "checkInDisplay": cin_disp,
        "checkOutDisplay": cout_disp,
        "nights": nights,
        "guestsCount": parsed.get("guestsCount"),
        "numOfAdults": parsed.get("numberOfAdults") or parsed.get("guestsCount"),
        "numOfKids": parsed.get("numberOfChildren") or 0,
        "numOfInfants": parsed.get("numberOfInfants") or 0,
        "currency": parsed.get("currency") or "EUR",
        "price": parsed.get("hostPayout"),
        "hostPayout": parsed.get("hostPayout"),
        "totalPaid": parsed.get("totalPaid"),
        "porterReservationPrice": None,
        "status": legacy_status,
        "guestyStatus": status_str,
        "isDeleted": is_deleted,
        "isModified": 0,
        "note": None,
        "homeAwayReferenceNumber": parsed.get("conversationExternalId"),
        "guestFormShortLink": None,
        "addedDate": parse_iso_to_ms(res.get("createdAt")),
        "lastUpdateDate": parse_iso_to_ms(res.get("confirmedAt")) or now_ms(),
        "platform": platform,
        "source": platform,
        "timezone": tz_name,
        "conversationId": parsed.get("conversationId"),
        "externalReservationId": parsed.get("externalReservationId"),
        "guestyListing": {"guestyListingId": parsed.get("listingId")},
    }


def normalize_fegw_detail_response(js: Dict[str, Any]) -> Dict[str, Any]:
    """API JSON → legacy { success, reservation: { reservation }, _guestyApp }."""
    inner = js.get("reservation")
    if not isinstance(inner, dict):
        raise RuntimeError("reservations-fegw response missing reservation object")
    flat = fegw_reservation_to_legacy_flat(inner)
    return {"success": True, "reservation": {"reservation": flat}, "_guestyApp": inner}


def apply_fegw_to_meta_item(
    item: Dict[str, Any], fegw_reservation: Dict[str, Any]
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Merge fegw detail into an existing DynamoDB META dict.
    Returns (updated_item, legacy_flat).
    """
    upgraded, _ = upgrade_reservation_item_with_fegw(item, fegw_reservation)
    flat = fegw_reservation_to_legacy_flat(fegw_reservation)
    upgraded["lastGuestySync"] = now_ms()
    if flat.get("guestyStatus"):
        upgraded["guestyStatus"] = flat["guestyStatus"]
    upgraded.pop("rawData", None)
    upgraded.pop("rawDataHash", None)
    return upgraded, flat


def is_reservation_canceled_flat(flat: Dict[str, Any]) -> bool:
    return flat.get("status") == 0 or flat.get("isDeleted") == 1
