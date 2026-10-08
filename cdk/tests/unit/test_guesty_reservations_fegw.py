"""Unit tests for reservations-fegw parsing (sample: BC-vg2PxkDRV)."""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../layer-src/python"))

# Minimal slice of real fegw response (6a071c3eeb2d98001126f019)
SAMPLE_FEGW = {
    "_id": "6a071c3eeb2d98001126f019",
    "status": "confirmed",
    "confirmationCode": "BC-vg2PxkDRV",
    "accountId": "698c634f8462114283f39c55",
    "checkInDateLocalized": "2026-05-15",
    "checkOutDateLocalized": "2026-05-16",
    "source": "Booking.com",
    "platform": "bookingCom",
    "guestsCount": 2,
    "unitId": "6a045def77b4d200132ba6a8",
    "eta": "2026-05-15T14:00:00.000Z",
    "etd": "2026-05-16T11:00:00.000Z",
    "conversationExternalId": "e558a78d-8723-5821-9f25-cabcade74713",
    "channelMetadata": {"externalReservationId": "6519756157"},
    "numberOfGuests": {
        "numberOfAdults": 2,
        "numberOfChildren": 0,
        "numberOfInfants": 0,
    },
    "guest": {
        "value": {
            "_id": "6a071c3d14c7818775b79e6e",
            "firstName": "Oliver",
            "lastName": "Müschen",
            "fullName": "Oliver Müschen",
            "email": "omusch.735532@guest.booking.com",
            "phones": ["491737277878"],
            "phone": "491737277878",
        },
        "status": "SUCCESS",
    },
    "money": {
        "value": {
            "currency": "EUR",
            "hostPayout": 63.36,
            "totalPaid": 0,
        },
        "status": "SUCCESS",
    },
    "listing": {
        "value": {
            "_id": "6a045def77b4d200132ba6a8",
            "title": "HarmoNest Apartments and suites",
            "nickname": "HN2",
            "timezone": "Europe/Berlin",
            "defaultCheckInTime": "14:00",
            "defaultCheckOutTime": "11:00",
            "picture": {
                "thumbnail": "https://assets.guesty.com/image/upload/example.jpg"
            },
        },
        "status": "SUCCESS",
    },
}


@pytest.mark.unit
class TestGuestyReservationsFegw:
    def test_parse_fegw_reservation(self):
        from common.guesty_reservations_fegw import parse_fegw_reservation

        p = parse_fegw_reservation(SAMPLE_FEGW)
        assert p["reservationId"] == "6a071c3eeb2d98001126f019"
        assert p["confirmationCode"] == "BC-vg2PxkDRV"
        assert p["email"] == "omusch.735532@guest.booking.com"
        assert p["phoneNumber"] == "491737277878"
        assert p["hostPayout"] == 63.36
        assert p["totalPaid"] == 0
        assert p["guestyStatus"] == "confirmed"
        assert p["platform"] == "Booking.com"
        assert p["externalReservationId"] == "6519756157"

    def test_fegw_to_legacy_flat(self):
        from common.guesty_dates import parse_guesty_display_to_ms
        from common.guesty_reservations_fegw import fegw_reservation_to_legacy_flat

        flat = fegw_reservation_to_legacy_flat(SAMPLE_FEGW)
        assert flat["reservationCode"] == "BC-vg2PxkDRV"
        assert flat["status"] == 1
        assert flat["guestyStatus"] == "confirmed"
        assert flat["email"] == "omusch.735532@guest.booking.com"
        assert flat["phoneNumber"] == "491737277878"
        assert flat["hostPayout"] == 63.36
        assert flat["checkInDisplay"] == "2026-05-15 14:00"
        assert flat["checkOutDisplay"] == "2026-05-16 11:00"
        assert flat["checkInDate"] == parse_guesty_display_to_ms(
            "2026-05-15 14:00", "Europe/Berlin"
        )
        assert flat["listingImage"] is not None

    def test_apply_fegw_to_meta_item(self):
        from common.guesty_reservations_fegw import apply_fegw_to_meta_item

        existing = {
            "PK": "RESERVATION#6a071c3eeb2d98001126f019",
            "SK": "META",
            "reservationId": "6a071c3eeb2d98001126f019",
            "guestySource": "reservations-reports",
            "guestySchemaVersion": 2,
            "guesty": {"_id": "6a071c3eeb2d98001126f019", "checkIn": {"value": "2026-05-15 02:00 PM"}},
            "customFields": {
                "checkin": {"status": "pending"},
                "doorAccesses": {"status": "pending"},
            },
        }
        updated, flat = apply_fegw_to_meta_item(existing, SAMPLE_FEGW)
        assert updated["guestySource"] == "reservations-fegw"
        assert updated["phoneNumber"] == "491737277878"
        assert updated["guestyStatus"] == "confirmed"
        assert updated["customFields"]["checkin"]["status"] == "pending"
        assert flat["status"] == 1
