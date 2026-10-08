"""Unit tests for Guesty date parsing (reports + fegw display formats)."""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../layer-src/python"))

from common.guesty_dates import (
    format_stay_for_email,
    ms_to_guesty_display,
    normalize_checkin_ms,
    parse_guesty_display_to_ms,
    resolve_stay_timestamps,
)


@pytest.mark.unit
class TestGuestyDates:
    def test_parse_reports_12h_berlin(self):
        ms = parse_guesty_display_to_ms("2026-05-28 02:00 PM", "Europe/Berlin")
        assert ms is not None
        back = ms_to_guesty_display(ms, "Europe/Berlin", use_12h=True)
        assert back == "2026-05-28 02:00 PM"

    def test_parse_fegw_24h_berlin(self):
        from common.guesty_dates import parse_iso_to_ms

        ms = parse_guesty_display_to_ms("2026-05-15 14:00", "Europe/Berlin")
        assert ms is not None
        assert ms != parse_iso_to_ms("2026-05-15T14:00:00.000Z")

    def test_resolve_stay_prefers_display_over_iso(self):
        cin_ms, cout_ms, cin_d, cout_d = resolve_stay_timestamps(
            check_in_display="2026-05-15 14:00",
            check_out_display="2026-05-16 11:00",
            timezone="Europe/Berlin",
            check_in_iso="2026-05-15T14:00:00.000Z",
            check_out_iso="2026-05-16T11:00:00.000Z",
            use_12h_display=True,
        )
        assert cin_ms == parse_guesty_display_to_ms("2026-05-15 14:00", "Europe/Berlin")
        assert cout_ms == parse_guesty_display_to_ms("2026-05-16 11:00", "Europe/Berlin")
        assert cin_d == "2026-05-15 14:00"
        assert cout_d == "2026-05-16 11:00"

    def test_normalize_midnight_to_default_checkin(self):
        # Midnight UTC on a date-only legacy row → 14:00 Berlin
        from datetime import datetime
        from zoneinfo import ZoneInfo

        tz = ZoneInfo("Europe/Berlin")
        midnight_utc = int(
            datetime(2026, 5, 15, 0, 0, tzinfo=ZoneInfo("UTC")).timestamp() * 1000
        )
        adjusted = normalize_checkin_ms(midnight_utc, "Europe/Berlin")
        assert adjusted is not None
        dt = datetime.fromtimestamp(adjusted / 1000, tz=ZoneInfo("UTC")).astimezone(tz)
        assert dt.hour == 14
        assert dt.minute == 0

    def test_format_stay_for_email_prefers_display(self):
        s = format_stay_for_email("2026-06-12 02:00 PM", 1, "Europe/Berlin")
        assert s == "2026-06-12 02:00 PM"
