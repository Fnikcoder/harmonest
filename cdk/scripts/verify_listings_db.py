#!/usr/bin/env python3
import boto3

IDS = [
    "6a045def77b4d200132ba6a8",
    "6a045defe8e8730011e03839",
    "6a045def154b72000f1d251a",
]

t = boto3.Session(profile_name="harmonestadmin", region_name="eu-central-1").resource(
    "dynamodb"
).Table("harmonest-main")

for lid in IDS:
    it = t.get_item(Key={"PK": f"LISTING#{lid}", "SK": "META"}).get("Item") or {}
    cf = it.get("customFields") or {}
    print(f"{lid}:")
    print(f"  guestySource={it.get('guestySource')} alias={it.get('roomAlias')}")
    print(f"  name={it.get('roomName')}")
    print(f"  listingImage={'set' if it.get('listingImage') else 'missing'}")
    print(f"  addressFull={(it.get('addressFull') or '')[:60]}")
    print(f"  customFields.address={(cf.get('address') or '')[:60]}")
    print(f"  doors={len(cf.get('doors') or [])}")
