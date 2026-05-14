"""
Guesty HTTP session for Lambdas.

Two modes (G4H_AUTH_MODE):
  legacy — api.guestyforhosts.com login + utoken/stoken (original integration).
  okta   — Okta flow aligned with `api.guesty_new_auth_and_apis/Guesty Full Auto OAuth Collection.postman_collection.json`:
           POST /api/v1/authn → PKCE → GET …/v1/authorize?sessionToken=… → POST …/v1/token (authorization_code).

Optional: G4H_OKTA_TOKEN_EXCHANGE=session_token uses the session_token grant instead of PKCE (experimental).

Set G4H_AUTH_MODE=okta when calling app.guesty.com APIs; keep legacy until handlers are migrated.
"""
import base64
import hashlib
import json
import logging
import os
import re
import secrets
import time
import urllib.parse
from typing import Any, Dict, Optional, Tuple

import boto3
import jwt
import requests
from requests.adapters import HTTPAdapter, Retry

log = logging.getLogger(__name__)
sm = boto3.client("secretsmanager")

# --- env ---
_raw_auth_mode = os.getenv("G4H_AUTH_MODE", "legacy").lower().strip()
if _raw_auth_mode not in ("legacy", "okta"):
    log.warning("Unknown G4H_AUTH_MODE %r; using legacy", _raw_auth_mode)
    G4H_AUTH_MODE = "legacy"
else:
    G4H_AUTH_MODE = _raw_auth_mode

# Legacy SPA default vs Guesty app (Okta)
_ORIGIN_DEFAULT = (
    "https://app.guesty.com" if G4H_AUTH_MODE == "okta" else "https://app.guestyforhosts.com"
)
ORIGIN = os.getenv("G4H_ORIGIN", _ORIGIN_DEFAULT)

# Legacy API + SPA (Guesty for Hosts)
LEGACY_API_BASE = os.getenv("G4H_LEGACY_API_BASE", "https://api.guestyforhosts.com")
LEGACY_LOGIN_URL = f"{LEGACY_API_BASE}/login"

# Okta (Guesty app) — issuer is the authorization server, e.g. .../oauth2/aus2jlqfuwAsNNp3D5d7
G4H_OKTA_ISSUER = os.getenv(
    "G4H_OKTA_ISSUER",
    "https://login.guesty.com/oauth2/aus2jlqfuwAsNNp3D5d7",
).rstrip("/")
G4H_OKTA_AUTHN_URL = os.getenv("G4H_OKTA_AUTHN_URL", "https://login.guesty.com/api/v1/authn")
G4H_OKTA_CLIENT_ID = os.getenv("G4H_OKTA_CLIENT_ID", "0oa2ul8rlePlNldiQ5d7")
G4H_OKTA_CLIENT_SECRET = os.getenv("G4H_OKTA_CLIENT_SECRET")  # optional (confidential client)
G4H_OKTA_SCOPES = os.getenv("G4H_OKTA_SCOPES", "openid profile email offline_access")
# Authorize URL scopes (Postman collection uses openid profile email; add offline_access for refresh_token)
G4H_OKTA_AUTHORIZE_SCOPES = os.getenv("G4H_OKTA_AUTHORIZE_SCOPES", "openid profile email")
G4H_OKTA_REDIRECT_URI = os.getenv(
    "G4H_OKTA_REDIRECT_URI",
    "https://app.guesty.com/auth/login/callback",
)
# pkce = same as Postman (authorize + authorization_code). session_token = urn:okta:oauth:grant-type:session_token
G4H_OKTA_TOKEN_EXCHANGE = os.getenv("G4H_OKTA_TOKEN_EXCHANGE", "pkce").lower().strip()
G4H_OKTA_DEVICE_FINGERPRINT = os.getenv("G4H_OKTA_DEVICE_FINGERPRINT")

G4H_CRED_SECRET = os.environ["G4H_CRED_SECRET"]
G4H_SESSION_SECRET = os.environ["G4H_SESSION_SECRET"]

