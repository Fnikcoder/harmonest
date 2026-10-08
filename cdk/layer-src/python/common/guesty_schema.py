"""
Guesty app API v2 storage schema for Harmonest DynamoDB items.

Native payloads (Postman collection: listings-fe/v2, reservations-reports, reservations-fegw)
are stored on `guesty` with `guestySchemaVersion` + `guestySource`. Top-level fields remain
denormalized for GSIs, grids, and check-in.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, Optional, Tuple

from common.guesty_adapters import (
    fegw_reservation_to_legacy_flat,
    listing_v2_to_legacy_room_shape,
    merge_legacy_raw_for_update,
    reservations_report_row_to_legacy_flat,
)

GUESTY_SCHEMA_VERSION = 2

SOURCE_LISTINGS_V2 = "listings-v2"
SOURCE_LISTINGS_FE = "listings-fe"
SOURCE_RESERVATIONS_REPORTS = "reservations-reports"
SOURCE_RESERVATIONS_FEGW = "reservations-fegw"
SOURCE_LEGACY_G4H = "legacy-g4h"


def guesty_hash(guesty: Any) -> str:
    return hashlib.sha256(
        json.dumps(guesty, sort_keys=True, default=str).encode()
    ).hexdigest()


def merge_guesty_for_update(
    old: Optional[Dict[str, Any]], new: Dict[str, Any]
) -> Dict[str, Any]:
    """Deep-enough merge: new report rows must not wipe fegw detail fields."""
    if not old:
        return dict(new)
    if not isinstance(old, dict):
        return dict(new)
    out = dict(old)
    for key, value in new.items():
        if value is not None:
            out[key] = value
    return out


def denormalize_reservation_flat(guesty: Dict[str, Any], source: str) -> Dict[str, Any]:
    if source == SOURCE_RESERVATIONS_REPORTS:
        return reservations_report_row_to_legacy_flat(guesty)
    if source == SOURCE_RESERVATIONS_FEGW:
        return fegw_reservation_to_legacy_flat(guesty)
    if source == SOURCE_LEGACY_G4H:
        return dict(guesty)
    if guesty.get("_id") and guesty.get("confirmationCode") is not None:
        return fegw_reservation_to_legacy_flat(guesty)
    if guesty.get("_id") and (
        guesty.get("checkIn") is not None or guesty.get("listingId") is not None
    ):
        return reservations_report_row_to_legacy_flat(guesty)
    return dict(guesty)


def denormalize_listing_flat(guesty: Dict[str, Any], source: str) -> Dict[str, Any]:
    if source in (SOURCE_LISTINGS_V2, SOURCE_LISTINGS_FE):
        return listing_v2_to_legacy_room_shape(guesty)
    if source == SOURCE_LEGACY_G4H:
        return dict(guesty)
    if guesty.get("_id") and guesty.get("title") is not None:
        return listing_v2_to_legacy_room_shape(guesty)
    return dict(guesty)


def apply_guesty_envelope(
    item: Dict[str, Any],
    guesty: Dict[str, Any],
    source: str,
) -> Dict[str, Any]:
    item["guestySchemaVersion"] = GUESTY_SCHEMA_VERSION
    item["guestySource"] = source
    item["guesty"] = guesty
    item["guestyHash"] = guesty_hash(guesty)
    item.pop("rawDataGuestyApp", None)
    item.pop("rawData", None)
    item.pop("rawDataHash", None)
    return item


def resolve_reservation_guesty_from_item(item: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], str]:
    if item.get("guestySchemaVersion") == GUESTY_SCHEMA_VERSION and isinstance(
        item.get("guesty"), dict
    ):
        return item["guesty"], str(item.get("guestySource") or SOURCE_RESERVATIONS_REPORTS)
    if isinstance(item.get("rawDataGuestyApp"), dict):
        return item["rawDataGuestyApp"], SOURCE_RESERVATIONS_FEGW
    if isinstance(item.get("rawData"), dict):
        return item["rawData"], SOURCE_LEGACY_G4H
    return None, SOURCE_LEGACY_G4H


def resolve_listing_guesty_from_item(item: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], str]:
    if item.get("guestySchemaVersion") == GUESTY_SCHEMA_VERSION and isinstance(
        item.get("guesty"), dict
    ):
        return item["guesty"], str(item.get("guestySource") or SOURCE_LISTINGS_V2)
    if isinstance(item.get("rawDataGuestyApp"), dict):
        return item["rawDataGuestyApp"], SOURCE_LISTINGS_V2
    if isinstance(item.get("guesty"), dict) and item["guesty"].get("_id"):
        return item["guesty"], SOURCE_LISTINGS_V2
    if isinstance(item.get("rawData"), dict):
        return item["rawData"], SOURCE_LEGACY_G4H
    return None, SOURCE_LEGACY_G4H


def migrate_reservation_item_to_v2(item: Dict[str, Any]) -> Tuple[Dict[str, Any], bool]:
    if item.get("guestySchemaVersion") == GUESTY_SCHEMA_VERSION and item.get("guesty"):
        return item, False

    guesty, source = resolve_reservation_guesty_from_item(item)
    if not guesty:
        return item, False

    item = dict(item)
    apply_guesty_envelope(item, guesty, source)
    flat = denormalize_reservation_flat(guesty, source)
    for key, value in flat.items():
        if key in ("customFields", "PK", "SK"):
            continue
        if value is not None:
            item[key] = value
    code = flat.get("reservationCode")
    if code:
        item["reservationCode"] = str(code).strip()
    elif "reservationCode" in item and not item["reservationCode"]:
        item.pop("reservationCode", None)
    item.pop("rawData", None)
    item.pop("rawDataHash", None)
    return item, True


def upgrade_reservation_item_with_fegw(
    item: Dict[str, Any], fegw_reservation: Dict[str, Any]
) -> Tuple[Dict[str, Any], bool]:
    """Merge reservations-fegw detail into an existing META item."""
    if not fegw_reservation or not fegw_reservation.get("_id"):
        return item, False

    item = dict(item)
    prev_guesty, _ = resolve_reservation_guesty_from_item(item)
    merged_guesty = merge_guesty_for_update(prev_guesty, fegw_reservation)
    flat = denormalize_reservation_flat(merged_guesty, SOURCE_RESERVATIONS_FEGW)

    custom_fields = item.get("customFields")
    last_custom = item.get("lastCustomUpdate")
    apply_guesty_envelope(item, merged_guesty, SOURCE_RESERVATIONS_FEGW)
    for key, value in flat.items():
        if key in ("customFields", "PK", "SK"):
            continue
        if value is not None:
            item[key] = value
    code = flat.get("reservationCode")
    if code:
        item["reservationCode"] = str(code).strip()
    elif "reservationCode" in item and not item["reservationCode"]:
        item.pop("reservationCode", None)
    if custom_fields is not None:
        item["customFields"] = custom_fields
    if last_custom is not None:
        item["lastCustomUpdate"] = last_custom
    return item, True


def migrate_listing_item_to_v2(item: Dict[str, Any]) -> Tuple[Dict[str, Any], bool]:
    if item.get("guestySchemaVersion") == GUESTY_SCHEMA_VERSION and item.get("guesty"):
        return item, False

    guesty, source = resolve_listing_guesty_from_item(item)
    if not guesty:
        return item, False

    item = dict(item)
    apply_guesty_envelope(item, guesty, source)
    flat = denormalize_listing_flat(guesty, source)
    for key, value in flat.items():
        if key in ("customFields", "PK", "SK"):
            continue
        if value is not None:
            item[key] = value
    if flat.get("roomId"):
        item["roomId"] = flat["roomId"]
    if flat.get("roomName"):
        item["roomName"] = flat["roomName"]
    if flat.get("roomAlias"):
        item["roomAlias"] = flat["roomAlias"]
    item.pop("rawData", None)
    item.pop("rawDataHash", None)
    return item, True
