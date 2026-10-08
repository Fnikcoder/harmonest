#!/usr/bin/env python3
"""Scan harmonest-main for duplicate listings/reservations across legacy vs v2 IDs."""
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from decimal import Decimal
from typing import Any, Dict, List

import boto3


def d(v: Any) -> Any:
    if isinstance(v, Decimal):
        f = float(v)
        return int(f) if f == int(f) else f
    if isinstance(v, dict):
        return {k: d(x) for k, x in v.items()}
    if isinstance(v, list):
        return [d(x) for x in v]
    return v


def scan_meta(table, prefix: str) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    kwargs = {
        "FilterExpression": "begins_with(#pk, :pfx) AND #sk = :sk",
        "ExpressionAttributeNames": {"#pk": "PK", "#sk": "SK"},
        "ExpressionAttributeValues": {":pfx": prefix, ":sk": "META"},
    }
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get("Items", []))
        lek = resp.get("LastEvaluatedKey")
        if not lek:
            break
        kwargs["ExclusiveStartKey"] = lek
    return items


def listing_key(item: Dict[str, Any]) -> str:
    return str(item.get("roomAlias") or item.get("roomName") or "").strip().lower()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", default="harmonestadmin")
    parser.add_argument("--region", default="eu-central-1")
    parser.add_argument("--table", default="harmonest-main")
    parser.add_argument("--out", default="entity_duplicates_analysis.json")
    args = parser.parse_args()

    table = boto3.Session(profile_name=args.profile, region_name=args.region).resource(
        "dynamodb"
    ).Table(args.table)

    listings = scan_meta(table, "LISTING#")
    reservations = scan_meta(table, "RESERVATION#")

    listing_rows = []
    for it in listings:
        rid = it.get("roomId") or str(it.get("PK", "")).replace("LISTING#", "")
        listing_rows.append(
            {
                "roomId": rid,
                "roomAlias": it.get("roomAlias"),
                "roomName": it.get("roomName"),
                "guestySource": it.get("guestySource"),
                "guestySchemaVersion": it.get("guestySchemaVersion"),
                "hasGuesty": bool(it.get("guesty")),
                "hasRawData": bool(it.get("rawData")),
                "doors": len((it.get("customFields") or {}).get("doors") or []),
                "address": (it.get("customFields") or {}).get("address", "")[:80],
                "updatedAt": d(it.get("updatedAt")),
            }
        )

    by_alias = defaultdict(list)
    for row in listing_rows:
        k = listing_key({"roomAlias": row["roomAlias"], "roomName": row["roomName"]})
        if k:
            by_alias[k].append(row)

    res_by_source = Counter(it.get("guestySource") or "(none)" for it in reservations)
    res_by_schema = Counter(
        str(it.get("guestySchemaVersion") or "legacy") for it in reservations
    )

    # Reservations pointing at each listing id
    res_by_room = Counter(str(it.get("roomId") or "(none)") for it in reservations)

    report = {
        "table": args.table,
        "listingsCount": len(listings),
        "listings": listing_rows,
        "listingsByAlias": {k: v for k, v in by_alias.items() if len(v) > 1},
        "reservationsCount": len(reservations),
        "reservationsByGuestySource": dict(res_by_source),
        "reservationsBySchema": dict(res_by_schema),
        "reservationsByRoomId": dict(res_by_room.most_common(30)),
    }

    print(f"Listings: {len(listings)}")
    for row in sorted(listing_rows, key=lambda r: (r.get("roomAlias") or "", r.get("roomId") or "")):
        print(
            f"  {row['roomId'][:24]:24} alias={row['roomAlias']!r:6} "
            f"src={row['guestySource']} doors={row['doors']} "
            f"guesty={row['hasGuesty']} raw={row['hasRawData']}"
        )
    dup_aliases = {k: v for k, v in by_alias.items() if len(v) > 1}
    if dup_aliases:
        print("\nDuplicate aliases (likely merge candidates):")
        for alias, rows in dup_aliases.items():
            print(f"  {alias}: {[r['roomId'] for r in rows]}")

    print(f"\nReservations: {len(reservations)}")
    print("  by guestySource:", dict(res_by_source))
    print("  by schema:", dict(res_by_schema))

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nWrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
