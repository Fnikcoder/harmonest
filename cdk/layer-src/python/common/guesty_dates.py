"""
Guesty date/time helpers (Europe/Berlin display strings + epoch ms for DynamoDB).

Guesty app APIs return human-readable local times (reports: en-US 12h, fegw: 24h).
Internal storage uses epoch milliseconds on checkInDate / checkOutDate and keeps
the API display strings on checkInDisplay / checkOutDisplay.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Optional, Tuple

from zoneinfo import ZoneInfo

DEFAULT_GUESTY_TIMEZONE = "Europe/Berlin"

# reservations-reports (lang=en-US) and fegw localized strings
_DISPLAY_FORMATS = (
    "%Y-%m-%d %I:%M %p",  # 2026-05-28 02:00 PM
    "%Y-%m-%d %H:%M",  # 2026-05-15 14:00
    "%Y-%m-%d %H:%M:%S",
)


def guesty_timezone(name: Optional[str]) -> ZoneInfo:
    try:
        return ZoneInfo((name or DEFAULT_GUESTY_TIMEZONE).strip() or DEFAULT_GUESTY_TIMEZONE)
    except Exception:
        return ZoneInfo(DEFAULT_GUESTY_TIMEZONE)


def parse_guesty_display_to_ms(
    date_str: Optional[str],
    tz_name: str = DEFAULT_GUESTY_TIMEZONE,
) -> Optional[int]:
    """Parse Guesty UI display time in listing/account timezone → epoch ms."""
    if not date_str or not isinstance(date_str, str):
        return None
    text = date_str.strip()
    if not text:
        return None

    tz = guesty_timezone(tz_name)
    for fmt in _DISPLAY_FORMATS:
        try:
            dt = datetime.strptime(text, fmt).replace(tzinfo=tz)
            return int(dt.timestamp() * 1000)
        except ValueError:
            continue

    if re.match(r"^\d{4}-\d{2}-\d{2}$", text):
        try:
            dt = datetime.strptime(text, "%Y-%m-%d").replace(
                hour=15, minute=0, second=0, tzinfo=tz
            )
            return int(dt.timestamp() * 1000)
        except ValueError:
            pass
    return None


def parse_iso_to_ms(iso: Optional[str]) -> Optional[int]:
    """Parse ISO-8601 (Z or offset) → epoch ms."""
    if not iso or not isinstance(iso, str):
        return None
    text = iso.strip()
    if not text:
        return None
    try:
        if text.endswith("Z"):
            dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        else:
            dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=ZoneInfo("UTC"))
        return int(dt.timestamp() * 1000)
    except Exception:
        return None


def ms_to_guesty_display(
    ts_ms: Optional[Any],
    tz_name: str = DEFAULT_GUESTY_TIMEZONE,
    *,
    use_12h: bool = True,
) -> Optional[str]:
    """Format epoch ms as Guesty-style local display string."""
    if ts_ms is None:
        return None
    try:
        ts = int(float(ts_ms))
    except (TypeError, ValueError):
        return None
    if ts <= 0:
        return None
    if ts < 10**11:
        ts *= 1000
    tz = guesty_timezone(tz_name)
    dt = datetime.fromtimestamp(ts / 1000, tz=ZoneInfo("UTC")).astimezone(tz)
    if use_12h:
        return dt.strftime("%Y-%m-%d %I:%M %p")
    return dt.strftime("%Y-%m-%d %H:%M")


def normalize_checkin_ms(
    ts_ms: Optional[int],
    tz_name: str = DEFAULT_GUESTY_TIMEZONE,
    *,
    default_hour: int = 14,
    default_minute: int = 0,
) -> Optional[int]:
    """
    Legacy G4H rows often store date-only (midnight UTC). Use default check-in
    time in listing timezone (14:00 Europe/Berlin) when no time was specified.
    """
    if ts_ms is None:
        return None
    try:
        ts = int(ts_ms)
    except (TypeError, ValueError):
        return None
    if ts < 10**11:
        ts *= 1000

    tz = guesty_timezone(tz_name)
    dt_utc = datetime.fromtimestamp(ts / 1000, tz=ZoneInfo("UTC"))
    dt_loc = dt_utc.astimezone(tz)

    # Legacy G4H date-only: midnight UTC or midnight in listing TZ
    if (dt_utc.hour == 0 and dt_utc.minute == 0) or (
        dt_loc.hour == 0 and dt_loc.minute == 0
    ):
        adjusted = dt_loc.replace(
            hour=default_hour, minute=default_minute, second=0, microsecond=0
        )
        return int(adjusted.timestamp() * 1000)

    return ts


def resolve_stay_timestamps(
    *,
    check_in_display: Optional[str] = None,
    check_out_display: Optional[str] = None,
    timezone: Optional[str] = None,
    check_in_iso: Optional[str] = None,
    check_out_iso: Optional[str] = None,
    check_in_ms: Optional[int] = None,
    check_out_ms: Optional[int] = None,
    use_12h_display: bool = True,
) -> Tuple[Optional[int], Optional[int], Optional[str], Optional[str]]:
    """
    Unified stay window resolution for reports, fegw, and legacy rows.

    Priority for ms: display string (Berlin/local) → explicit ms → ISO (UTC).
    Fills missing display strings from ms when possible.
    """
    tz = timezone or DEFAULT_GUESTY_TIMEZONE

    cin_ms = (
        parse_guesty_display_to_ms(check_in_display, tz)
        if check_in_display
        else None
    )
    cout_ms = (
        parse_guesty_display_to_ms(check_out_display, tz)
        if check_out_display
        else None
    )

    if cin_ms is None and check_in_ms is not None:
        cin_ms = int(check_in_ms)
    if cout_ms is None and check_out_ms is not None:
        cout_ms = int(check_out_ms)

    if cin_ms is None and check_in_iso:
        cin_ms = parse_iso_to_ms(check_in_iso)
    if cout_ms is None and check_out_iso:
        cout_ms = parse_iso_to_ms(check_out_iso)

    cin_disp = check_in_display or (
        ms_to_guesty_display(cin_ms, tz, use_12h=use_12h_display) if cin_ms else None
    )
    cout_disp = check_out_display or (
        ms_to_guesty_display(cout_ms, tz, use_12h=use_12h_display) if cout_ms else None
    )

    return cin_ms, cout_ms, cin_disp, cout_disp


def stay_nights(check_in_ms: Optional[int], check_out_ms: Optional[int]) -> Optional[int]:
    if not check_in_ms or not check_out_ms or check_out_ms <= check_in_ms:
        return None
    return max(1, int(round((check_out_ms - check_in_ms) / 86400000.0)))


def format_stay_for_email(
    display: Optional[str],
    ts_ms: Optional[Any],
    tz_name: str = DEFAULT_GUESTY_TIMEZONE,
) -> str:
    """Prefer Guesty display string; otherwise format ms in listing timezone."""
    if display and str(display).strip():
        return str(display).strip()
    formatted = ms_to_guesty_display(ts_ms, tz_name, use_12h=True)
    return formatted or "Date not available"
