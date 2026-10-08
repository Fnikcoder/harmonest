"""
Merge duplicate Harmonest DynamoDB entities after Guesty ID migration.

Legacy G4H uses UUID room/reservation IDs; Guesty app APIs use Mongo ObjectId-style
listing IDs. This module merges legacy rows into canonical v2-keyed rows.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, List, Optional, Tuple

from common.guesty_schema import SOURCE_LEGACY_G4H, SOURCE_LISTINGS_V2, SOURCE_RESERVATIONS_REPORTS

# Canonical Guesty v2 listing IDs (prod harmonest).
KNOWN_V2_LISTING_IDS = frozenset(
    {
        "6a045def77b4d200132ba6a8",
        "6a045defe8e8730011e03839",
        "6a045def154b72000f1d251a",
    }
)


def normalize_alias(value: Any) -> str:
    return str(value or "").strip().lower()


def listing_id_from_item(item: Dict[str, Any]) -> str:
    return str(item.get("roomId") or item.get("PK", "").replace("LISTING#", "")).strip()


def reservation_id_from_item(item: Dict[str, Any]) -> str:
    return str(
        item.get("reservationId") or item.get("PK", "").replace("RESERVATION#", "")
    ).strip()


def build_listing_legacy_to_v2_map(
    listings: List[Dict[str, Any]],
) -> Dict[str, str]:
    """Map legacy listing roomId -> canonical v2 listing roomId (by alias)."""
    by_alias: Dict[str, List[Dict[str, Any]]] = {}
    for item in listings:
        alias = normalize_alias(item.get("roomAlias") or item.get("roomName"))
        if not alias:
            continue
        by_alias.setdefault(alias, []).append(item)

    mapping: Dict[str, str] = {}
    for _alias, group in by_alias.items():
        if len(group) != 2:
            continue
        v2_items = [
            x
            for x in group
            if x.get("guestySource") == SOURCE_LISTINGS_V2
            or listing_id_from_item(x) in KNOWN_V2_LISTING_IDS
        ]
        legacy_items = [x for x in group if x.get("guestySource") == SOURCE_LEGACY_G4H]
        if len(v2_items) != 1 or len(legacy_items) != 1:
            continue
        legacy_id = listing_id_from_item(legacy_items[0])
        v2_id = listing_id_from_item(v2_items[0])
        if legacy_id and v2_id and legacy_id != v2_id:
            mapping[legacy_id] = v2_id
    return mapping


def merge_listing_custom_fields(
    canonical: Optional[Dict[str, Any]],
    legacy: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """Prefer legacy operational fields (doors) when canonical is empty."""
    out = deepcopy(canonical or {})
    leg = legacy or {}

    for key, leg_val in leg.items():
        if key == "doors":
            canon_doors = out.get("doors") or []
            leg_doors = leg_val or []
            if len(leg_doors) > len(canon_doors):
                out["doors"] = deepcopy(leg_doors)
            continue
        if not str(out.get(key) or "").strip() and leg_val not in (None, "", [], {}):
            out[key] = deepcopy(leg_val)

    return out


def _checkin_rank(cf: Dict[str, Any]) -> int:
    checkin = cf.get("checkin") if isinstance(cf.get("checkin"), dict) else {}
    if checkin.get("submittedAt"):
        return 3
    if str(checkin.get("status") or "").lower() in ("completed", "submitted"):
        return 2
    if checkin:
        return 1
    return 0


def merge_reservation_custom_fields(
    canonical: Optional[Dict[str, Any]],
    legacy: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """Merge check-in / door access; prefer the richer check-in state."""
    canon_cf = deepcopy(canonical or {})
    leg_cf = legacy or {}

    if _checkin_rank(leg_cf) > _checkin_rank(canon_cf):
        if leg_cf.get("checkin"):
            canon_cf["checkin"] = deepcopy(leg_cf["checkin"])

    leg_doors = leg_cf.get("doorAccesses") or []
    canon_doors = canon_cf.get("doorAccesses") or []
    if len(leg_doors) > len(canon_doors):
        canon_cf["doorAccesses"] = deepcopy(leg_doors)

    for key, leg_val in leg_cf.items():
        if key in ("checkin", "doorAccesses"):
            continue
        if key not in canon_cf and leg_val not in (None, "", [], {}):
            canon_cf[key] = deepcopy(leg_val)

    return canon_cf


def merge_listing_items(
    canonical: Dict[str, Any], legacy: Dict[str, Any]
) -> Tuple[Dict[str, Any], bool]:
    """Merge legacy listing META into canonical v2 listing."""
    merged = deepcopy(canonical)
    changed = False

    new_cf = merge_listing_custom_fields(
        canonical.get("customFields"), legacy.get("customFields")
    )
    if new_cf != (canonical.get("customFields") or {}):
        merged["customFields"] = new_cf
        changed = True

    leg_last = legacy.get("lastCustomUpdate") or 0
    canon_last = merged.get("lastCustomUpdate") or 0
    if leg_last and leg_last > canon_last:
        merged["lastCustomUpdate"] = leg_last
        changed = True

    for field in ("groupId",):
        if not merged.get(field) and legacy.get(field):
            merged[field] = legacy[field]
            changed = True

    return merged, changed


def _patch_guesty_room_id(guesty: Any, old_id: str, new_id: str) -> Any:
    if not isinstance(guesty, dict):
        return guesty
    g = dict(guesty)
    if str(g.get("roomId") or "") == old_id:
        g["roomId"] = new_id
    lid = g.get("listingId")
    if isinstance(lid, dict) and str(lid.get("children") or "") == old_id:
        g["listingId"] = {**lid, "children": new_id}
    elif str(lid or "") == old_id:
        g["listingId"] = new_id
    if str(g.get("unitId") or "") == old_id:
        g["unitId"] = new_id
    return g


def remap_reservation_listing_id(
    item: Dict[str, Any], listing_map: Dict[str, str]
) -> Tuple[Dict[str, Any], bool]:
    """Rewrite top-level and guesty room/listing IDs to canonical v2 listing IDs."""
    old_id = str(item.get("roomId") or "")
    if not old_id or old_id not in listing_map:
        return item, False

    new_id = listing_map[old_id]
    if old_id == new_id:
        return item, False

    merged = deepcopy(item)
    merged["roomId"] = new_id
    if isinstance(merged.get("guesty"), dict):
        merged["guesty"] = _patch_guesty_room_id(merged["guesty"], old_id, new_id)
    return merged, True


def merge_reservation_duplicate_items(
    canonical: Dict[str, Any],
    legacy: Dict[str, Any],
    listing_map: Dict[str, str],
) -> Tuple[Dict[str, Any], bool]:
    """Merge legacy duplicate into reservations-reports (or other canonical) row."""
    merged_item, changed = remap_reservation_listing_id(canonical, listing_map)

    new_cf = merge_reservation_custom_fields(
        canonical.get("customFields"), legacy.get("customFields")
    )
    if new_cf != (canonical.get("customFields") or {}):
        merged_item["customFields"] = new_cf
        changed = True

    leg_last = legacy.get("lastCustomUpdate") or 0
    canon_last = merged_item.get("lastCustomUpdate") or 0
    if leg_last and leg_last > canon_last:
        merged_item["lastCustomUpdate"] = leg_last
        changed = True

    return merged_item, changed


def find_reservation_code_duplicates(
    reservations: List[Dict[str, Any]],
) -> List[Tuple[Dict[str, Any], Dict[str, Any]]]:
    """Pairs of (canonical reports row, legacy row) with same reservationCode."""
    by_code: Dict[str, List[Dict[str, Any]]] = {}
    for item in reservations:
        code = str(item.get("reservationCode") or "").strip()
        if not code:
            continue
        by_code.setdefault(code, []).append(item)

    pairs: List[Tuple[Dict[str, Any], Dict[str, Any]]] = []
    for code, group in by_code.items():
        if len(group) != 2:
            continue
        reports = [
            x for x in group if x.get("guestySource") == SOURCE_RESERVATIONS_REPORTS
        ]
        legacy = [x for x in group if x.get("guestySource") == SOURCE_LEGACY_G4H]
        if len(reports) == 1 and len(legacy) == 1:
            pairs.append((reports[0], legacy[0]))
        else:
            # Prefer v2 listing id + non-legacy source as canonical
            v2_listing = [
                x
                for x in group
                if str(x.get("roomId") or "") in KNOWN_V2_LISTING_IDS
            ]
            other = [x for x in group if x not in v2_listing]
            if len(v2_listing) == 1 and len(other) == 1:
                pairs.append((v2_listing[0], other[0]))
    return pairs
