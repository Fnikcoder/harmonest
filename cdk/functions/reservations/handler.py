from typing import Dict, Any, List, Optional

import os

from common.g4h import get_client, refresh_on_auth_error
from common.ddb import put_if_changed, now_ms, get
from common.models import create_reservation_from_g4h, convert_to_decimal
from common.guesty_adapters import use_guesty_app_api, merge_legacy_raw_for_update
from common.guesty_reservations_reports import fetch_all_report_rows
from common.guesty_schema import (
    SOURCE_LEGACY_G4H,
    SOURCE_RESERVATIONS_REPORTS,
    apply_guesty_envelope,
    denormalize_reservation_flat,
    merge_guesty_for_update,
    resolve_reservation_guesty_from_item,
)

LEGACY_BASE = "https://api.guestyforhosts.com"
LEGACY_URL = f"{LEGACY_BASE}/reservations/recent"


def _fetch_legacy_page(session, user_id: str, page: int) -> Dict[str, Any]:
    def _call():
        return session.post(LEGACY_URL, json={"userId": user_id, "page": page}, timeout=45)

    response = refresh_on_auth_error(_call)
    response.raise_for_status()
    payload = response.json()
    if not payload.get("success"):
        raise RuntimeError(f"Legacy reservations API failure: {payload}")
    return payload


def _fetch_legacy_rows(session, user_id: str) -> tuple[List[Dict[str, Any]], Dict[str, Any]]:
    all_rows: List[Dict[str, Any]] = []
    page = 0
    last_response: Optional[Dict[str, Any]] = None
    seven_days_ago_ms = now_ms() - (7 * 24 * 60 * 60 * 1000)

    while True:
        payload = _fetch_legacy_page(session, user_id, page)
        last_response = payload
        batch = payload.get("reservationList") or []
        if not batch:
            break

        oldest_update = None
        for reservation in batch:
            last_update = reservation.get("lastUpdateDate")
            if last_update and (oldest_update is None or last_update < oldest_update):
                oldest_update = last_update

        all_rows.extend(batch)

        if oldest_update and oldest_update < seven_days_ago_ms:
            break

        page += 1
        if page >= 20:
            break

    return all_rows, {
        "total": len(all_rows),
        "pagesProcessed": page,
        "lastResponse": last_response,
    }


