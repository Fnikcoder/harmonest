from typing import Dict, Any, List, Tuple
from decimal import Decimal
import os

from common.g4h import get_client, refresh_on_auth_error
from common.ddb import get, put_if_changed, now_ms
from common.models import create_listing_from_g4h, convert_to_decimal
from common.guesty_adapters import use_guesty_app_api, merge_legacy_raw_for_update
from common.guesty_listings_v2 import (
    fetch_all_listings,
    listing_v2_to_legacy_room_shape,
)
from common.guesty_schema import (
    SOURCE_LEGACY_G4H,
    SOURCE_LISTINGS_V2,
    apply_guesty_envelope,
    merge_guesty_for_update,
    resolve_listing_guesty_from_item,
)

LEGACY_BASE = "https://api.guestyforhosts.com"
LEGACY_URL = f"{LEGACY_BASE}/rooms/v2/getGroupedRoomsWithChannelDetails"


def _convert_floats_to_decimal(obj):
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: _convert_floats_to_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_floats_to_decimal(item) for item in obj]
    return obj


def _fetch_legacy(session, user_id) -> Dict[str, Any]:
    def _call():
        return session.post(LEGACY_URL, json={"userId": user_id}, timeout=45)

    r = refresh_on_auth_error(_call)
    r.raise_for_status()
    js = r.json()
    if not js.get("success"):
        raise RuntimeError(f"Listings API failure: {js}")
    return js


