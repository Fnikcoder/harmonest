from typing import Dict, Any, List, Tuple
from decimal import Decimal
import json
import os
import urllib.parse

from common.g4h import get_client, refresh_on_auth_error
from common.ddb import get, put, put_if_changed, now_ms
from common.models import create_listing_from_g4h, convert_to_decimal
from common.guesty_adapters import (
    use_guesty_app_api,
    app_json_headers,
    listing_v2_to_legacy_room_shape,
    merge_legacy_raw_for_update,
    G4H_APP_BASE,
)
import boto3

BASE = "https://api.guestyforhosts.com"
URL = f"{BASE}/rooms/v2/getGroupedRoomsWithChannelDetails"


def _convert_floats_to_decimal(obj):
    """Recursively convert float values to Decimal for DynamoDB compatibility"""
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, dict):
        return {k: _convert_floats_to_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_convert_floats_to_decimal(item) for item in obj]
    else:
        return obj


def _fetch_legacy(session, user_id) -> Dict[str, Any]:
    def _call():
        return session.post(URL, json={"userId": user_id}, timeout=45)

    r = refresh_on_auth_error(_call)
    r.raise_for_status()
    js = r.json()
    if not js.get("success"):
        raise RuntimeError(f"Listings API failure: {js}")
    return js


def _fetch_app_listings(session) -> Dict[str, Any]:
    """GET /api/v2/listings with pagination (Guesty app API)."""
    fields = os.getenv(
        "G4H_LISTINGS_V2_FIELDS",
        "title+nickname+picture.thumbnail+address.full",
    )
    limit = int(os.getenv("G4H_LISTINGS_V2_LIMIT", "50"))
    all_results: List[Dict[str, Any]] = []
    skip = 0
    last_js: Dict[str, Any] = {}
    while True:
        params = {
            "listed": "true",
            "fields": fields,
            "skip": str(skip),
            "limit": str(limit),
            "q": "",
        }
        url = f"{G4H_APP_BASE}/api/v2/listings?{urllib.parse.urlencode(params)}"

        def _call():
            h = {**dict(session.headers), **app_json_headers()}
            return session.get(url, headers=h, timeout=60)

        r = refresh_on_auth_error(_call)
        r.raise_for_status()
        js = r.json()
        last_js = js
        batch = js.get("results") or []
        all_results.extend(batch)
        total = int(js.get("count") or len(all_results))
        skip += len(batch)
        if not batch or skip >= total or skip > 5000:
            break
    return {
        "success": True,
        "results": all_results,
        "count": len(all_results),
        "_meta": last_js,
    }


def _process_groups(js: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Process grouped rooms and return both groups and individual rooms with group context"""
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


def _process_app_listings(js: Dict[str, Any]) -> Tuple[List, List]:
    """v2 listings: no groups; one synthetic 'room' per listing with attached __v2_doc."""
    groups: List[Dict[str, Any]] = []
    rooms_with_context: List[Dict[str, Any]] = []
    for doc in js.get("results", []):
        legacy = listing_v2_to_legacy_room_shape(doc)
        legacy["__v2_doc"] = doc
        legacy["groupContext"] = {}
        rooms_with_context.append(legacy)
    return groups, rooms_with_context


def _project_listing(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Project room data into comprehensive listing format using helper function"""
    raw = dict(raw)
    v2_doc = raw.pop("__v2_doc", None)

    room_id = raw.get("roomId")
    existing_custom_fields = None
    existing_last_custom_update = None
    existing_listing = None
    if room_id:
        existing_listing = get(f"LISTING#{room_id}", "META")
        if existing_listing:
            existing_custom_fields = existing_listing.get("customFields", {})
            existing_last_custom_update = existing_listing.get("lastCustomUpdate")

    merged_raw = merge_legacy_raw_for_update(
        existing_listing.get("rawData") if existing_listing else None,
        raw,
    )

    guesty = merged_raw.get("guestyListing") or {}
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
            "listingId": guesty.get("airbnbListingId") or rac.get("platformListingId"),
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
            "guesty": guesty,
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

    if v2_doc is not None:
        listing["rawDataGuestyApp"] = v2_doc

    return listing


def _project_group(group_data: Dict[str, Any]) -> Dict[str, Any]:
    """Project group data into storage format"""
    group_model = {
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

    return _convert_floats_to_decimal(group_model)


def handler(event, context):
    s, user_id = get_client()

    if use_guesty_app_api():
        js = _fetch_app_listings(s)
        groups, rooms_with_context = _process_app_listings(js)
        api_metadata = {
            "type": "api_response",
            "apiTier": "guesty_app",
            "success": True,
            "totalListings": js.get("count"),
            "totalGroups": len(groups),
            "totalRooms": len(rooms_with_context),
            "sourceUpdatedAt": now_ms(),
            "updatedAt": now_ms(),
        }
    else:
        js = _fetch_legacy(s, user_id)
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
        changed = put_if_changed(
            pk=f"GROUP#{gid}",
            sk="META",
            body=group_model,
            hash_fields=["groupId", "groupName", "groupColor", "roomCount", "deleted"],
        )
        if changed:
            groups_written += 1

    listings_written = 0
    for raw in rooms_with_context:
        listing_model = _project_listing(raw)
        rid = listing_model["roomId"]
        if not rid:
            continue
        changed = put_if_changed(
            pk=f"LISTING#{rid}",
            sk="META",
            body=convert_to_decimal(listing_model),
            hash_fields=["rawDataHash"],
        )
        if changed:
            listings_written += 1

    return {
        "success": True,
        "apiTier": "guesty_app" if use_guesty_app_api() else "legacy",
        "totalGroups": len(groups),
        "totalRooms": len(rooms_with_context),
        "groupsWritten": groups_written,
        "listingsWritten": listings_written,
    }
