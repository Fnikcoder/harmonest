#!/usr/bin/env python3
"""Live test: Guesty v2 listings API + optional DynamoDB sync."""

from __future__ import annotations

import argparse
import json
import os
import sys

import boto3

_LAYER = os.path.join(os.path.dirname(__file__), "..", "layer-src", "python")
sys.path.insert(0, _LAYER)


def _configure_env(client: str, env: str, region: str, profile: str) -> str:
    session = boto3.Session(profile_name=profile, region_name=region)
    ssm = session.client("ssm")
    os.environ["G4H_AUTH_MODE"] = "okta"
    os.environ["G4H_CRED_SECRET"] = ssm.get_parameter(
        Name=f"/{client}/{env}/secrets/guestyforhosts/creds/arn"
    )["Parameter"]["Value"]
    os.environ["G4H_SESSION_SECRET"] = ssm.get_parameter(
        Name=f"/{client}/{env}/secrets/guestyforhosts/webSession/arn"
    )["Parameter"]["Value"]
    table = ssm.get_parameter(Name=f"/{client}/{env}/table/name")["Parameter"]["Value"]
    os.environ["APP_TABLE"] = table
    return table


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--client", default="harmonest")
    parser.add_argument("--env", default="prod")
    parser.add_argument("--profile", default="harmonestadmin")
    parser.add_argument("--run-handler", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    table = _configure_env(args.client, args.env, "eu-central-1", args.profile)

    from common.g4h import get_client
    from common.guesty_listings_v2 import build_listings_url, fetch_all_listings, parse_listing_v2

    session, user_id = get_client()
    print(f"user_id={user_id}  table={table}")
    print(f"GET {build_listings_url(0)}")

    results, summary = fetch_all_listings(session)
    print(f"\nFetched {len(results)} listings (API count={summary.get('count')})")
    for i, doc in enumerate(results, 1):
        p = parse_listing_v2(doc)
        print(
            f"  [{i}] {p['listingId']}  {p['nickname']} / {p['title'][:40]}  "
            f"thumb={'yes' if p['thumbnail'] else 'no'}"
        )

    if args.run_handler:
        from unittest.mock import patch

        sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "functions", "listings"))
        from handler import handler as listings_handler

        if args.apply:
            print("\n--- Running listings handler (WRITE) ---")
            result = listings_handler({}, None)
        else:
            print("\n--- Running listings handler (dry-run) ---")
            with patch("handler.put_if_changed", return_value=False):
                result = listings_handler({}, None)
        print(json.dumps(result, indent=2))

    out = os.path.join(os.path.dirname(__file__), "..", "listings_live_sample.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(
            {"count": summary.get("count"), "results": results},
            f,
            indent=2,
            ensure_ascii=False,
        )
    print(f"\nSaved {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