APP_VERSION = os.getenv("G4H_APP_VERSION", "6.x")
PLATFORM = os.getenv("G4H_PLATFORM", "browser--win32")
DEVICE_UUID = os.getenv("G4H_DEVICE_UUID", "ypa-uuid-lambda")
G_AID_CS = os.getenv("G4H_G_AID_CS")

# Warm-container cache (fields depend on auth mode)
_CACHED: Dict[str, Any] = {"exp": 0}
_SESS: Optional[requests.Session] = None


def _requests_session() -> requests.Session:
    s = requests.Session()
    retry = Retry(
        total=5,
        backoff_factor=0.2,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["HEAD", "GET", "POST", "PUT", "DELETE", "OPTIONS", "TRACE"],
    )
    s.mount("https://", HTTPAdapter(max_retries=retry))
    s.mount("http://", HTTPAdapter(max_retries=retry))
    return s


def _get_secret_json(name_or_arn: str) -> dict:
    return json.loads(sm.get_secret_value(SecretId=name_or_arn)["SecretString"])


def _put_secret_json(name_or_arn: str, obj: dict):
    s = json.dumps(obj)
    try:
        sm.put_secret_value(SecretId=name_or_arn, SecretString=s)
    except sm.exceptions.ResourceNotFoundException:
        if name_or_arn.startswith("arn:aws:secretsmanager:"):
            secret_name = name_or_arn.split(":")[-1].rsplit("-", 1)[0]
        else:
            secret_name = name_or_arn
        sm.create_secret(Name=secret_name, SecretString=s)


def _jwt_exp(access_token: str) -> int:
    payload = jwt.decode(access_token, options={"verify_signature": False})
    return int(payload.get("exp", 0))


def _user_id_from_access_token(access_token: str) -> str:
    payload = jwt.decode(access_token, options={"verify_signature": False})
    for key in ("userId", "uid", "sub"):
        v = payload.get(key)
        if v and key != "sub":
            return str(v)
    sub = payload.get("sub")
    if sub:
        return str(sub)
    raise RuntimeError("Cannot derive user id from access token claims")


def _creds_username_password() -> Tuple[str, str]:
    creds = _get_secret_json(G4H_CRED_SECRET)
    password = creds.get("password")
    if not password:
        raise RuntimeError("G4H credentials secret must include password")
    username = creds.get("username") or creds.get("email")
    if not username:
        raise RuntimeError("G4H credentials secret must include username or email")
    return str(username), str(password)


# --------------------------------------------------------------------------- legacy
def _login_legacy_and_store() -> dict:
    creds = _get_secret_json(G4H_CRED_SECRET)
    s = _requests_session()
    headers = {
        "accept": "application/json, text/plain, */*",
        "content-type": "application/json",
        "origin": ORIGIN,
        "referer": ORIGIN + "/",
        "user-agent": "Mozilla/5.0",
        "authorization": "Bearer null",
    }
    if G_AID_CS:
        headers["g-aid-cs"] = G_AID_CS
    email = creds.get("email") or creds.get("username")
    if not email:
        raise RuntimeError("G4H credentials secret must include email or username")
    body = {
        "email": email,
        "password": creds["password"],
        "model": "undefined",
        "appVersion": APP_VERSION,
        "deviceToken": "undefined",
        "platform": PLATFORM,
        "deviceUUID": DEVICE_UUID,
        "requestDate": str(int(time.time() * 1000)),
        "manufacturer": "Chrome",
        "osVersion": "138",
    }
    r = s.post(LEGACY_LOGIN_URL, headers=headers, json=body, timeout=30)
    r.raise_for_status()
    data = r.json()
    if not data.get("success"):
        raise RuntimeError(f"G4H login failed: {data}")

    utoken = data.get("userToken") or data.get("baseUserInfo", {}).get("userId")
    stoken = data.get("sessionToken") or data.get("stoken")
    if not utoken or not stoken:
        raise RuntimeError(f"G4H tokens missing: {data}")

    sess = {
        "auth_mode": "legacy",
        "cookies": requests.utils.dict_from_cookiejar(s.cookies),
        "utoken": utoken,
        "stoken": stoken,
        "exp": int(time.time()) + 12 * 3600,
    }
    _put_secret_json(G4H_SESSION_SECRET, sess)
    return sess


