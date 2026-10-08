import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../layer-src/python"))

SAMPLE = {
    "_id": "6a045def77b4d200132ba6a8",
    "title": "HarmoNest Apartments and suites",
    "nickname": "HN2",
    "address": {"full": "Giesenkirchener Straße 126, Mönchengladbach, Nordrhein-Westfalen 41238, Germany"},
    "accountId": "698c634f8462114283f39c55",
    "picture": {
        "thumbnail": "https://assets.guesty.com/image/upload/example.jpg"
    },
}


@pytest.mark.unit
class TestGuestyListingsV2:
    def test_url_keeps_plus_in_fields(self):
        from common.guesty_listings_v2 import build_listings_url

        url = build_listings_url(0)
        assert "fields=title+nickname+picture.thumbnail+address.full" in url
        assert "picture.thumbnail%2Baddress" not in url

    def test_parse_listing(self):
        from common.guesty_listings_v2 import parse_listing_v2, listing_v2_to_legacy_room_shape

        p = parse_listing_v2(SAMPLE)
        assert p["listingId"] == "6a045def77b4d200132ba6a8"
        assert p["nickname"] == "HN2"
        assert "Giesenkirchener" in p["addressFull"]
        assert p["thumbnail"]

        flat = listing_v2_to_legacy_room_shape(SAMPLE)
        assert flat["roomId"] == "6a045def77b4d200132ba6a8"
        assert flat["listingImage"] == p["thumbnail"]
        assert flat["addressFull"] == p["addressFull"]
