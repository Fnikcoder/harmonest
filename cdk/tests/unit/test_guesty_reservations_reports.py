"""Unit tests for Guesty reservations-reports parsing and projection."""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../layer-src/python"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../functions/reservations"))

os.environ.setdefault("G4H_CRED_SECRET", "mock-secret")
os.environ.setdefault("G4H_SESSION_SECRET", "mock-session-secret")
os.environ.setdefault("APP_TABLE", "mock-table")

SAMPLE_ROW = {
    "_id": "6a071c3eeb2d98001126f019",
    "accountId": "698c634f8462114283f39c55",
    "status": {"children": "confirmed"},
    "timezone": {"children": "Europe/Berlin"},
    "listingId": {"children": "6a045def77b4d200132ba6a8"},
    "checkIn": {"value": "2026-05-15 02:00 PM"},
    "checkOut": {"value": "2026-05-16 11:00 AM"},
    "confirmationCode": {"children": "BC-vg2PxkDRV"},
    "listing": {
        "name": "HN2 / HarmoNest Apartments and suites",
        "img": "https://assets.guesty.com/image/upload/example.jpg",
        "withAvatar": True,
    },
    "guest": {"name": "Oliver Müschen", "withAvatar": False},
    "source": {"children": "Booking.com"},
    "guest.email": {"children": "omusch.735532@guest.booking.com"},
    "guestsCount": {"children": 2},
    "money.hostPayout": {"value": 63.36, "currency": "EUR"},
    "money.totalPaid": {"value": 0, "currency": "EUR"},
}

AIRBNB_ROW = {
    "_id": "6a045e477e62890014977346",
    "accountId": "698c634f8462114283f39c55",
    "status": {"children": "confirmed"},
    "timezone": {"children": "Europe/Berlin"},
    "listingId": {"children": "6a045def154b72000f1d251a"},
    "checkIn": {"value": "2026-05-15 02:00 PM"},
    "checkOut": {"value": "2026-05-17 11:00 AM"},
    "confirmationCode": {"children": "HMZ9FANJPK"},
    "listing": {"name": "Hippo / cosy two bedroom apartment(75m2)", "withAvatar": True},
    "guest": {"name": "Marcel Plüschke", "withAvatar": False},
    "source": {"children": "airbnb2"},
    "guest.email": {},
    "guestsCount": {"children": 5},
    "money.hostPayout": {"value": 315.86, "currency": "EUR"},
    "money.totalPaid": {"value": 0, "currency": "EUR"},
}


@pytest.mark.unit
class TestGuestyReservationsReports:
    def test_build_reports_url_keeps_plus_in_columns(self):
        from common.guesty_reservations_reports import build_reports_url

        url = build_reports_url(0, 50)
        assert "columns=checkIn+checkOut+confirmationCode" in url
        assert "checkIn%2BcheckOut" not in url

    def test_parse_report_row_booking_com(self):
        from common.guesty_reservations_reports import parse_report_row

        parsed = parse_report_row(SAMPLE_ROW)

        assert parsed["reservationId"] == "6a071c3eeb2d98001126f019"
        assert parsed["accountId"] == "698c634f8462114283f39c55"
        assert parsed["confirmationCode"] == "BC-vg2PxkDRV"
        assert parsed["listingId"] == "6a045def77b4d200132ba6a8"
        assert parsed["guestName"] == "Oliver"
        assert parsed["guestSurname"] == "Müschen"
        assert parsed["email"] == "omusch.735532@guest.booking.com"
        assert parsed["guestsCount"] == 2
        assert parsed["hostPayout"] == 63.36
        assert parsed["totalPaid"] == 0.0
        assert parsed["currency"] == "EUR"
        assert parsed["guestyStatus"] == "confirmed"
        assert parsed["platform"] == "Booking.com"

    def test_parse_report_row_empty_guest_email(self):
        from common.guesty_reservations_reports import parse_report_row

        parsed = parse_report_row(AIRBNB_ROW)
        assert parsed["email"] == ""
        assert parsed["platform"] == "airbnb2"
        assert parsed["guestsCount"] == 5

    def test_row_to_legacy_flat_and_projection(self):
        from common.guesty_adapters import reservations_report_row_to_legacy_flat
        from unittest.mock import patch

        flat = reservations_report_row_to_legacy_flat(SAMPLE_ROW)

        assert flat["reservationCode"] == "BC-vg2PxkDRV"
        assert flat["roomId"] == "6a045def77b4d200132ba6a8"
        assert flat["hostPayout"] == 63.36
        assert flat["totalPaid"] == 0.0
        assert flat["guestyStatus"] == "confirmed"
        assert flat["nights"] == 1
        assert flat["checkInDate"] is not None
        assert flat["checkOutDate"] is not None

        with patch("common.ddb.get", return_value=None):
            from handler import _project_reservation

            item = _project_reservation(report_row=SAMPLE_ROW)

        assert item["reservationId"] == "6a071c3eeb2d98001126f019"
        assert item["guestySchemaVersion"] == 2
        assert item["guestySource"] == "reservations-reports"
        assert item["guesty"]["_id"] == "6a071c3eeb2d98001126f019"
        assert item["reservationCode"] == "BC-vg2PxkDRV"
        assert item["hostPayout"] is not None
        assert item["totalPaid"] is not None
        assert item["guestsCount"] == 2
        assert "customFields" in item
        assert item["bookingSource"] == "booking_com"