# --------------------------------------------------------------------------- okta
def _okta_auth_headers() -> Dict[str, str]:
    h: Dict[str, str] = {
        "accept": "application/json",
        "content-type": "application/json",
        "origin": ORIGIN,
        "referer": ORIGIN + "/",
        "user-agent": os.getenv(
            "G4H_OKTA_USER_AGENT",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        ),
        "x-okta-user-agent-extended": os.getenv(
            "G4H_OKTA_X_USER_AGENT", "okta-auth-js/5.8.0 okta-signin-widget-5.16.1"
        ),
    }
    if G4H_OKTA_DEVICE_FINGERPRINT:
        h["x-device-fingerprint"] = G4H_OKTA_DEVICE_FINGERPRINT
    return h


def _okta_authn_on_session(s: requests.Session, username: str, password: str) -> str:
    body = {
        "username": username,
        "password": password,
        "options": {"warnBeforePasswordExpired": True, "multiOptionalFactorEnroll": False},
    }
    r = s.post(G4H_OKTA_AUTHN_URL, headers=_okta_auth_headers(), json=body, timeout=30)
    r.raise_for_status()
    data = r.json()
    status = data.get("status")
    if status == "SUCCESS":
        token = data.get("sessionToken")
        if not token:
            raise RuntimeError(f"Okta authn SUCCESS but no sessionToken: {data}")
        return str(token)

    raise RuntimeError(
        f"Okta primary auth not usable without extra steps (status={status!r}). "
        f"If MFA is required, use an account without MFA for automation or complete MFA in browser. "
        f"Response keys: {list(data.keys())}"
    )


def _pkce_verifier_and_challenge() -> Tuple[str, str]:
    """RFC 7636 S256; verifier length 43–128 (Okta)."""
    verifier = secrets.token_urlsafe(64)
    if len(verifier) > 128:
        verifier = verifier[:128]
    while len(verifier) < 43:
        verifier += secrets.token_urlsafe(8)
    digest = hashlib.sha256(verifier.encode("utf-8")).digest()
    challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return verifier, challenge


def _okta_parse_code_from_location(location: str) -> str:
    if not location:
        raise RuntimeError("Okta authorize: empty Location header")
    if "error=" in location:
        raise RuntimeError(f"Okta authorize error redirect: {location[:800]}")
    m = re.search(r"[?&]code=([^&]+)", location)
    if not m:
        raise RuntimeError(f"Okta authorize: no code in Location: {location[:800]}")
    return urllib.parse.unquote(m.group(1))


def _okta_authorize_for_code(
    s: requests.Session, session_token: str, code_challenge: str, state: str, nonce: str
) -> str:
    """GET /v1/authorize with sessionToken + PKCE; expect 302 with ?code= (same as Postman step 3)."""
    q = urllib.parse.urlencode(
        {
            "client_id": G4H_OKTA_CLIENT_ID,
            "response_type": "code",
            "response_mode": "query",
            "scope": G4H_OKTA_AUTHORIZE_SCOPES,
            "redirect_uri": G4H_OKTA_REDIRECT_URI,
            "state": state,
            "nonce": nonce,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
            "sessionToken": session_token,
        }
    )
    url = f"{G4H_OKTA_ISSUER}/v1/authorize?{q}"
    r = s.get(
        url,
        allow_redirects=False,
        headers={
            "accept": "application/json,text/html",
            "user-agent": _okta_auth_headers()["user-agent"],
        },
        timeout=30,
    )
    if r.status_code not in (302, 301, 303):
        raise RuntimeError(
            f"Okta authorize expected redirect, got HTTP {r.status_code}: {r.text[:500]}"
        )
    loc = r.headers.get("Location") or ""
    return _okta_parse_code_from_location(loc)


def _okta_token_url() -> str:
    return f"{G4H_OKTA_ISSUER}/v1/token"


