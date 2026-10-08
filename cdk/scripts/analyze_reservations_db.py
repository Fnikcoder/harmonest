#!/usr/bin/env python3
"""Analyze reservations-reports cohort in DynamoDB."""
from __future__ import annotations

import argparse
import json
from collections import Counter
from decimal import Decimal
from typing import Any, Dict, List

import boto3


def d(v: Any) -> Any:
    if isinstance(v, Decimal):
        f = float(v)
        return int(f) if f == int(f) else f
    return v


def is_missing(item: Dict[str, Any], key: str) -> bool:
    v = item.get(key)
    if v is None or v == "" or v == {}:
        return True
    return False


def scan_reservations(table) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    kwargs = {
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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", default="harmonestadmin")
    parser.add_argument("--region", default="eu-central-1")
    parser.add_argument("--table", default="harmonest-main")
    parser.add_argument("--out", default="reservations_db_analysis.json")
    args = parser.parse_args()

    table = boto3.Session(profile_name=args.profile, region_name=args.region).resource(
        "dynamodb"
    ).Table(args.table)

    all_items = scan_reservations(table)
    reports = [i for i in all_items if i.get("guestySource") == "reservations-reports"]
    cohort = reports

    n = len(cohort)
    fields = [
        "reservationCode",
        "guestName",
        "email",
        "roomName",
        "checkInDate",
        "checkOutDate",
        "hostPayout",
        "totalPaid",
        "guestsCount",
        "platform",
        "listingImage",
        "checkInDisplay",
    ]

    coverage: Dict[str, Dict[str, int]] = {}
    platforms = Counter()
    booking = Counter()
    listings = Counter()
    payout_sum = 0.0
    issues: List[Dict[str, str]] = []
    rows_summary: List[Dict[str, Any]] = []

    for item in cohort:
        rid = item.get("reservationId") or item.get("PK", "").replace("RESERVATION#", "")
        for f in fields:
            coverage.setdefault(f, {"ok": 0, "missing": 0})
            if f == "email":
                ok = bool(str(item.get("email") or "").strip())
            elif f == "listingImage":
                ok = bool(item.get("listingImage"))
            elif f == "totalPaid":
                ok = item.get("totalPaid") is not None
            else:
                ok = not is_missing(item, f)
            coverage[f]["ok" if ok else "missing"] += 1

        platforms[item.get("platform") or "(empty)"] += 1
        booking[item.get("bookingSource") or "(empty)"] += 1
        listings[item.get("roomId") or "(no listing)"] += 1

        hp = item.get("hostPayout") or item.get("price")
        if hp is not None:
            payout_sum += float(d(hp))

        if not item.get("reservationCode"):
            issues.append({"id": rid, "issue": "missing reservationCode"})
        if not item.get("checkInDate"):
            issues.append({"id": rid, "issue": "missing checkInDate (ms)"})
        email = str(item.get("email") or "").strip()
        plat = str(item.get("platform") or "")
        if not email and "airbnb" not in plat.lower():
            issues.append({"id": rid, "issue": "missing email", "platform": plat})

        rows_summary.append(
            {
                "reservationId": rid,
                "reservationCode": item.get("reservationCode"),
                "checkInDisplay": item.get("checkInDisplay"),
                "checkOutDisplay": item.get("checkOutDisplay"),
                "guest": f"{item.get('guestName', '')} {item.get('guestSurname', '')}".strip(),
                "email": email or None,
                "platform": plat,
                "roomName": item.get("roomName"),
                "roomId": item.get("roomId"),
                "guestsCount": d(item.get("guestsCount")),
                "hostPayout": d(item.get("hostPayout")),
                "totalPaid": d(item.get("totalPaid")),
                "nights": d(item.get("nights")),
                "bookingSource": item.get("bookingSource"),
                "hasCustomCheckin": bool(item.get("customFields", {}).get("checkin")),
                "checkinStatus": (item.get("customFields") or {})
                .get("checkin", {})
                .get("status"),
            }
        )

    rows_summary.sort(key=lambda r: r.get("checkInDisplay") or "")

    by_src = Counter(i.get("guestySource", "?") for i in all_items)
    cin_dates = sorted(r["checkInDisplay"] for r in rows_summary if r.get("checkInDisplay"))

    report = {
        "table": args.table,
        "totalReservationsInDb": len(all_items),
        "cohortSize": n,
        "cohortFilter": "guestySource=reservations-reports",
        "fieldCoverage": {
            f: {"ok": coverage[f]["ok"], "pct": round(100 * coverage[f]["ok"] / n, 1) if n else 0}
            for f in fields
        },
        "platforms": dict(platforms.most_common()),
        "bookingSource": dict(booking.most_common()),
        "uniqueListings": len(listings),
        "listingsBreakdown": dict(listings.most_common()),
        "hostPayoutTotalEur": round(payout_sum, 2),
        "hostPayoutAvgEur": round(payout_sum / n, 2) if n else 0,
        "checkInRange": {"first": cin_dates[0], "last": cin_dates[-1]} if cin_dates else None,
        "customFields": {
            "withCheckin": sum(1 for i in cohort if i.get("customFields", {}).get("checkin")),
            "withDoorAccesses": sum(
                1 for i in cohort if i.get("customFields", {}).get("doorAccesses")
            ),
        },
        "allReservationsByGuestySource": dict(by_src.most_common()),
        "issues": issues,
        "rows": rows_summary,
    }

    out_path = args.out
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"Table: {args.table}")
    print(f"Total META reservations: {len(all_items)}")
    print(f"Cohort (reservations-reports): {n}")
    print()
    print("Field coverage:")
    for f in fields:
        c = report["fieldCoverage"][f]
        print(f"  {f}: {c['ok']}/{n} ({c['pct']}%)")
    print()
    print("Platforms:")
    for p, c in platforms.most_common():
        print(f"  {p}: {c}")
    print()
    print(f"Listings: {len(listings)} unique roomIds")
    for lid, c in listings.most_common():
        print(f"  {lid}: {c} reservations")
    print()
    print(f"Host payout total: EUR {report['hostPayoutTotalEur']:,.2f}")
    print(f"Host payout avg:   EUR {report['hostPayoutAvgEur']:,.2f}")
    if cin_dates:
        print(f"Check-in range: {cin_dates[0]} .. {cin_dates[-1]}")
    print()
    print(f"customFields preserved: checkin {report['customFields']['withCheckin']}/{n}, "
          f"doorAccesses {report['customFields']['withDoorAccesses']}/{n}")
    print()
    print("All DB reservations by guestySource:")
    for s, c in by_src.most_common():
        print(f"  {s}: {c}")
    if issues:
        print(f"\nIssues ({len(issues)}):")
        for iss in issues:
            print(f"  {iss}")
    else:
        print("\nNo critical data issues.")
    print(f"\nFull report: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
