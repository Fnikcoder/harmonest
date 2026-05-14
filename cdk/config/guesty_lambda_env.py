"""
Guesty / G4H Lambda environment variables shared by CDK stacks and cdk_config helper.

Client JSON: integrations.g4h — optional keys:
  authMode: "legacy" | "okta"
  origin: SPA origin (defaults: guestyforhosts.com if legacy, app.guesty.com if okta)
  appBase: API host (default https://app.guesty.com)
  listingsV2Fields, listingsV2Limit
  reservationsReportsColumns, reservationsReportsFilters, reservationsReportsTimezone, reservationsReportsLimit
  oktaIssuer, oktaClientId, oktaAuthorizeScopes, oktaRedirectUri — passed through when set
"""

from __future__ import annotations

from typing import Any, Dict

_DEFAULT_RES_COLUMNS = (
    "checkIn+checkOut+confirmationCode+listing+guest+status+source+"
    "guest.email+guestsCount+money.hostPayout+money.totalPaid"
)
_DEFAULT_RES_FILTERS = (
    '{"localTime.checkOutWithPlannedDeparture":{"@in_future":true},'
    '"status":{"@in":["confirmed"]}}'
)


def guesty_lambda_env_from_client(client: Dict[str, Any]) -> Dict[str, str]:
    """Build G4H_* env vars for Lambdas that call Guesty (sync, checkin, access notification)."""
    g4h: Dict[str, Any] = (client.get("integrations") or {}).get("g4h") or {}

    auth_mode = str(g4h.get("authMode", "legacy")).lower().strip()
    if auth_mode not in ("legacy", "okta"):
        auth_mode = "legacy"

    origin_default = (
        "https://app.guesty.com" if auth_mode == "okta" else "https://app.guestyforhosts.com"
    )

    out: Dict[str, str] = {
        "G4H_AUTH_MODE": auth_mode,
        "G4H_ORIGIN": str(g4h.get("origin", origin_default)),
        "G4H_APP_BASE": str(g4h.get("appBase", "https://app.guesty.com")),
        "G4H_APP_VERSION": str(g4h.get("appVersion", "6.x")),
        "G4H_PLATFORM": str(g4h.get("platform", "browser--win32")),
        "G4H_DEVICE_UUID": str(
            g4h.get("deviceUuid", f"ypa-uuid-{client.get('name', 'harmonest')}")
        ),
        "G4H_LISTINGS_V2_FIELDS": str(
            g4h.get("listingsV2Fields", "title+nickname+picture.thumbnail+address.full")
        ),
        "G4H_LISTINGS_V2_LIMIT": str(g4h.get("listingsV2Limit", 50)),
        "G4H_RES_REPORTS_COLUMNS": str(g4h.get("reservationsReportsColumns", _DEFAULT_RES_COLUMNS)),
        "G4H_RES_REPORTS_FILTERS": str(g4h.get("reservationsReportsFilters", _DEFAULT_RES_FILTERS)),
        "G4H_RES_REPORTS_TIMEZONE": str(g4h.get("reservationsReportsTimezone", "Europe/Berlin")),
        "G4H_RES_REPORTS_LIMIT": str(g4h.get("reservationsReportsLimit", 50)),
    }

    for src_key, env_key in (
        ("oktaIssuer", "G4H_OKTA_ISSUER"),
        ("oktaClientId", "G4H_OKTA_CLIENT_ID"),
        ("oktaAuthorizeScopes", "G4H_OKTA_AUTHORIZE_SCOPES"),
        ("oktaRedirectUri", "G4H_OKTA_REDIRECT_URI"),
        ("oktaAuthnUrl", "G4H_OKTA_AUTHN_URL"),
        ("oktaTokenExchange", "G4H_OKTA_TOKEN_EXCHANGE"),
    ):
        if g4h.get(src_key):
            out[env_key] = str(g4h[src_key])

    return out