def _okta_exchange_authorization_code(code: str, code_verifier: str) -> dict:
    """POST /v1/token grant_type=authorization_code (Postman step 4)."""
    form = {
        "client_id": G4H_OKTA_CLIENT_ID,
        "redirect_uri": G4H_OKTA_REDIRECT_URI,
        "grant_type": "authorization_code",
        "code_verifier": code_verifier,
        "code": code,
    }
    if G4H_OKTA_CLIENT_SECRET:
        form["client_secret"] = G4H_OKTA_CLIENT_SECRET

    s = _requests_session()
    r = s.post(
        _okta_token_url(),
        data=form,
        headers={"accept": "application/json", "content-type": "application/x-www-form-urlencoded"},
        timeout=30,
    )
    if not r.ok:
        raise RuntimeError(f"Okta authorization_code token failed: HTTP {r.status_code} {r.text[:500]}")
    return r.json()


def _okta_exchange_session_token(session_token: str) -> dict:
    """Optional: urn:okta:oauth:grant-type:session_token when G4H_OKTA_TOKEN_EXCHANGE=session_token."""
    form: Dict[str, str] = {
        "grant_type": "urn:okta:oauth:grant-type:session_token",
        "client_id": G4H_OKTA_CLIENT_ID,
        "scope": G4H_OKTA_SCOPES,
        "session_token": session_token,
    }
    if G4H_OKTA_CLIENT_SECRET:
        form["client_secret"] = G4H_OKTA_CLIENT_SECRET

    s = _requests_session()
    r = s.post(
        _okta_token_url(),
        data=form,
        headers={"accept": "application/json", "content-type": "application/x-www-form-urlencoded"},
        timeout=30,
    )
    if not r.ok:
        raise RuntimeError(
            f"Okta session_token grant failed: HTTP {r.status_code} {r.text[:500]}"
        )
    return r.json()


def _okta_refresh_tokens(refresh_token: str) -> dict:
    form: Dict[str, str] = {
        "grant_type": "refresh_token",
        "client_id": G4H_OKTA_CLIENT_ID,
        "refresh_token": refresh_token,
    }
    if G4H_OKTA_CLIENT_SECRET:
        form["client_secret"] = G4H_OKTA_CLIENT_SECRET

    s = _requests_session()
    r = s.post(
        _okta_token_url(),
        data=form,
        headers={"accept": "application/json", "content-type": "application/x-www-form-urlencoded"},
        timeout=30,
    )
    if not r.ok:
        raise RuntimeError(f"Okta refresh failed: HTTP {r.status_code} {r.text[:500]}")
    return r.json()


def _okta_tokens_to_session(token_json: dict) -> dict:
    access = token_json.get("access_token")
    if not access:
        raise RuntimeError(f"Okta token response missing access_token: {list(token_json.keys())}")
    exp = _jwt_exp(access)
    sess: Dict[str, Any] = {
        "auth_mode": "okta",
        "access_token": access,
        "exp": exp - 120,  # refresh 2 min before JWT exp
    }
    if token_json.get("refresh_token"):
        sess["refresh_token"] = token_json["refresh_token"]
    if token_json.get("id_token"):
        sess["id_token"] = token_json["id_token"]
    return sess


def _login_okta_pkce() -> dict:
    """
    Full browser-equivalent login from Postman 'Guesty Full Auto OAuth Collection':
    authn → PKCE → GET authorize (sessionToken) → POST token (authorization_code).
    Reuses one Session so login.guesty.com cookies (e.g. JSESSIONID) carry between steps.
    """
    username, password = _creds_username_password()
    s = _requests_session()
    session_token = _okta_authn_on_session(s, username, password)
    verifier, challenge = _pkce_verifier_and_challenge()
    state = secrets.token_urlsafe(24)
    nonce = secrets.token_urlsafe(24)
    code = _okta_authorize_for_code(s, session_token, challenge, state, nonce)
    tj = _okta_exchange_authorization_code(code, verifier)
    return _okta_tokens_to_session(tj)


