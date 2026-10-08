"""
Guesty app.guesty.com listings v2 API.

GET /api/v2/listings?listed=true&fields=title+nickname+picture.thumbnail+address.full&skip=0&q=
Response: { results: ListingDoc[], count, skip, limit }
"""

from __future__ import annotations

import os
import urllib.parse
from typing import Any, Dict, List, Tuple

from common.guesty_adapters import G4H_APP_BASE, app_json_headers

LISTINGS_V2_PATH = "/api/v2/listings"

DEFAULT_FIELDS = "title+nickname+picture.thumbnail+address.full"


def listings_fields() -> str:
    return os.getenv("G4H_LISTINGS_V2_FIELDS", DEFAULT_FIELDS)


def listings_page_limit() -> int:
    return int(os.getenv("G4H_LISTINGS_V2_LIMIT", "50"))


def build_listings_url(skip: int, limit: int | None = None) -> str:
    params: Dict[str, str] = {
        "listed": "true",
        "fields": listings_fields(),
        "skip": str(skip),
        "q": "",
    }
    if limit is not None:
        params["limit"] = str(limit)
    return f"{G4H_APP_BASE}{LISTINGS_V2_PATH}?{urllib.parse.urlencode(params, safe='+')}"


def fetch_listings_page(session, skip: int, limit: int | None = None) -> Dict[str, Any]:
    from common.g4h import refresh_on_auth_error

    url = build_listings_url(skip, limit)

    def _call():
        headers = {**dict(session.headers), **app_json_headers()}
        return session.get(url, headers=headers, timeout=60)

    response = refresh_on_auth_error(_call)
    response.raise_for_status()
    return response.json()


def fetch_all_listings(session) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    limit = listings_page_limit()
    skip = 0
    all_results: List[Dict[str, Any]] = []
    last_response: Dict[str, Any] = {}

    while True:
        js = fetch_listings_page(session, skip, limit)
        last_response = js
        batch = js.get("results") or []
        if not batch:
            break
        all_results.extend(batch)
        total = int(js.get("count") or len(all_results))
        skip += len(batch)
        if not batch or skip >= total or skip > 5000:
            break

    summary = {
        "count": int(last_response.get("count") or len(all_results)),
        "results": all_results,
        "lastResponse": last_response,
    }
    return all_results, summary


def parse_listing_v2(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Normalized fields from a v2 listings result item."""
    addr = doc.get("address") if isinstance(doc.get("address"), dict) else {}
    full = addr.get("full") if isinstance(addr, dict) else None
    picture = doc.get("picture") if isinstance(doc.get("picture"), dict) else {}
    thumbnail = picture.get("thumbnail") if isinstance(picture, dict) else None

    city = country = state = None
    if isinstance(full, str) and "," in full:
        parts = [p.strip() for p in full.split(",")]
        if len(parts) >= 2:
            country = parts[-1]
            city = parts[-2]
        if len(parts) >= 3:
            state = parts[-2]
            city = parts[-3]

    return {
        "listingId": doc.get("_id"),
        "accountId": doc.get("accountId"),
        "title": doc.get("title") or "",
        "nickname": doc.get("nickname") or "",
        "addressFull": full or "",
        "city": city,
        "state": state,
        "country": country,
        "thumbnail": thumbnail,
        "tags": doc.get("tags") or [],
    }


def listing_v2_to_legacy_room_shape(doc: Dict[str, Any]) -> Dict[str, Any]:
    """v2 listing doc → legacy room dict for create_listing_from_g4h."""
    parsed = parse_listing_v2(doc)
    lid = parsed.get("listingId")
    title = parsed.get("title") or ""
    nickname = parsed.get("nickname") or ""

    return {
        "roomId": lid,
        "groupId": None,
        "roomName": title,
        "roomAlias": nickname or title,
        "maxGuests": None,
        "bedrooms": None,
        "bathrooms": None,
        "beds": None,
        "city": parsed.get("city"),
        "country": parsed.get("country"),
        "addressFull": parsed.get("addressFull"),
        "listingImage": parsed.get("thumbnail"),
        "timezone": None,
        "isActive": True,
        "isDeleted": 0,
        "deleted": False,
        "ownerId": parsed.get("accountId"),
        "location": parsed.get("addressFull"),
        "guestyListing": {
            "guestyListingId": lid,
            "title": title,
            "nickname": nickname,
            "thumbnail": parsed.get("thumbnail"),
        },
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
