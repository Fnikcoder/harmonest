#!/usr/bin/env python3
"""Live test: fetch one reservation via reservations-fegw and optionally update DDB."""

from __future__ import annotations

import argparse
import json
import os
import sys

import boto3

_LAYER = os.path.join(os.path.dirname(__file__), "..", "layer-src", "python")
sys.path.insert(0, _LAYER)


def _configure_env(client: str, env: str, region: str, profile: str) -> None:
    session = boto3.Session(profile_name=profile, region_name=region)
    ssm = session.client("ssm")
    os.environ["G4H_AUTH_MODE"] = "okta"
    os.environ["G4H_CRED_SECRET"] = ssm.get_parameter(
        Name=f"/{client}/{env}/secrets/guestyforhosts/creds/arn"
    )["Parameter"]["Value"]
    os.environ["G4H_SESSION_SECRET"] = ssm.get_parameter(
        Name=f"/{client}/{env}/secrets/guestyforhosts/webSession/arn"
    )["Parameter"]["Value"]
    os.environ["APP_TABLE"] = ssm.get_parameter(Name=f"/{client}/{env}/table/name")["Parameter"]["Value"]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("reservation_id", nargs="?", default="6a071c3eeb2d98001126f019")
    parser.add_argument("--client", default="harmonest")
    parser.add_argument("--env", default="prod")
    parser.add_argument("--profile", default="harmonestadmin")
    parser.add_argument("--apply", action="store_true", help="Write merged item to DynamoDB")
    args = parser.parse_args()

    _configure_env(args.client, args.env, "eu-central-1", args.profile)

    from common.g4h import get_client
    from common.ddb import get, put
    from common.guesty_reservations_fegw import (
        apply_fegw_to_meta_item,
        fegw_detail_url,
        fetch_fegw_reservation,
        parse_fegw_reservation,
        fegw_reservation_to_legacy_flat,
    )
    from common.models import convert_to_decimal

    session, user_id = get_client()
    print(f"user_id={user_id}")
    print(f"GET {fegw_detail_url(args.reservation_id)}")

    raw = fetch_fegw_reservation(session, args.reservation_id)
    parsed = parse_fegw_reservation(raw)
    flat = fegw_reservation_to_legacy_flat(raw)

    print("\n--- Parsed ---")
    for k in (
        "confirmationCode",
        "guestFullName",
        "email",
        "phoneNumber",
        "hostPayout",
        "guestyStatus",
        "platform",
        "checkInDisplay",
        "externalReservationId",
    ):
        print(f"  {k}: {parsed.get(k)}")

    existing = get(f"RESERVATION#{args.reservation_id}", "META")
    if existing:
        print(f"\nDB before: guestySource={existing.get('guestySource')} "
              f"phone={existing.get('phoneNumber')} email={existing.get('email')}")
        updated, _ = apply_fegw_to_meta_item(existing, raw)
        print(f"DB after merge: guestySource={updated.get('guestySource')} "
              f"phone={updated.get('phoneNumber')} guestyStatus={updated.get('guestyStatus')}")
        if args.apply:
            put(convert_to_decimal(updated))
            print("Written to DynamoDB.")
    else:
        print("\nNo existing META in DDB for this id.")

    out = os.path.join(os.path.dirname(__file__), "..", "fegw_live_sample.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"parsed": parsed, "flat": flat}, f, indent=2, default=str)
    print(f"\nSaved {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