def _login_okta_and_store() -> dict:
    if G4H_OKTA_TOKEN_EXCHANGE == "session_token":
        username, password = _creds_username_password()
        s = _requests_session()
        st = _okta_authn_on_session(s, username, password)
        tj = _okta_exchange_session_token(st)
        sess = _okta_tokens_to_session(tj)
    else:
        sess = _login_okta_pkce()
    _put_secret_json(G4H_SESSION_SECRET, sess)
    return sess


def _refresh_okta_session(sess: dict) -> dict:
    rt = sess.get("refresh_token")
    if rt:
        try:
            tj = _okta_refresh_tokens(rt)
            new_sess = _okta_tokens_to_session(tj)
            _put_secret_json(G4H_SESSION_SECRET, new_sess)
            return new_sess
        except Exception as e:
            log.warning("Okta refresh_token failed, falling back to full login: %s", e)
    return _login_okta_and_store()


# --------------------------------------------------------------------------- load / client
def _session_expired(sess: dict) -> bool:
    return int(sess.get("exp", 0)) < int(time.time())


def _load_or_login() -> dict:
    global _CACHED
    if _CACHED.get("exp", 0) > time.time():
        return _CACHED

    if G4H_AUTH_MODE == "okta":
        try:
            sess = _get_secret_json(G4H_SESSION_SECRET)
            if sess.get("auth_mode") != "okta" or not sess.get("access_token"):
                raise KeyError("wrong shape or missing token")
            if _session_expired(sess):
                sess = _refresh_okta_session(sess)
        except Exception:
            sess = _login_okta_and_store()
        _CACHED = dict(sess)
        return _CACHED

    # legacy
    try:
        sess = _get_secret_json(G4H_SESSION_SECRET)
        if sess.get("auth_mode") == "okta" or not sess.get("utoken"):
            raise KeyError("legacy session missing")
        if _session_expired(sess):
            raise KeyError("expired")
    except Exception:
        sess = _login_legacy_and_store()
    _CACHED = dict(sess)
    return _CACHED


def get_client() -> Tuple[requests.Session, str]:
    """
    Returns (requests.Session with headers set, user_id).

    legacy: user_id is utoken (legacy API body field userId).
    okta:   user_id from JWT claim userId / uid / sub (for new APIs).
    """
    global _SESS
    sess_info = _load_or_login()

    if _SESS is None:
        _SESS = _requests_session()

    _SESS.cookies.clear()

    if G4H_AUTH_MODE == "okta":
        at = sess_info["access_token"]
        uid = sess_info.get("cached_user_id")
        if not uid:
            uid = _user_id_from_access_token(at)
            sess_info["cached_user_id"] = uid
            _CACHED["cached_user_id"] = uid

        _SESS.headers.update(
            {
                "accept": "application/json, text/plain, */*",
                "content-type": "application/json;charset=UTF-8",
                "origin": ORIGIN,
                "referer": ORIGIN + "/",
                "user-agent": os.getenv(
                    "G4H_OKTA_USER_AGENT",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
                ),
                "authorization": f"Bearer {at}",
            }
        )
        return _SESS, str(uid)

    _SESS.cookies.update(sess_info.get("cookies") or {})
    _SESS.headers.update(
        {
            "accept": "application/json, text/plain, */*",
            "content-type": "application/json;charset=UTF-8",
            "origin": ORIGIN,
            "referer": ORIGIN + "/",
            "user-agent": "Mozilla/5.0",
            "utoken": sess_info["utoken"],
            "stoken": sess_info["stoken"],
        }
    )
    return _SESS, sess_info["utoken"]


def refresh_on_auth_error(fn, *args, **kwargs):
    """Call fn; if 401/403, refresh session once and retry."""
    try:
        r = fn(*args, **kwargs)
        if r.status_code in (401, 403):
            raise PermissionError("auth")
        return r
    except PermissionError:
        if G4H_AUTH_MODE == "okta":
            try:
                sess = _get_secret_json(G4H_SESSION_SECRET)
                fresh = _refresh_okta_session(sess)
            except Exception:
                fresh = _login_okta_and_store()
        else:
            fresh = _login_legacy_and_store()
        global _CACHED
        _CACHED = dict(fresh)
        get_client()
        return fn(*args, **kwargs)
