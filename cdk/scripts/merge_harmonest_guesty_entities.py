#!/usr/bin/env python3
"""
Merge duplicate listings/reservations after Guesty v2 ID migration.

- Listings: 6 rows -> 3 (merge legacy UUID listings into v2 ObjectId listings, delete legacy)
- Reservations: remap roomId on legacy rows; merge+delete 9 duplicate reservationCode pairs

Usage:
  python scripts/merge_harmonest_guesty_entities.py --client harmonest --env prod
  python scripts/merge_harmonest_guesty_entities.py --client harmonest --env prod --apply
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any, Dict, List, Tuple

import boto3

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "layer-src", "python"))

from common.entity_merge import (
    build_listing_legacy_to_v2_map,
    find_reservation_code_duplicates,
    listing_id_from_item,
    merge_listing_items,
    merge_reservation_duplicate_items,
    remap_reservation_listing_id,
    reservation_id_from_item,
)
from common.models import convert_to_decimal


def _scan_meta(table, prefix: str) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    kwargs: Dict[str, Any] = {
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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--table", help="DynamoDB table (default: SSM /client/env/table/name)")
    parser.add_argument("--client", default="harmonest")
    parser.add_argument("--env", default="prod")
    parser.add_argument("--region", default=os.getenv("AWS_REGION", "eu-central-1"))
    parser.add_argument("--profile", default="harmonestadmin")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write merges and deletes (default: dry-run)",
    )
    args = parser.parse_args()

    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    if args.table:
        table_name = args.table
    else:
        ssm = session.client("ssm")
        table_name = ssm.get_parameter(
            Name=f"/{args.client}/{args.env}/table/name"
        )["Parameter"]["Value"]

    table = session.resource("dynamodb").Table(table_name)
    apply = bool(args.apply)
    mode = "APPLY" if apply else "DRY-RUN"

    print(f"Table: {table_name}  mode: {mode}")

    listings = _scan_meta(table, "LISTING#")
    reservations = _scan_meta(table, "RESERVATION#")

    listing_map = build_listing_legacy_to_v2_map(listings)
    print(f"\nListing ID map (legacy -> v2): {len(listing_map)}")
    for old_id, new_id in sorted(listing_map.items()):
        print(f"  {old_id} -> {new_id}")

    stats = {
        "listings_merged": 0,
        "listings_deleted": 0,
        "reservations_remapped": 0,
        "reservations_merged": 0,
        "reservations_deleted": 0,
    }

    listings_by_id = {listing_id_from_item(x): x for x in listings}

    # --- Listings: merge legacy into v2, delete legacy ---
    for legacy_id, v2_id in listing_map.items():
        canonical = listings_by_id.get(v2_id)
        legacy = listings_by_id.get(legacy_id)
        if not canonical or not legacy:
            print(f"  SKIP listing pair missing row: {legacy_id} -> {v2_id}")
            continue

        merged, changed = merge_listing_items(canonical, legacy)
        if not changed:
            print(f"  listing {v2_id}: no merge changes (will still delete legacy {legacy_id})")
        else:
            print(
                f"  listing merge {v2_id} <- {legacy_id} "
                f"doors={len((merged.get('customFields') or {}).get('doors') or [])}"
            )

        stats["listings_merged"] += 1
        if apply:
            table.put_item(Item=convert_to_decimal(merged))
            table.delete_item(Key={"PK": f"LISTING#{legacy_id}", "SK": "META"})
        stats["listings_deleted"] += 1

    # --- Reservations: duplicate codes ---
    dup_pairs = find_reservation_code_duplicates(reservations)
    print(f"\nReservation code duplicates: {len(dup_pairs)}")
    delete_reservation_ids: set[str] = set()

    for canonical, legacy in dup_pairs:
        canon_id = reservation_id_from_item(canonical)
        leg_id = reservation_id_from_item(legacy)
        merged, changed = merge_reservation_duplicate_items(
            canonical, legacy, listing_map
        )
        print(
            f"  dup {canonical.get('reservationCode')}: keep {canon_id}, "
            f"delete {leg_id}, changed={changed}"
        )
        stats["reservations_merged"] += 1
        delete_reservation_ids.add(leg_id)
        if apply:
            if changed:
                table.put_item(Item=convert_to_decimal(merged))
            table.delete_item(Key={"PK": f"RESERVATION#{leg_id}", "SK": "META"})
        stats["reservations_deleted"] += 1

    # --- Reservations: remap roomId on remaining legacy rows ---
    print("\nRemapping roomId on legacy reservations...")
    for item in reservations:
        rid = reservation_id_from_item(item)
        if rid in delete_reservation_ids:
            continue
        remapped, changed = remap_reservation_listing_id(item, listing_map)
        if not changed:
            continue
        stats["reservations_remapped"] += 1
        if stats["reservations_remapped"] <= 5 or stats["reservations_remapped"] % 100 == 0:
            print(
                f"  remap {rid} {item.get('roomId')} -> {remapped.get('roomId')} "
                f"code={item.get('reservationCode')}"
            )
        if apply:
            table.put_item(Item=convert_to_decimal(remapped))

    print("\nDone:", stats)
    print(f"Expected listings after apply: {len(listings) - stats['listings_deleted']}")
    print(
        f"Expected reservations after apply: "
        f"{len(reservations) - stats['reservations_deleted']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
