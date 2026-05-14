from typing import Dict, Any, List
from decimal import Decimal
import json
from common.g4h import get_client, refresh_on_auth_error
from common.ddb import get, put, put_if_changed, now_ms
from common.models import create_listing_from_g4h, convert_to_decimal
import boto3
import os

BASE = "https://api.guestyforhosts.com"
URL  = f"{BASE}/rooms/v2/getGroupedRoomsWithChannelDetails"

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

def _fetch(session, user_id) -> Dict[str, Any]:
    def _call(): return session.post(URL, json={"userId": user_id}, timeout=45)
    r = refresh_on_auth_error(_call); r.raise_for_status()
    js = r.json()
    if not js.get("success"): raise RuntimeError(f"Listings API failure: {js}")
    return js

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
            "deleted": bool(grp.get("deleted", False))
        }
        groups.append(group_info)

        # Add group context to each room
        for room in grp.get("rooms", []):
            room_with_context = room.copy()
            room_with_context["groupContext"] = group_info
            rooms_with_context.append(room_with_context)

    return groups, rooms_with_context

def _project_listing(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Project room data into comprehensive listing format using helper function"""

    # Get room ID to check for existing listing
    room_id = raw.get("roomId")
    existing_custom_fields = None
    existing_last_custom_update = None
    if room_id:
        existing_listing = get(f"LISTING#{room_id}", "META")
        if existing_listing:
            # CRITICAL: Preserve existing customFields - never update from G4H
            existing_custom_fields = existing_listing.get("customFields", {})
            existing_last_custom_update = existing_listing.get("lastCustomUpdate")

    # Extract main components
    guesty = raw.get("guestyListing") or {}
    rac = raw.get("roomApiConnection") or {}
    links = raw.get("links") or []
    booking_hotel = raw.get("bookingUserHotel") or {}
    booking_listing = raw.get("bookingListing") or {}
    booking_pricing = raw.get("bookingRoomTypePricing") or {}
    homeaway_listings = raw.get("homeAwayListings") or []
    homeaway_hosts = raw.get("homeAwayHosts") or []
    primary_host = raw.get("primaryHost") or {}
    airbnb_hosts = raw.get("airbnbHosts") or []
    group_context = raw.get("groupContext") or {}

    # Process links and categorize them
    ical_links = []
    api_links = []
    for link in links:
        link_url = link.get("link", "")
        if isinstance(link_url, str):
            if ".ics" in link_url:
                ical_links.append(link)
            elif "airbnb_official_api" in link_url:
                api_links.append(link)

    # Enhanced channel information
    channels = {
        "airbnb": {
            "listingId": guesty.get("airbnbListingId") or rac.get("platformListingId"),
            "status": rac.get("status"),
            "platformStatus": rac.get("platformStatus"),
            "syncLevel": rac.get("syncLevel"),
            "connectionId": rac.get("id"),
            "createDate": rac.get("createDate"),
            "updateDate": rac.get("updateDate"),
            "hosts": airbnb_hosts
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
                "stripeUserId": booking_hotel.get("stripeUserId")
            },
            "listing": {
                "roomTypeCode": booking_listing.get("roomTypeCode"),
                "addedDate": booking_listing.get("addedDate")
            },
            "pricing": {
                "roomTypeName": booking_pricing.get("roomTypeName"),
                "baseRateCategoryId": booking_pricing.get("baseRateCategoryId"),
                "pricingFunctionSign": booking_pricing.get("pricingFunctionSign"),
                "pricingFunctionAmount": booking_pricing.get("pricingFunctionAmount"),
                "pricingFunctionType": booking_pricing.get("pricingFunctionType"),
                "addedDate": booking_pricing.get("addedDate"),
                "lastUpdateDate": booking_pricing.get("lastUpdateDate"),
                "roomRate": booking_pricing.get("roomRate")
            }
        },
        "vrbo": {
            "listings": homeaway_listings,
            "hosts": homeaway_hosts,
            "hasListings": len(homeaway_listings) > 0
        }
    }

    # Create listing using helper function
    listing = create_listing_from_g4h(raw, existing_custom_fields)

    # Set the lastCustomUpdate from existing data
    if existing_last_custom_update:
        listing["lastCustomUpdate"] = existing_last_custom_update

    # Add extra G4H fields that aren't in the basic model
    listing.update({
        "type": "listing",
        "ownerId": raw.get("ownerId"),
        "location": raw.get("location"),
        "group": group_context,
        "guesty": guesty,
        "roomApiConnection": rac,
        "primaryHost": primary_host,
        "airbnbHosts": airbnb_hosts,
        "links": links,
        "thirdPartyLinks": raw.get("thirdPartyLinks", []),
        "bookingUserHotel": booking_hotel,
        "bookingListing": booking_listing,
        "bookingRoomTypePricing": booking_pricing,
        "homeAwayListings": homeaway_listings,
        "homeAwayHosts": homeaway_hosts,
        "channelSummary": channels,
    })

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
        "updatedAt": now_ms()
    }

    # Convert all float values to Decimal for DynamoDB compatibility
    return _convert_floats_to_decimal(group_model)



def handler(event, context):
    s, user_id = get_client()
    js = _fetch(s, user_id)
    groups, rooms_with_context = _process_groups(js)

    # Store API response metadata
    api_metadata = {
        "type": "api_response",
        "success": js.get("success"),
        "errorCode": js.get("errorCode"),
        "errorMessage": js.get("errorMessage"),
        "message": js.get("message"),
        "totalGroups": len(groups),
        "totalRooms": len(rooms_with_context),
        "sourceUpdatedAt": now_ms(),
        "updatedAt": now_ms()
    }

    put_if_changed(
        pk="API_RESPONSE#SYNC_LISTING", sk="METADATA", body=api_metadata,
        hash_fields=["success", "totalGroups", "totalRooms"]
    )

    # Store groups
    groups_written = 0
    for group_data in groups:
        group_model = _project_group(group_data)
        gid = group_model["groupId"]
        if not gid: continue
        changed = put_if_changed(
            pk=f"GROUP#{gid}", sk="META", body=group_model,
            hash_fields=["groupId", "groupName", "groupColor", "roomCount", "deleted"]
        )
        if changed: groups_written += 1

    # Store listings
    listings_written = 0
    for raw in rooms_with_context:
        listing_model = _project_listing(raw)
        rid = listing_model["roomId"]
        if not rid: continue
        changed = put_if_changed(
            pk=f"LISTING#{rid}", sk="META", body=convert_to_decimal(listing_model),
            hash_fields=["rawDataHash"]  # Just use the raw data hash since it captures everything
        )
        if changed:
            listings_written += 1

    return {
        "success": True,
        "totalGroups": len(groups),
        "totalRooms": len(rooms_with_context),
        "groupsWritten": groups_written,
        "listingsWritten": listings_written
    }