def _project_reservation(
    report_row: Optional[Dict[str, Any]] = None,
    legacy_raw: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build reservation META from reservations-reports row or legacy G4H payload."""
    reservation_id = None
    if report_row:
        reservation_id = report_row.get("_id")
    elif legacy_raw:
        reservation_id = legacy_raw.get("reservationId")

    existing_reservation = None
    existing_custom_fields = None
    existing_last_custom_update = None
    if reservation_id:
        existing_reservation = get(f"RESERVATION#{reservation_id}", "META")
        if existing_reservation:
            existing_custom_fields = existing_reservation.get("customFields", {})
            existing_last_custom_update = existing_reservation.get("lastCustomUpdate")

    if report_row is not None:
        prev_guesty, _ = resolve_reservation_guesty_from_item(existing_reservation or {})
        merged_guesty = merge_guesty_for_update(prev_guesty, report_row)
        flat = denormalize_reservation_flat(merged_guesty, SOURCE_RESERVATIONS_REPORTS)
        reservation = create_reservation_from_g4h(flat, existing_custom_fields)
        apply_guesty_envelope(reservation, merged_guesty, SOURCE_RESERVATIONS_REPORTS)
    else:
        merged_raw = merge_legacy_raw_for_update(
            existing_reservation.get("rawData") if existing_reservation else None,
            legacy_raw or {},
        )
        reservation = create_reservation_from_g4h(merged_raw, existing_custom_fields)
        apply_guesty_envelope(reservation, dict(merged_raw), SOURCE_LEGACY_G4H)

    if existing_reservation and not reservation.get("reservationCode"):
        prev_code = existing_reservation.get("reservationCode")
        if prev_code:
            reservation["reservationCode"] = prev_code

    if existing_last_custom_update:
        reservation["lastCustomUpdate"] = existing_last_custom_update

    return reservation


def _persist_sync_metadata(
    *,
    api_tier: str,
    total_reservations: int,
    pages_processed: int,
    last_response: Optional[Dict[str, Any]],
    reports_summary: Optional[Dict[str, Any]] = None,
) -> None:
    body: Dict[str, Any] = {
        "type": "api_response",
        "apiTier": api_tier,
        "success": True,
        "totalReservations": total_reservations,
        "pagesProcessed": pages_processed,
        "sourceUpdatedAt": now_ms(),
        "updatedAt": now_ms(),
    }
    if api_tier == "legacy" and last_response:
        body["success"] = bool(last_response.get("success"))
        body["errorCode"] = last_response.get("errorCode", -1)
        body["errorMessage"] = last_response.get("errorMessage", "")
        body["message"] = last_response.get("message", "")
    if reports_summary:
        body["reportsTotal"] = reports_summary.get("total")
        body["hasAnyReservationReportsInTotal"] = reports_summary.get(
            "hasAnyReservationReportsInTotal"
        )

    put_if_changed(
        pk="API_RESPONSE#SYNC_RESERVATION",
        sk="METADATA",
        body=body,
        hash_fields=["success", "totalReservations", "pagesProcessed"],
    )


def handler(event, context):
    if os.getenv("RESERVATIONS_SYNC_ENABLED", "true").lower() not in ("1", "true", "yes"):
        return {
            "success": True,
            "skipped": True,
            "reason": "RESERVATIONS_SYNC_ENABLED is false",
        }

    session, user_id = get_client()
    report_rows: List[Dict[str, Any]] = []
    legacy_rows: List[Dict[str, Any]] = []
    reports_summary: Optional[Dict[str, Any]] = None
    legacy_summary: Optional[Dict[str, Any]] = None

    if use_guesty_app_api():
        report_rows, reports_summary = fetch_all_report_rows(session)
        api_tier = "guesty_app"
        hash_fields = ["guestyHash"]
    else:
        legacy_rows, legacy_summary = _fetch_legacy_rows(session, user_id)
        api_tier = "legacy"
        hash_fields = ["rawDataHash"]

    total = len(report_rows) if use_guesty_app_api() else len(legacy_rows)
    pages_processed = (
        int(reports_summary["pagesProcessed"])
        if reports_summary
        else int(legacy_summary["pagesProcessed"]) if legacy_summary else 0
    )
    last_response = (
        reports_summary.get("lastResponse") if reports_summary else legacy_summary.get("lastResponse")
        if legacy_summary
        else None
    )

    _persist_sync_metadata(
        api_tier=api_tier,
        total_reservations=total,
        pages_processed=pages_processed,
        last_response=last_response,
        reports_summary=reports_summary,
    )

    reservations_written = 0

    if use_guesty_app_api():
        for row in report_rows:
            reservation_model = _project_reservation(report_row=row)
            rid = reservation_model.get("reservationId")
            if not rid:
                continue
            if put_if_changed(
                pk=f"RESERVATION#{rid}",
                sk="META",
                body=convert_to_decimal(reservation_model),
                hash_fields=hash_fields,
            ):
                reservations_written += 1
    else:
        for legacy_raw in legacy_rows:
            reservation_model = _project_reservation(legacy_raw=legacy_raw)
            rid = reservation_model.get("reservationId")
            if not rid:
                continue
            if put_if_changed(
                pk=f"RESERVATION#{rid}",
                sk="META",
                body=convert_to_decimal(reservation_model),
                hash_fields=hash_fields,
            ):
                reservations_written += 1

    return {
        "success": True,
        "apiTier": api_tier,
        "totalReservations": total,
        "reservationsWritten": reservations_written,
        "pagesProcessed": pages_processed,
        "reportsTotal": reports_summary.get("total") if reports_summary else None,
    }
