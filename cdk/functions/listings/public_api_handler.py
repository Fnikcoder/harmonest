"""
Public listings HTTP API (API Gateway proxy).
Kept separate from handler.py (scheduled Guesty sync).
"""
from __future__ import annotations

import base64
import json
import os
import time
from decimal import Decimal
from typing import Any, Dict, List, Optional

import boto3

_TABLE_NAME = os.environ["APP_TABLE"]
_REGION = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "eu-central-1"
_table = boto3.resource("dynamodb", region_name=_REGION).Table(_TABLE_NAME)


def _json_default(obj: Any) -> Any:
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    raise TypeError(f"Not JSON serializable: {type(obj)}")


def _response(status: int, body: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body, default=_json_default),
    }


def _public_listings_enabled() -> bool:
    return os.getenv("PUBLIC_LISTINGS_ENABLED", "false").lower() == "true"


def _client_meta() -> Dict[str, str]:
    name = os.getenv("CLIENT_NAME", "harmonest")
    display = os.getenv("CLIENT_DISPLAY_NAME", name)
    return {
        "client": name,
        "clientDisplayName": display,
        "dataSource": f"{name}_api",
        "version": "1.0",
    }


def _listings_metadata() -> Optional[Dict[str, Any]]:
    item = _table.get_item(Key={"PK": "API_RESPONSE#SYNC_LISTING", "SK": "METADATA"}).get("Item")
    if item:
        return item
    return _table.get_item(Key={"PK": "LISTINGS", "SK": "METADATA"}).get("Item")


def _scan_listings_meta(limit: int = 200) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    kwargs: Dict[str, Any] = {
        "FilterExpression": "begins_with(#pk, :pfx) AND #sk = :sk",
        "ExpressionAttributeNames": {"#pk": "PK", "#sk": "SK"},
        "ExpressionAttributeValues": {":pfx": "LISTING#", ":sk": "META"},
        "Limit": 100,
    }
    while len(out) < limit:
        resp = _table.scan(**kwargs)
        for it in resp.get("Items", []):
            pk = str(it.get("PK", ""))
            if pk.startswith("LISTING#") and it.get("SK") == "META":
                out.append(it)
        lek = resp.get("LastEvaluatedKey")
        if not lek:
            break
        kwargs["ExclusiveStartKey"] = lek
    return out[:limit]


def _project_public_card(item: Dict[str, Any]) -> Dict[str, Any]:
    rid = str(item.get("PK", "")).removeprefix("LISTING#") or str(item.get("roomId") or "")
    return {
        "listingId": rid,
        "title": item.get("roomName") or item.get("title") or "",
        "description": (str(item.get("description") or ""))[:500],
        "maxGuests": int(item.get("maxGuests") or item.get("numOfAdults") or 0),
        "rooms": int(item.get("rooms") or item.get("numOfRooms") or 0),
        "amenities": item.get("amenities") or [],
    }


def _get_listing(listing_id: str) -> Optional[Dict[str, Any]]:
    return _table.get_item(Key={"PK": f"LISTING#{listing_id}", "SK": "META"}).get("Item")


def _now_ms() -> int:
    return int(time.time() * 1000)


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    if not _public_listings_enabled():
        return _response(
            403,
            {"success": False, "message": "Public listings are disabled for this deployment"},
        )

    meta = _client_meta()
    method = (event.get("httpMethod") or "").upper()
    path = event.get("path") or event.get("rawPath") or ""
    path_params = event.get("pathParameters") or {}

    if method == "OPTIONS":
        return _response(200, {"success": True})

    try:
        if method == "POST" and "search" in path:
            body_raw = event.get("body") or "{}"
            if event.get("isBase64Encoded"):
                body_raw = base64.b64decode(body_raw).decode("utf-8", errors="replace")
            try:
                criteria = json.loads(body_raw) if isinstance(body_raw, str) else {}
            except json.JSONDecodeError:
                criteria = {}

            max_guests = criteria.get("maxGuests")
            items = _scan_listings_meta(limit=500)
            listings: List[Dict[str, Any]] = []
            for it in items:
                card = _project_public_card(it)
                if max_guests is not None and int(card.get("maxGuests") or 0) < int(max_guests):
                    continue
                listings.append(card)

            payload = {
                "success": True,
                **meta,
                "listings": listings,
                "count": len(listings),
                "timestamp": _now_ms(),
            }
            return _response(200, payload)

        listing_id = path_params.get("listingId")
        if method == "GET" and listing_id:
            item = _get_listing(listing_id)
            if not item:
                return _response(404, {"success": False, "message": "Listing not found"})
            payload = {
                "success": True,
                **meta,
                "listing": _project_public_card(item),
                "timestamp": _now_ms(),
            }
            return _response(200, payload)

        if method == "GET":
            md = _listings_metadata() or {}
            items = _scan_listings_meta()
            listings = [_project_public_card(x) for x in items]
            total_groups = int(md.get("totalGroups") or 0)
            total_rooms = int(md.get("totalRooms") or len(listings))
            payload = {
                "success": True,
                **meta,
                "totalGroups": total_groups,
                "totalRooms": total_rooms,
                "lastUpdated": md.get("updatedAt") or md.get("sourceUpdatedAt"),
                "listings": listings,
                "timestamp": _now_ms(),
            }
            return _response(200, payload)

        return _response(400, {"success": False, "message": f"Unsupported route {method} {path}"})
    except Exception as e:
        print(f"public_api_handler error: {e}")
        return _response(500, {"success": False, "message": "Internal error"})
