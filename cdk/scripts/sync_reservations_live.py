#!/usr/bin/env python3
"""
Live test: Guesty reservations-reports API + optional DynamoDB sync.

From cdk/ with venv and AWS profile (default harmonestadmin):

  # Fetch from Guesty only, print summary + write sample JSON
  python scripts/sync_reservations_live.py --client harmonest --env prod

  # Project one row (no DDB write)
  python scripts/sync_reservations_live.py --client harmonest --env prod --sample 3

  # Full lambda handler dry-run (no writes)
  python scripts/sync_reservations_live.py --client harmonest --env prod --run-handler

  # Write to DynamoDB (same as scheduled sync)
  python scripts/sync_reservations_live.py --client harmonest --env prod --run-handler --apply
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List

import boto3

_LAYER = os.path.join(os.path.dirname(__file__), "..", "layer-src", "python")
_RES_HANDLER = os.path.join(os.path.dirname(__file__), "..", "functions", "reservations")
sys.path.insert(0, _LAYER)
sys.path.insert(0, _RES_HANDLER)


def _configure_env(client: str, env: str, region: str, profile: str, table_name: str | None) -> str:
    session = boto3.Session(profile_name=profile, region_name=region)
    ssm = session.client("ssm")
    os.environ["G4H_AUTH_MODE"] = "okta"
    os.environ["G4H_CRED_SECRET"] = ssm.get_parameter(
        Name=f"/{client}/{env}/secrets/guestyforhosts/creds/arn"
    )["Parameter"]["Value"]
    os.environ["G4H_SESSION_SECRET"] = ssm.get_parameter(
        Name=f"/{client}/{env}/secrets/guestyforhosts/webSession/arn"
    )["Parameter"]["Value"]
    if not table_name:
        table_name = ssm.get_parameter(Name=f"/{client}/{env}/table/name")["Parameter"]["Value"]
    os.environ["APP_TABLE"] = table_name
    os.environ["RESERVATIONS_SYNC_ENABLED"] = "true"
    return table_name


def _json_default(obj: Any) -> Any:
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Not JSON serializable: {type(obj)}")


def _print_row_summary(parsed: Dict[str, Any], index: int) -> None:
    print(
        f"  [{index}] {parsed.get('reservationId')}  "
        f"code={parsed.get('confirmationCode')}  "
        f"{parsed.get('checkInDisplay')} -> {parsed.get('checkOutDisplay')}  "
        f"guest={parsed.get('guestFullName')!r}  "
        f"platform={parsed.get('platform')}  "
        f"payout={parsed.get('hostPayout')} {parsed.get('currency')}"
    )


def _compare_with_ddb(table, reservation_id: str, projected: Dict[str, Any]) -> None:
    item = table.get_item(
        Key={"PK": f"RESERVATION#{reservation_id}", "SK": "META"}
    ).get("Item")
    if not item:
        print(f"    DDB: (no existing META for {reservation_id})")
        return
    src = item.get("guestySource", "?")
    code = item.get("reservationCode")
    match_code = code == projected.get("reservationCode")
    print(
        f"    DDB: guestySource={src}  code={code}  "
        f"match_code={match_code}  price={item.get('price')} hostPayout={item.get('hostPayout')}"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Live reservations-reports fetch/sync test")
    parser.add_argument("--client", default="harmonest")
    parser.add_argument("--env", default="prod")
    parser.add_argument("--region", default="eu-central-1")
    parser.add_argument("--profile", default="harmonestadmin")
    parser.add_argument("--table", help="Override DynamoDB table name")
    parser.add_argument("--sample", type=int, default=5, help="Rows to print in detail (0 = none)")
    parser.add_argument(
        "--out",
        default="reservations_reports_live.json",
        help="Write API + parsed sample to this file under cdk/",
    )
    parser.add_argument(
        "--run-handler",
        action="store_true",
        help="Invoke reservations handler (dry-run unless --apply)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="With --run-handler: write to DynamoDB",
    )
    parser.add_argument(
        "--compare-ddb",
        action="store_true",
        help="Compare first N samples with existing DynamoDB META",
    )
    args = parser.parse_args()

    table_name = _configure_env(args.client, args.env, args.region, args.profile, args.table)
    print(f"Guesty Okta auth  table={table_name}  profile={args.profile}")

    from common.g4h import get_client
    from common.guesty_adapters import reservations_report_row_to_legacy_flat
    from common.guesty_reservations_reports import (
        build_reports_url,
        fetch_all_report_rows,
        parse_report_row,
    )

    http_session, user_id = get_client()
    print(f"Session OK  user_id={user_id}")
    print(f"URL (page 0): {build_reports_url(0, 50)}")

    rows, summary = fetch_all_report_rows(http_session)
    total = summary.get("total", len(rows))
    print(f"\nFetched {len(rows)} rows  API total={total}  pages={summary.get('pagesProcessed')}")
    print(f"hasAnyReservationReportsInTotal={summary.get('hasAnyReservationReportsInTotal')}")

    parsed_rows: List[Dict[str, Any]] = [parse_report_row(r) for r in rows]

    if args.sample > 0:
        print(f"\n--- First {min(args.sample, len(parsed_rows))} reservations ---")
        ddb = None
        if args.compare_ddb:
            ddb = boto3.Session(profile_name=args.profile, region_name=args.region).resource(
                "dynamodb"
            ).Table(table_name)
        for i, parsed in enumerate(parsed_rows[: args.sample], start=1):
            _print_row_summary(parsed, i)
            flat = reservations_report_row_to_legacy_flat(rows[i - 1])
            print(
                f"    flat: nights={flat.get('nights')}  "
                f"email={flat.get('email')!r}  totalPaid={flat.get('totalPaid')}"
            )
            if ddb and parsed.get("reservationId"):
                _compare_with_ddb(ddb, parsed["reservationId"], parsed)

    out_path = os.path.join(os.path.dirname(__file__), "..", args.out)
    payload = {
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "count": len(rows),
            "total": total,
            "pagesProcessed": summary.get("pagesProcessed"),
            "hasAnyReservationReportsInTotal": summary.get(
                "hasAnyReservationReportsInTotal"
            ),
        },
        "sampleRaw": rows[: min(3, len(rows))],
        "sampleParsed": parsed_rows[: min(3, len(parsed_rows))],
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False, default=_json_default)
    print(f"\nWrote {out_path}")

    if args.run_handler:
        from unittest.mock import patch

        from handler import handler as reservations_handler

        if args.apply:
            print("\n--- Running handler (WRITE to DynamoDB) ---")
            result = reservations_handler({}, None)
        else:
            print("\n--- Running handler DRY-RUN (no DynamoDB writes) ---")
            with patch("handler.put_if_changed", return_value=False):
                result = reservations_handler({}, None)
        print(json.dumps(result, indent=2))

        if args.apply:
            print("\nRe-fetch one written item from DDB (first row):")
            if parsed_rows and parsed_rows[0].get("reservationId"):
                rid = parsed_rows[0]["reservationId"]
                tbl = boto3.Session(profile_name=args.profile, region_name=args.region).resource(
                    "dynamodb"
                ).Table(table_name)
                item = tbl.get_item(Key={"PK": f"RESERVATION#{rid}", "SK": "META"}).get("Item")
                if item:
                    print(
                        f"  {rid}: guestySource={item.get('guestySource')} "
                        f"code={item.get('reservationCode')} "
                        f"hostPayout={item.get('hostPayout')} guestsCount={item.get('guestsCount')}"
                    )
                else:
                    print(f"  {rid}: not found after sync")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
