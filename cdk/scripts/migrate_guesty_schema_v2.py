#!/usr/bin/env python3
"""
One-time migration: legacy rawData / rawDataGuestyApp -> Guesty v2 envelope on DynamoDB items.

Usage (from cdk/ with venv active and AWS credentials + harmonestadmin profile):

  # Preview schema migration
  python scripts/migrate_guesty_schema_v2.py --client harmonest --env prod

  # Apply schema migration
  python scripts/migrate_guesty_schema_v2.py --client harmonest --env prod --apply

  # Optional: enrich each reservation with GET reservations-fegw detail (Okta auth required)
  python scripts/migrate_guesty_schema_v2.py --client harmonest --env prod --apply --fegw-backfill

  # FEGW only (skip listings; only reservations missing fegw detail)
  python scripts/migrate_guesty_schema_v2.py --client harmonest --env prod --apply --fegw-backfill --fegw-only --limit 50
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from typing import Any, Dict, Optional

import boto3

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "layer-src", "python"))

from common.guesty_reservations_fegw import fetch_fegw_reservation
from common.guesty_schema import (
    SOURCE_RESERVATIONS_FEGW,
    migrate_listing_item_to_v2,
    migrate_reservation_item_to_v2,
    upgrade_reservation_item_with_fegw,
)
from common.models import convert_to_decimal

try:
    from common.g4h import get_client, refresh_on_auth_error
except ImportError:
    get_client = None  # type: ignore


def _scan_entities(table, prefix: str):
    kwargs: Dict[str, Any] = {
        "FilterExpression": "begins_with(#pk, :pfx) AND #sk = :sk",
        "ExpressionAttributeNames": {"#pk": "PK", "#sk": "SK"},
        "ExpressionAttributeValues": {":pfx": prefix, ":sk": "META"},
    }
    while True:
        resp = table.scan(**kwargs)
        for it in resp.get("Items", []):
            yield it
        lek = resp.get("LastEvaluatedKey")
        if not lek:
            break
        kwargs["ExclusiveStartKey"] = lek


def _configure_guesty_env(client: str, env: str, region: str, table_name: str) -> None:
    """Point g4h.py at the same secrets/parameters as deployed Lambdas."""
    ssm = boto3.client("ssm", region_name=region)
    os.environ.setdefault("G4H_AUTH_MODE", "okta")
    os.environ["APP_TABLE"] = table_name
    os.environ["G4H_CRED_SECRET"] = ssm.get_parameter(
        Name=f"/{client}/{env}/secrets/guestyforhosts/creds/arn"
    )["Parameter"]["Value"]
    os.environ["G4H_SESSION_SECRET"] = ssm.get_parameter(
        Name=f"/{client}/{env}/secrets/guestyforhosts/webSession/arn"
    )["Parameter"]["Value"]


def _fetch_fegw_detail(session, reservation_id: str) -> Optional[Dict[str, Any]]:
    try:
        return fetch_fegw_reservation(session, reservation_id)
    except Exception:
        return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate listings/reservations to Guesty schema v2")
    parser.add_argument("--table", help="DynamoDB table name")
    parser.add_argument("--client", default="harmonest")
    parser.add_argument("--env", default="prod")
    parser.add_argument("--region", default=os.getenv("AWS_REGION", "eu-central-1"))
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write changes (default: dry-run only prints what would change)",
    )
    parser.add_argument(
        "--fegw-backfill",
        action="store_true",
        help="Fetch reservations-fegw detail per reservation (requires Okta Guesty session)",
    )
    parser.add_argument(
        "--fegw-only",
        action="store_true",
        help="Skip listings + schema migration; only run FEGW backfill on reservations",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Max reservations to FEGW-backfill (0 = no limit)",
    )
    parser.add_argument(
        "--sleep-ms",
        type=int,
        default=200,
        help="Delay between FEGW API calls",
    )
    args = parser.parse_args()

    apply = bool(args.apply)
    table_name = args.table
    if not table_name:
        ssm = boto3.client("ssm", region_name=args.region)
        table_name = ssm.get_parameter(
            Name=f"/{args.client}/{args.env}/table/name"
        )["Parameter"]["Value"]

    ddb = boto3.resource("dynamodb", region_name=args.region)
    table = ddb.Table(table_name)

    stats = {
        "reservations_seen": 0,
        "reservations_migrated": 0,
        "listings_seen": 0,
        "listings_migrated": 0,
        "fegw_fetched": 0,
        "fegw_skipped": 0,
        "fegw_errors": 0,
    }

    mode = "APPLY" if apply else "DRY-RUN"
    print(f"Table: {table_name}  region: {args.region}  mode: {mode}")

    session = None
    if args.fegw_backfill:
        if get_client is None:
            print("ERROR: common.g4h not importable; run from cdk/ with layer on PYTHONPATH")
            return 1
        _configure_guesty_env(args.client, args.env, args.region, table_name)
        session, _ = get_client()
        print("Guesty session ready (G4H_AUTH_MODE=okta)")

    if not args.fegw_only:
        for item in _scan_entities(table, "RESERVATION#"):
            stats["reservations_seen"] += 1
            migrated, changed = migrate_reservation_item_to_v2(item)
            if not changed:
                continue
            stats["reservations_migrated"] += 1
            print(
                f"  reservation {migrated.get('PK')} "
                f"guestySource={migrated.get('guestySource')}"
            )
            if apply:
                table.put_item(Item=convert_to_decimal(migrated))

        for item in _scan_entities(table, "LISTING#"):
            stats["listings_seen"] += 1
            migrated, changed = migrate_listing_item_to_v2(item)
            if not changed:
                continue
            stats["listings_migrated"] += 1
            print(f"  listing {migrated.get('PK')} guestySource={migrated.get('guestySource')}")
            if apply:
                table.put_item(Item=convert_to_decimal(migrated))

    if args.fegw_backfill and session is not None:
        fegw_count = 0
        for item in _scan_entities(table, "RESERVATION#"):
            if args.limit and fegw_count >= args.limit:
                break
            rid = item.get("reservationId") or str(item.get("PK", "")).replace("RESERVATION#", "")
            if not rid:
                continue
            if item.get("guestySource") == SOURCE_RESERVATIONS_FEGW:
                stats["fegw_skipped"] += 1
                continue
            try:
                detail = _fetch_fegw_detail(session, rid)
                if not detail:
                    stats["fegw_errors"] += 1
                    continue
                upgraded, changed = upgrade_reservation_item_with_fegw(item, detail)
                if not changed:
                    stats["fegw_skipped"] += 1
                    continue
                fegw_count += 1
                stats["fegw_fetched"] += 1
                print(f"  fegw {upgraded.get('PK')} code={upgraded.get('reservationCode')}")
                if apply:
                    table.put_item(Item=convert_to_decimal(upgraded))
                if args.sleep_ms:
                    time.sleep(args.sleep_ms / 1000.0)
            except Exception as exc:
                stats["fegw_errors"] += 1
                print(f"  fegw ERROR {rid}: {exc}")

    print("Done:", stats)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
