"""
Guesty app.guesty.com reservations-reports API (sync list view).

GET /api/reservations-reports?smartView=true&columns=...&filters=...&skip=&limit=
sort=checkIn&lang=en-US&timezone=Europe/Berlin

Response: { data: ReportRow[], total, skip, limit, hasAnyReservationReportsInTotal }
Report rows use {children: ...} or {value: ...} cell wrappers.
"""

from __future__ import annotations

import os
import urllib.parse
from typing import Any, Dict, List, Optional, Tuple

from common.guesty_adapters import G4H_APP_BASE, app_json_headers, unwrap_cell

REPORT_COLUMNS = (
    "checkIn+checkOut+confirmationCode+listing+guest+status+source+"
    "guest.email+guestsCount+money.hostPayout+money.totalPaid"
)

DEFAULT_FILTERS = (
    '{"localTime.checkOutWithPlannedDeparture":{"@in_future":true},'
    '"status":{"@in":["confirmed"]}}'
)

REPORTS_PATH = "/api/reservations-reports"


def reports_timezone() -> str:
    return os.getenv("G4H_RES_REPORTS_TIMEZONE", "Europe/Berlin")


def reports_page_limit() -> int:
    return int(os.getenv("G4H_RES_REPORTS_LIMIT", "50"))


def reports_columns() -> str:
    return os.getenv("G4H_RES_REPORTS_COLUMNS", REPORT_COLUMNS)


def reports_filters() -> str:
    return os.getenv("G4H_RES_REPORTS_FILTERS", DEFAULT_FILTERS)


def build_reports_url(skip: int, limit: int) -> str:
    params = {
        "smartView": "true",
        "columns": reports_columns(),
        "filters": reports_filters(),
        "skip": str(skip),
        "limit": str(limit),
        "sort": "checkIn",
        "lang": "en-US",
        "timezone": reports_timezone(),
    }
    # Guesty expects literal '+' between column names (not %2B).
    return f"{G4H_APP_BASE}{REPORTS_PATH}?{urllib.parse.urlencode(params, safe='+')}"


def fetch_reports_page(session, skip: int, limit: int) -> Dict[str, Any]:
    from common.g4h import refresh_on_auth_error

    url = build_reports_url(skip, limit)

    def _call():
        headers = {**dict(session.headers), **app_json_headers()}
        return session.get(url, headers=headers, timeout=60)

    response = refresh_on_auth_error(_call)
    response.raise_for_status()
    return response.json()


def fetch_all_report_rows(session) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Paginate until all rows are fetched.

    Returns (rows, summary) where summary has total, pagesProcessed, lastResponse.
    """
    limit = reports_page_limit()
    skip = 0
    all_rows: List[Dict[str, Any]] = []
    last_response: Optional[Dict[str, Any]] = None
    total: Optional[int] = None

    while True:
        js = fetch_reports_page(session, skip, limit)
        last_response = js
        batch = js.get("data") or []
        if not batch:
            break
        all_rows.extend(batch)
        total = int(js.get("total") or len(all_rows))
        skip += len(batch)
        if skip >= total or skip > 10000:
            break

    pages_processed = (skip // limit) if limit else 0
    if skip % limit:
        pages_processed += 1

    summary = {
        "total": total if total is not None else len(all_rows),
        "pagesProcessed": pages_processed,
        "limit": limit,
        "lastResponse": last_response,
        "hasAnyReservationReportsInTotal": (
            bool(last_response.get("hasAnyReservationReportsInTotal"))
            if last_response
            else bool(all_rows)
        ),
    }
    return all_rows, summary


def _cell_value(row: Dict[str, Any], key: str) -> Any:
    """Read a report cell: prefer .value then unwrap children."""
    cell = row.get(key)
    if isinstance(cell, dict) and "value" in cell:
        return cell.get("value")
    return unwrap_cell(cell)


def _money_cell(row: Dict[str, Any], key: str) -> Tuple[Optional[float], Optional[str]]:
    cell = row.get(key)
    if not isinstance(cell, dict):
        return None, None
    value = cell.get("value")
    currency = cell.get("currency")
    if value is None:
        return None, currency
    try:
        return float(value), currency
    except (TypeError, ValueError):
        return None, currency


def parse_report_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract normalized fields from a reservations-reports row (native shape preserved elsewhere).
    """
    listing_block = row.get("listing") if isinstance(row.get("listing"), dict) else {}
    guest_block = row.get("guest") if isinstance(row.get("guest"), dict) else {}
    guest_name = guest_block.get("name") or ""
    name_parts = guest_name.split(None, 1)

    email_raw = _cell_value(row, "guest.email")
    email = email_raw if isinstance(email_raw, str) else ""

    guests_raw = _cell_value(row, "guestsCount")
    try:
        guests_count = int(guests_raw) if guests_raw is not None else None
    except (TypeError, ValueError):
        guests_count = None

    host_payout, payout_currency = _money_cell(row, "money.hostPayout")
    total_paid, paid_currency = _money_cell(row, "money.totalPaid")
    currency = payout_currency or paid_currency or "EUR"

    status_raw = _cell_value(row, "status")
    status_str = str(status_raw).strip() if status_raw is not None else ""

    source_raw = _cell_value(row, "source")
    source_str = str(source_raw).strip() if source_raw is not None else ""

    return {
        "reservationId": row.get("_id"),
        "accountId": row.get("accountId"),
        "listingId": _cell_value(row, "listingId"),
        "timezone": _cell_value(row, "timezone") or reports_timezone(),
        "confirmationCode": _cell_value(row, "confirmationCode"),
        "checkInDisplay": _cell_value(row, "checkIn"),
        "checkOutDisplay": _cell_value(row, "checkOut"),
        "guestName": name_parts[0] if name_parts else "",
        "guestSurname": name_parts[1] if len(name_parts) > 1 else "",
        "guestFullName": guest_name,
        "email": email,
        "guestsCount": guests_count,
        "hostPayout": host_payout,
        "totalPaid": total_paid,
        "currency": currency,
        "guestyStatus": status_str,
        "platform": source_str,
        "source": source_str,
        "listingName": listing_block.get("name") or "",
        "listingImage": listing_block.get("img"),
    }
