"""Unit tests for entity_merge (legacy -> v2 listing/reservation merge)."""

from common.entity_merge import (
    build_listing_legacy_to_v2_map,
    merge_listing_custom_fields,
    merge_listing_items,
    merge_reservation_custom_fields,
    remap_reservation_listing_id,
)


def test_build_listing_map():
    listings = [
        {
            "PK": "LISTING#6a045defe8e8730011e03839",
            "roomId": "6a045defe8e8730011e03839",
            "roomAlias": "HN1",
            "guestySource": "listings-v2",
        },
        {
            "PK": "LISTING#ec156ae1-00b6-4f28-9e6c-80797856f18e",
            "roomId": "ec156ae1-00b6-4f28-9e6c-80797856f18e",
            "roomAlias": "HN1",
            "guestySource": "legacy-g4h",
        },
    ]
    m = build_listing_legacy_to_v2_map(listings)
    assert m["ec156ae1-00b6-4f28-9e6c-80797856f18e"] == "6a045defe8e8730011e03839"


def test_merge_listing_doors_from_legacy():
    canon = {"customFields": {"address": "v2 addr", "doors": []}}
    legacy = {
        "customFields": {
            "address": "legacy addr",
            "doors": [{"id": "d1"}, {"id": "d2"}],
        }
    }
    merged, changed = merge_listing_items(
        {"roomId": "v2", "customFields": canon["customFields"]},
        {"customFields": legacy["customFields"]},
    )
    assert changed
    assert len(merged["customFields"]["doors"]) == 2
    assert merged["customFields"]["address"] == "v2 addr"


def test_remap_reservation_room_and_guesty():
    item = {
        "roomId": "legacy-uuid",
        "guesty": {"roomId": "legacy-uuid", "listingId": {"children": "legacy-uuid"}},
    }
    out, changed = remap_reservation_listing_id(
        item, {"legacy-uuid": "6a045def154b72000f1d251a"}
    )
    assert changed
    assert out["roomId"] == "6a045def154b72000f1d251a"
    assert out["guesty"]["roomId"] == "6a045def154b72000f1d251a"
    assert out["guesty"]["listingId"]["children"] == "6a045def154b72000f1d251a"


def test_merge_reservation_checkin_prefers_submitted():
    canon_cf = {"checkin": {"status": "pending", "submittedAt": None}}
    leg_cf = {"checkin": {"status": "completed", "submittedAt": 12345}}
    out = merge_reservation_custom_fields(canon_cf, leg_cf)
    assert out["checkin"]["submittedAt"] == 12345
