#!/usr/bin/env python3
"""
Backfill checkInDisplay/checkOutDisplay and normalize legacy date-only ms timestamps.

Usage:
  python scripts/backfill_stay_display_dates.py --client harmonest --env prod
  python scripts/backfill_stay_display_dates.py --client harmonest --env prod --apply
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any, Dict, List

import boto3

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "layer-src", "python"))

from common.guesty_dates import (
    DEFAULT_GUESTY_TIMEZONE,
    ms_to_guesty_display,
    normalize_checkin_ms,
    resolve_stay_timestamps,
)
from common.models import convert_to_decimal


def _scan_reservations(table) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    kwargs: Dict[str, Any] = {
        "FilterExpression": "begins_with(#pk, :pfx) AND #sk = :sk",
        "ExpressionAttributeNames": {"#pk": "PK", "#sk": "SK"},
        "ExpressionAttributeValues": {":pfx": "RESERVATION#", ":sk": "META"},
    }
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get("Items", []))
        lek = resp.get("LastEvaluatedKey")
        if not lek:
            break
        kwargs["ExclusiveStartKey"] = lek
    return items


def backfill_item(item: Dict[str, Any]) -> tuple[Dict[str, Any], bool]:
    tz = str(item.get("timezone") or DEFAULT_GUESTY_TIMEZONE)

    raw_cin = item.get("checkInDateWithTime") or item.get("checkInDate")
    raw_cout = item.get("checkOutDateWithTime") or item.get("checkOutDate")

    # Legacy rows: ms only, no Guesty display — normalize date-only to 14:00 Berlin first
    if not item.get("checkInDisplay") and raw_cin is not None:
        raw_cin = normalize_checkin_ms(raw_cin, tz) or raw_cin

    cin_ms, cout_ms, cin_disp, cout_disp = resolve_stay_timestamps(
        check_in_display=item.get("checkInDisplay"),
        check_out_display=item.get("checkOutDisplay"),
        timezone=tz,
        check_in_ms=raw_cin,
        check_out_ms=raw_cout,
        use_12h_display=True,
    )

    updated = dict(item)
    changed = False

    for field, value in (
        ("checkInDate", cin_ms),
        ("checkInDateWithTime", cin_ms),
        ("checkOutDate", cout_ms),
        ("checkOutDateWithTime", cout_ms),
        ("checkInDisplay", cin_disp),
        ("checkOutDisplay", cout_disp),
    ):
        if value is None:
            continue
        if updated.get(field) != value:
            updated[field] = value
            changed = True

    if not updated.get("timezone"):
        updated["timezone"] = tz
        changed = True

    return updated, changed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--table")
    parser.add_argument("--client", default="harmonest")
    parser.add_argument("--env", default="prod")
    parser.add_argument("--region", default="eu-central-1")
    parser.add_argument("--profile", default="harmonestadmin")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    table_name = args.table
    if not table_name:
        table_name = session.client("ssm").get_parameter(
            Name=f"/{args.client}/{args.env}/table/name"
        )["Parameter"]["Value"]

    table = session.resource("dynamodb").Table(table_name)
    items = _scan_reservations(table)

    stats = {"seen": 0, "updated": 0}
    for item in items:
        stats["seen"] += 1
        updated, changed = backfill_item(item)
        if not changed:
            continue
        stats["updated"] += 1
        rid = updated.get("reservationId") or updated.get("PK")
        print(
            f"  {rid} checkIn={updated.get('checkInDisplay')} "
            f"checkOut={updated.get('checkOutDisplay')}"
        )
        if args.apply:
            table.put_item(Item=convert_to_decimal(updated))

    print(f"Done ({'APPLY' if args.apply else 'DRY-RUN'}):", stats)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