def _process_groups(js: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    groups = []
    rooms_with_context = []

    for grp in js.get("groupedRooms", []):
        group_info = {
            "groupId": grp.get("groupId"),
            "userId": grp.get("userId"),
            "groupName": grp.get("groupName"),
            "groupColor": grp.get("groupColor"),
            "roomCount": len(grp.get("rooms", [])),
            "deleted": bool(grp.get("deleted", False)),
        }
        groups.append(group_info)

        for room in grp.get("rooms", []):
            room_with_context = room.copy()
            room_with_context["groupContext"] = group_info
            rooms_with_context.append(room_with_context)

    return groups, rooms_with_context


def _listings_from_v2_results(results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rooms: List[Dict[str, Any]] = []
    for doc in results:
        legacy = listing_v2_to_legacy_room_shape(doc)
        legacy["__v2_doc"] = doc
        legacy["groupContext"] = {}
        rooms.append(legacy)
    return rooms


def _seed_custom_fields_address(
    custom_fields: Dict[str, Any], address_full: str | None
) -> Dict[str, Any]:
    if not address_full:
        return custom_fields
    cf = dict(custom_fields or {})
    if not str(cf.get("address") or "").strip():
        cf["address"] = address_full
    return cf


def _project_listing(raw: Dict[str, Any]) -> Dict[str, Any]:
    raw = dict(raw)
    v2_doc = raw.pop("__v2_doc", None)

    room_id = raw.get("roomId")
    existing_listing = None
    existing_custom_fields = None
    existing_last_custom_update = None
    if room_id:
        existing_listing = get(f"LISTING#{room_id}", "META")
        if existing_listing:
            existing_custom_fields = existing_listing.get("customFields", {})
            existing_last_custom_update = existing_listing.get("lastCustomUpdate")

    if v2_doc is not None:
        prev_guesty, _ = resolve_listing_guesty_from_item(existing_listing or {})
        merged_guesty = merge_guesty_for_update(prev_guesty, v2_doc)
        merged_raw = listing_v2_to_legacy_room_shape(merged_guesty)
    else:
        merged_raw = merge_legacy_raw_for_update(
            existing_listing.get("rawData") if existing_listing else None,
            raw,
        )
        merged_guesty = None

    existing_custom_fields = _seed_custom_fields_address(
        existing_custom_fields or {},
        merged_raw.get("addressFull"),
    )

    guesty_listing_meta = merged_raw.get("guestyListing") or {}
    rac = merged_raw.get("roomApiConnection") or {}
    links = merged_raw.get("links") or []
    booking_hotel = merged_raw.get("bookingUserHotel") or {}
    booking_listing = merged_raw.get("bookingListing") or {}
    booking_pricing = merged_raw.get("bookingRoomTypePricing") or {}
    homeaway_listings = merged_raw.get("homeAwayListings") or []
    homeaway_hosts = merged_raw.get("homeAwayHosts") or []
    primary_host = merged_raw.get("primaryHost") or {}
    airbnb_hosts = merged_raw.get("airbnbHosts") or []
    group_context = merged_raw.get("groupContext") or {}

    channels = {
        "airbnb": {
            "listingId": guesty_listing_meta.get("airbnbListingId") or rac.get("platformListingId"),
            "status": rac.get("status"),
            "platformStatus": rac.get("platformStatus"),
            "syncLevel": rac.get("syncLevel"),
            "connectionId": rac.get("id"),
            "createDate": rac.get("createDate"),
            "updateDate": rac.get("updateDate"),
            "hosts": airbnb_hosts,
        },
        "booking": {
            "hotel": {
                "hotelCode": (booking_hotel.get("id") or {}).get("hotelCode"),
                "hotelName": booking_hotel.get("hotelName"),
                "active": booking_hotel.get("active"),
                "connectionType": booking_hotel.get("connectionType"),
                "integrationDate": booking_hotel.get("integrationDate"),
                "integrationRequestDate": booking_hotel.get("integrationRequestDate"),
                "lastUpdateDate": booking_hotel.get("lastUpdateDate"),
                "stripeUserId": booking_hotel.get("stripeUserId"),
            },
            "listing": {
                "roomTypeCode": booking_listing.get("roomTypeCode"),
                "addedDate": booking_listing.get("addedDate"),
            },
            "pricing": {
                "roomTypeName": booking_pricing.get("roomTypeName"),
                "baseRateCategoryId": booking_pricing.get("baseRateCategoryId"),
                "pricingFunctionSign": booking_pricing.get("pricingFunctionSign"),
                "pricingFunctionAmount": booking_pricing.get("pricingFunctionAmount"),
                "pricingFunctionType": booking_pricing.get("pricingFunctionType"),
                "addedDate": booking_pricing.get("addedDate"),
                "lastUpdateDate": booking_pricing.get("lastUpdateDate"),
                "roomRate": booking_pricing.get("roomRate"),
            },
        },
        "vrbo": {
            "listings": homeaway_listings,
            "hosts": homeaway_hosts,
            "hasListings": len(homeaway_listings) > 0,
        },
    }

    listing = create_listing_from_g4h(merged_raw, existing_custom_fields)

    if existing_last_custom_update:
        listing["lastCustomUpdate"] = existing_last_custom_update

    listing.update(
        {
            "type": "listing",
            "ownerId": merged_raw.get("ownerId"),
            "location": merged_raw.get("location"),
            "group": group_context,
            "guestyListing": guesty_listing_meta,
            "roomApiConnection": rac,
            "primaryHost": primary_host,
            "airbnbHosts": airbnb_hosts,
            "links": links,
            "thirdPartyLinks": merged_raw.get("thirdPartyLinks", []),
            "bookingUserHotel": booking_hotel,
            "bookingListing": booking_listing,
            "bookingRoomTypePricing": booking_pricing,
            "homeAwayListings": homeaway_listings,
            "homeAwayHosts": homeaway_hosts,
            "channelSummary": channels,
        }
    )

    if merged_guesty is not None:
        apply_guesty_envelope(listing, merged_guesty, SOURCE_LISTINGS_V2)
    else:
        apply_guesty_envelope(listing, merged_raw, SOURCE_LEGACY_G4H)

    return listing


def _project_group(group_data: Dict[str, Any]) -> Dict[str, Any]:
    return _convert_floats_to_decimal(
        {
            "type": "group",
            "groupId": group_data.get("groupId"),
            "userId": group_data.get("userId"),
            "groupName": group_data.get("groupName"),
            "groupColor": group_data.get("groupColor"),
            "roomCount": group_data.get("roomCount"),
            "deleted": group_data.get("deleted", False),
            "sourceUpdatedAt": now_ms(),
            "updatedAt": now_ms(),
        }
    )


def handler(event, context):
    session, user_id = get_client()

    if use_guesty_app_api():
        results, summary = fetch_all_listings(session)
        rooms_with_context = _listings_from_v2_results(results)
        groups: List[Dict[str, Any]] = []
        api_metadata = {
            "type": "api_response",
            "apiTier": "guesty_app",
            "success": True,
            "totalListings": summary.get("count", len(results)),
            "totalGroups": 0,
            "totalRooms": len(rooms_with_context),
            "sourceUpdatedAt": now_ms(),
            "updatedAt": now_ms(),
        }
    else:
        js = _fetch_legacy(session, user_id)
        groups, rooms_with_context = _process_groups(js)
        api_metadata = {
            "type": "api_response",
            "apiTier": "legacy",
            "success": js.get("success"),
            "errorCode": js.get("errorCode"),
            "errorMessage": js.get("errorMessage"),
            "message": js.get("message"),
            "totalGroups": len(groups),
            "totalRooms": len(rooms_with_context),
            "sourceUpdatedAt": now_ms(),
            "updatedAt": now_ms(),
        }

    put_if_changed(
        pk="API_RESPONSE#SYNC_LISTING",
        sk="METADATA",
        body=api_metadata,
        hash_fields=["success", "totalGroups", "totalRooms"],
    )

    groups_written = 0
    for group_data in groups:
        group_model = _project_group(group_data)
        gid = group_model["groupId"]
        if not gid:
            continue
        if put_if_changed(
            pk=f"GROUP#{gid}",
            sk="META",
            body=group_model,
            hash_fields=["groupId", "groupName", "groupColor", "roomCount", "deleted"],
        ):
            groups_written += 1

    listings_written = 0
    hash_fields = ["guestyHash"] if use_guesty_app_api() else ["rawDataHash"]
    for raw in rooms_with_context:
        listing_model = _project_listing(raw)
        rid = listing_model["roomId"]
        if not rid:
            continue
        if put_if_changed(
            pk=f"LISTING#{rid}",
            sk="META",
            body=convert_to_decimal(listing_model),
            hash_fields=hash_fields,
        ):
            listings_written += 1

    return {
        "success": True,
        "apiTier": "guesty_app" if use_guesty_app_api() else "legacy",
        "totalGroups": len(groups),
        "totalRooms": len(rooms_with_context),
        "totalListings": api_metadata.get("totalListings"),
        "groupsWritten": groups_written,
        "listingsWritten": listings_written,
    }
