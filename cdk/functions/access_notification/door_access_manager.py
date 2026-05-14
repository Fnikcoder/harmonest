"""
Clean Door Access Manager
Provides two simple functions for generating door access codes:
1. generate_qr_code() - for QRLock doors
2. generate_pin_code() - for TTLock doors
"""

import os
import json
import time
import hmac
import hashlib
import secrets
from typing import Dict, Any, Optional

import boto3
import requests
from botocore.exceptions import ClientError
from zoneinfo import ZoneInfo
import random

from datetime import datetime, timezone, timedelta




# =========================
# QRLOCK
# =========================
class QRLockClient:
    """Simple QRLock client for generating QR codes"""

    def __init__(self):
        self.base_url = "https://hms.qrlock.net/api/app"
        self.login_url = f"{self.base_url}/auth/signin"
        self.generate_url = f"{self.base_url}/qrcode/generate"
        self.email: Optional[str] = None
        self.password: Optional[str] = None
        self.access_token: Optional[str] = None
        self._load_credentials()

    def _sm(self):
        return boto3.client("secretsmanager")

    def _get_secret_json(self, secret_id: str) -> dict:
        res = self._sm().get_secret_value(SecretId=secret_id)
        if "SecretString" in res:
            return json.loads(res["SecretString"])
        # very rare: binary
        return json.loads(res["SecretBinary"].decode())

    def _put_secret_json(self, secret_id: str, value: dict):
        self._sm().put_secret_value(SecretId=secret_id, SecretString=json.dumps(value))

    def _load_credentials(self):
        """Load QRLock credentials and cached token from Secrets Manager"""
        env_name = os.environ.get("ENVIRONMENT", "prod")

        # credentials
        creds = self._get_secret_json(f"harmonest/{env_name}/qrlock/credentials")
        self.email = creds["email"].strip()
        self.password = creds["password"]

        # cached token (optional)
        try:
            tok = self._get_secret_json(f"harmonest/{env_name}/qrlock/token")
            if time.time() < tok.get("expires_at", 0):
                self.access_token = tok["access_token"]
                print("Using existing QRLock token")
            else:
                print("QRLock token expired, will authenticate")
        except ClientError:
            print("No existing QRLock token found, will authenticate")

    def _save_token(self, token: str, hours: int = 23):
        """Save token to Secrets Manager"""
        env_name = os.environ.get("ENVIRONMENT", "prod")
        self._put_secret_json(
            f"harmonest/{env_name}/qrlock/token",
            {"access_token": token, "created_at": time.time(), "expires_at": time.time() + hours * 3600},
        )

    def authenticate(self) -> bool:
        """Authenticate with QRLock API (per spec)"""
        if self.access_token:
            return True

        headers = {
            "Accept": "application/json",
            "User-Agent": "harmonest-qrlock/1.0",
        }
        payload = {"email": self.email, "password": self.password}

        r = requests.post(self.login_url, json=payload, headers=headers, timeout=30)

        ctype = r.headers.get("content-type", "").lower()
        if "text/html" in ctype or r.text.strip().lower().startswith("<!doctype html"):
            raise RuntimeError(f"QRLock auth returned HTML ({r.status_code}). Body:\n{r.text}")

        if r.status_code != 200:
            raise RuntimeError(
                f"QRLock auth failed: {r.status_code} {r.text}\n"
                f"Sent headers: {dict(r.request.headers)}\n"
                f"Sent body: {r.request.body}"
            )

        data = r.json()
        token = data.get("accessToken")
        if not (data.get("auth") and token):
            raise RuntimeError(f"QRLock auth unexpected payload: {data}")

        self.access_token = token
        self._save_token(token)
        print("QRLock authentication successful")
        return True

    @staticmethod
    def _normalize_ms(ts_val: int) -> int:
        """Accept seconds or ms; return ms."""
        ts = int(ts_val)
        return ts if ts > 10**11 else ts * 1000

    @staticmethod
    def _fmt_qrlock_local(ts_ms: int, tz_name: str = "Europe/Berlin") -> str:
        """
        Convert ms timestamp to QRLock's expected local datetime string:
        YYYY-MM-DDTHH:MM:SS  (no timezone suffix)
        """
        from datetime import datetime, timezone
        ts_ms = QRLockClient._normalize_ms(ts_ms)
        dt_utc = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
        dt_loc = dt_utc.astimezone(ZoneInfo(tz_name))
        # minute precision OK, but keeping seconds = :00 to match your working sample
        return dt_loc.strftime("%Y-%m-%dT%H:%M:%S")

    def generate_qr_code(self, reader_id: int, start_time_ms: int, end_time_ms: int) -> Optional[str]:
        """Generate QR code for QRLock door"""
        if not self.access_token and not self.authenticate():
            return None
        start_time_ms = int(start_time_ms)
        end_time_ms = int(end_time_ms)

        # normalize & ensure positive window
        start_ms = self._normalize_ms(start_time_ms)
        end_ms   = self._normalize_ms(end_time_ms)
        if end_ms <= start_ms:
            end_ms = start_ms + 60_000  # +1 minute

        block_data = {
            "from": self._fmt_qrlock_local(start_ms),  # e.g. 2025-07-31T16:32:00 (Europe/Berlin)
            "to":   self._fmt_qrlock_local(end_ms),
            "readerId": int(reader_id),
        }

        headers = {
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            # IMPORTANT: spec requires exactly this header
            "x-access-token": self.access_token,
        }

        payload = {
            "APIVersion": "2.0",  # None would default to 1.0; we use 2.0 explicitly
            "email": None,        # we don't want QR emailed by the service
            "qrCodePayload": {
                "blocks": [block_data],
                "qrCodeGenerierungsVersion": "2.0",
                # 32-bit hex (8 chars), uppercase
                "randomPrefix": f"{secrets.randbits(32):08X}",
            },
        }

        r = requests.post(self.generate_url, json=payload, headers=headers, timeout=30)
        if r.status_code == 401:
            print(f"QRLock token invalid/expired: {r.text}")
            return None
        if r.status_code >= 400:
            print(f"QRLock API error {r.status_code}: {r.text}")
            return None

        data = r.json()
        code = data.get("qrCode")
        print(f"Generated data: {data}")
        if not code:
            print(f"QR generate returned no qrCode: {data}")
            return None
        return code


# =========================
# TTLOCK
# =========================
class TTLockClient:
    """TTLock client using official OpenAPI (OAuth2) for generating PIN codes."""

    def __init__(self):
        self.base_url = "https://euapi.ttlock.com"
        self.username: Optional[str] = None
        self.password: Optional[str] = None  # MD5 hash required
        self.app_id: Optional[str] = None
        self.app_secret: Optional[str] = None
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self._load_credentials()

    def _to_ms(self, ts) -> int:
        """Accept seconds or milliseconds; always return milliseconds."""
        ts = int(ts)
        return ts if ts > 10**11 else ts * 1000  # 13-digit ms stays, 10-digit sec -> ms

    # ---------- Secrets Manager ----------
    def _sm(self):
        return boto3.client("secretsmanager")

    def _get_secret_json(self, secret_id: str) -> dict:
        res = self._sm().get_secret_value(SecretId=secret_id)
        if "SecretString" in res:
            return json.loads(res["SecretString"])
        return json.loads(res["SecretBinary"].decode())

    def _put_secret_json(self, secret_id: str, value: dict):
        self._sm().put_secret_value(SecretId=secret_id, SecretString=json.dumps(value))

    def _load_credentials(self):
        env = os.environ.get("ENVIRONMENT", "prod")
        creds = self._get_secret_json(f"harmonest/{env}/ttlock/credentials")

        self.username = creds["username"]
        self.password = creds["password"]          # MUST be MD5 (32 lowercase hex)
        self.app_id = creds["app_id"]
        self.app_secret = creds["app_secret"]

        try:
            tok = self._get_secret_json(f"harmonest/{env}/ttlock/token")
            if time.time() < tok.get("expires_at", 0):
                self.access_token = tok["access_token"]
                self.refresh_token = tok["refresh_token"]
                print("Using existing TTLock token")
            else:
                print("TTLock token expired, will refresh")
                self.refresh_token = tok.get("refresh_token")
                self._refresh()
        except ClientError:
            print("No existing TTLock token found, will authenticate")

    def _save_token(self, access_token: str, refresh_token: str, expires_in: int):
        env = os.environ.get("ENVIRONMENT", "prod")
        self._put_secret_json(
            f"harmonest/{env}/ttlock/token",
            {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "created_at": time.time(),
                "expires_at": time.time() + int(expires_in),
            },
        )

    # ---------- Auth ----------
    def _authenticate(self) -> bool:
        payload = {
            "clientId": self.app_id,
            "clientSecret": self.app_secret,
            "username": self.username,
            "password": self.password,  # already MD5
            "grant_type": "password",
        }
        headers = {"Content-Type": "application/x-www-form-urlencoded"}

        resp = requests.post(f"{self.base_url}/oauth2/token", data=payload, headers=headers, timeout=30)
        if resp.status_code != 200:
            print("TTLock auth failed:", resp.status_code, resp.text[:300])
            return False

        data = resp.json()
        self.access_token = data["access_token"]
        self.refresh_token = data["refresh_token"]
        self._save_token(self.access_token, self.refresh_token, data.get("expires_in", 7776000))
        print("TTLock authentication successful")
        return True

    def _refresh(self) -> bool:
        if not self.refresh_token:
            print("No refresh_token available, full login required")
            return self._authenticate()

        payload = {
            "clientId": self.app_id,
            "clientSecret": self.app_secret,
            "grant_type": "refresh_token",
            "refresh_token": self.refresh_token,
        }
        headers = {"Content-Type": "application/x-www-form-urlencoded"}

        resp = requests.post(f"{self.base_url}/oauth2/token", data=payload, headers=headers, timeout=30)
        if resp.status_code != 200:
            print("TTLock refresh failed:", resp.status_code, resp.text[:300])
            return self._authenticate()

        data = resp.json()
        self.access_token = data["access_token"]
        self.refresh_token = data["refresh_token"]
        self._save_token(self.access_token, self.refresh_token, data.get("expires_in", 7776000))
        print("TTLock token refreshed")
        return True

    # ---------- Helpers ----------
    @staticmethod
    def _extract_custom_pin_from_phone(phone: Optional[str]) -> Optional[str]:
        if not phone:
            return None
        digits = "".join(ch for ch in phone if ch.isdigit())
        return digits[-4:] if len(digits) >= 4 else None

    def _post_form(self, path: str, form: dict) -> requests.Response:
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        url = f"{self.base_url}{path}"
        return requests.post(url, data=form, headers=headers, timeout=30)

    def _is_token_expired(self, resp: requests.Response) -> bool:
        # TTLock returns JSON with errorCode=10004 for expired/invalid token
        try:
            js = resp.json()
            return js.get("errorCode") == 10004
        except Exception:
            return resp.status_code == 401



    # ---------- Lock detail (for offline generation) ----------
    def _get_lock_detail(self, lock_id: str) -> Optional[dict]:
        """Fetch lock details (incl. keyboardPwdVersion). Cache upstream if desired."""
        if not self.access_token and not self._authenticate():
            print("Auth failed in _get_lock_detail")
            return None
        form = {
            "clientId": self.app_id,
            "accessToken": self.access_token,
            "lockId": str(lock_id),
            "date": int(time.time() * 1000),
        }
        resp = self._post_form("/v3/lock/detail", form)
        if resp.status_code != 200:
            print("lock/detail HTTP", resp.status_code, resp.text[:300])
            return None
        try:
            js = resp.json()
        except Exception:
            print("lock/detail non-JSON", resp.text[:300])
            return None

        # success schema: either no errorCode or errorCode==0
        if isinstance(js, dict) and js.get("errorCode") in (0, "0", None) and js.get("lockId"):
            return js

        if isinstance(js, dict) and js.get("errorCode") == 10004 and self._refresh():
            form["accessToken"] = self.access_token
            resp2 = self._post_form("/v3/lock/detail", form)
            if resp2.status_code == 200:
                try:
                    js2 = resp2.json()
                    if isinstance(js2, dict) and js2.get("errorCode") in (0, "0", None) and js2.get("lockId"):
                        return js2
                except Exception:
                    pass
        print("lock/detail logical error", js)
        return None

    @staticmethod
    def _align_to_hour_ms(ts_ms: int) -> int:
        """Force minutes/seconds to :00:00 for /keyboardPwd/get."""
        dt = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
        dt0 = dt.replace(minute=0, second=0, microsecond=0)
        if dt > dt0:
            dt0 = dt0 + timedelta(hours=1)
        return int(dt0.timestamp() * 1000)

    # ---------- PUSH mode (your existing implementation via gateway) ----------
    def generate_pin_code(
        self, lock_id: str, pin_name: str,
        start_time_ms: int, end_time_ms: int,
        guest_phone: Optional[str] = None,
    ) -> Optional[str]:
        """Try to add a custom PIN to the lock via gateway (addType=2)."""
        try:
            # --- auth ---
            if not self.access_token and not self._authenticate():
                print("Authentication failed; aborting PIN generation.")
                return None

            # --- normalize times ---
            start_ms = self._to_ms(start_time_ms)
            end_ms   = self._to_ms(end_time_ms)
            if end_ms <= start_ms:
                end_ms = start_ms + 60_000

            # --- PIN candidate generator (avoid duplicates quickly) ---
            tried: set[str] = set()
            def next_pin(prev_was_duplicate: bool) -> str:
                # try phone last-4 only on first attempt
                if not prev_was_duplicate:
                    p = self._extract_custom_pin_from_phone(guest_phone)
                    if p and p.isdigit() and 4 <= len(p) <= 9:
                        return p
                # fallback: random 5–6 digits to reduce clashes
                for _ in range(20):
                    p = f"{random.randint(10000, 999999)}"
                    if p not in tried:
                        return p
                return f"{random.randint(1000, 9999)}"

            headers = {"Content-Type": "application/x-www-form-urlencoded"}
            url = f"{self.base_url}/v3/keyboardPwd/add"

            def ok_and_return(js: dict, pin: str) -> Optional[str]:
                kid = js.get("keyboardPwdId")
                if kid:
                    print(f"TTLock success id={kid}, pin={pin}, window={start_ms}->{end_ms}")
                    return pin
                print("HTTP 200 but no keyboardPwdId in response:", js)
                return None

            def explain(ec: int) -> str:
                m = {
                    0: "OK",
                    10004: "Access token expired",
                    10006: "No permission / not bound",
                    10007: "Lock not exist or not bound",
                    30001: "Invalid parameters",
                    30003: "Passcode not allowed / conflict",
                    30007: "Duplicate passcode",
                    30009: "Lock/Gateway offline",
                    30011: "Keyboard storage full",
                    30013: "Invalid time window",
                    50000: "Server error / throttling",
                    -3007: "Duplicate passcode",  # alt schema
                    -2012: "No gateway bound",
                }
                return m.get(ec, "Unknown TTLock error")

            # up to 5 attempts: initial (maybe phone last-4) + 4 randoms
            prev_dup = False
            for attempt in range(5):
                pin = next_pin(prev_dup)
                tried.add(pin)

                form = {
                    "clientId": self.app_id,
                    "accessToken": self.access_token,
                    "lockId": str(lock_id),
                    "keyboardPwd": pin,
                    "keyboardPwdName": (pin_name or "Guest")[:30],
                    "keyboardPwdType": "3",  # Period
                    "startDate": start_ms,
                    "endDate": end_ms,
                    "addType": "2",          # via gateway (remote)
                    "date": int(time.time() * 1000),
                }

                # request (single retry on timeout)
                try:
                    resp = requests.post(url, data=form, headers=headers, timeout=30)
                except requests.Timeout:
                    print("TTLock request timed out; retrying once…")
                    resp = requests.post(url, data=form, headers=headers, timeout=30)
                if resp.status_code != 200:
                    print(f"TTLock HTTP error: {resp.status_code}, body={resp.text[:300]}")
                    return None

                # parse
                try:
                    data = resp.json()
                except Exception:
                    print("TTLock non-JSON body:", resp.text[:300])
                    return None

                # --- handle both schemas ---
                ec = None
                if isinstance(data, dict):
                    if "errorCode" in data:
                        ec = data.get("errorCode")
                    elif "errcode" in data:
                        ec = data.get("errcode")

                if ec is None:
                    # Some tenants return success without codes
                    return ok_and_return(data, pin)

                # success
                if str(ec) == "0":
                    return ok_and_return(data, pin)

                # token expired -> refresh once, then retry same pin immediately
                if int(ec) == 10004:
                    print(f"Token expired; refreshing… payload={data}")
                    if self._refresh():
                        form["accessToken"] = self.access_token
                        resp2 = requests.post(url, data=form, headers=headers, timeout=30)
                        if resp2.status_code != 200:
                            print(f"Retry HTTP error: {resp2.status_code}, body={resp2.text[:300]}")
                            return None
                        try:
                            data2 = resp2.json()
                        except Exception:
                            print("Retry non-JSON:", resp2.text[:300])
                            return None
                        ec2 = data2.get("errorCode", data2.get("errcode"))
                        if str(ec2) == "0":
                            return ok_and_return(data2, pin)
                        print(f"Retry logical error code={ec2} ({explain(int(ec2))}), payload={data2}")
                        # if refresh didn't help and it's duplicate, fall-through to retry with new pin
                        if int(ec2) not in (-3007, 30007):
                            return None
                        prev_dup = True
                        continue

                # duplicate pin -> generate a different one and try again
                if int(ec) in (-3007, 30007):
                    print(f"Duplicate PIN (code={ec} {explain(int(ec))}); will try a new PIN. payload={data}")
                    prev_dup = True
                    continue

                # any other logical error -> bubble up (caller may fallback)
                print(f"TTLock logical error code={ec} ({explain(int(ec))}), payload={data}")
                return None

            print("Failed to create a unique PIN after multiple attempts.")
            return None

        except Exception as e:
            print(f"Unexpected error in generate_pin_code: {repr(e)}")
            return None

    # ---------- OFFLINE (algorithmic) mode via /v3/keyboardPwd/get ----------
    def generate_offline_pin_code(
        self,
        lock_id: str,
        pin_name: str,
        start_time_ms: int,
        end_time_ms: int,
        keyboard_pwd_type: int = 3,  # 3 = Period (guest stay)
    ) -> Optional[str]:
        """Generate an algorithmic code (no gateway push required)."""
        if not self.access_token and not self._authenticate():
            print("Authentication failed; aborting offline PIN generation.")
            return None

        start_ms = self._to_ms(start_time_ms)
        end_ms = self._to_ms(end_time_ms)
        if end_ms <= start_ms:
            end_ms = start_ms + 60_000
        # TTLock requires minute/second = 00 for /get
        start_ms = self._align_to_hour_ms(start_ms)
        end_ms = self._align_to_hour_ms(end_ms)

        detail = self._get_lock_detail(lock_id)
        if not detail:
            return None
        kpv = detail.get("keyboardPwdVersion") or detail.get("keyboardPwdVersionNew") or 4
        try:
            kpv = int(kpv)
        except Exception:
            kpv = 4

        form = {
            "clientId": self.app_id,
            "accessToken": self.access_token,
            "lockId": str(lock_id),
            "keyboardPwdType": str(keyboard_pwd_type),
            "keyboardPwdVersion": str(kpv),
            "startDate": start_ms,
            "endDate": end_ms,
            "keyboardPwdName": (pin_name or "Guest")[:30],
            "date": int(time.time() * 1000),
        }
        url = f"{self.base_url}/v3/keyboardPwd/get"
        headers = {"Content-Type": "application/x-www-form-urlencoded"}

        try:
            resp = requests.post(url, data=form, headers=headers, timeout=30)
        except requests.Timeout:
            print("TTLock /keyboardPwd/get timeout; retrying once…")
            resp = requests.post(url, data=form, headers=headers, timeout=30)

        if resp.status_code != 200:
            print("HTTP error", resp.status_code, resp.text[:300])
            return None

        try:
            js = resp.json()
        except Exception:
            print("Non-JSON body", resp.text[:300])
            return None

        # token expiry handling
        if isinstance(js, dict) and js.get("errorCode") == 10004 and self._refresh():
            form["accessToken"] = self.access_token
            resp2 = requests.post(url, data=form, headers=headers, timeout=30)
            if resp2.status_code == 200:
                try:
                    js = resp2.json()
                except Exception:
                    print("Retry non-JSON", resp2.text[:300])
                    return None
            else:
                print("Retry HTTP error", resp2.status_code, resp2.text[:300])
                return None

        if isinstance(js, dict):
            ec = js.get("errorCode", js.get("errcode"))
            if ec in (0, "0", None):
                pin = js.get("keyboardPwd") or js.get("password")
                if pin:
                    print(f"Offline PIN generated id={js.get('keyboardPwdId')} pin={pin} window={start_ms}->{end_ms}")
                    return str(pin)
            print("Logical error from /keyboardPwd/get:", js)
            return None

        print("Unexpected response structure from /keyboardPwd/get:", js)
        return None

    # ---------- One-call wrapper: try push, fall back to offline ----------
    def generate_pin_with_fallback(
        self,
        lock_id: str,
        pin_name: str,
        start_time_ms: int,
        end_time_ms: int,
        guest_phone: Optional[str] = None,
        prefer_push: bool = True,
    ) -> Optional[Dict[str, str]]:
        """
        Returns {"pin": "...", "mode": "push"|"offline"}
        - If prefer_push: try /keyboardPwd/add (gateway). On failure (e.g., -2012/30009), fall back to /keyboardPwd/get.
        - If not prefer_push: go straight to offline generation.
        """
        # straight to offline if not preferring push
        s_raw = self._to_ms(start_time_ms)
        e_raw = self._to_ms(end_time_ms)

        # Windows for each mode
        s_push, e_push       = sanitize_for_push(s_raw, e_raw)
        s_offline, e_offline = sanitize_for_offline(s_raw, e_raw)

        if not prefer_push:
            pin_off = self.generate_offline_pin_code(lock_id, pin_name, s_offline, e_offline, keyboard_pwd_type=3)
            if pin_off:
                return {"pin": pin_off, "mode": "offline"}
            return None

        # try push first
        pin_push = self.generate_pin_code(lock_id, pin_name, s_push, e_push, guest_phone)
        if pin_push:
            return {"pin": pin_push, "mode": "push"}

        # fallback: offline
        print("Push mode failed or not possible; falling back to offline algorithmic code.")
        pin_off = self.generate_offline_pin_code(lock_id, pin_name, s_offline, e_offline, keyboard_pwd_type=3)
        if pin_off:
            return {"pin": pin_off, "mode": "offline"}

        return None


# Singletons
qrlock_client = QRLockClient()
ttlock_client = TTLockClient()


def generate_qr_code(door_config: Dict[str, Any], checkin_time: int, checkout_time: int) -> Optional[str]:
    """Generate QR code for QRLock door"""
    try:
        reader_id = door_config.get("readerId")
        if not reader_id:
            print(f"No readerId found for door {door_config.get('name', 'unknown')}")
            return None

        door_name = door_config.get("name", f"Door {reader_id}")
        print(f"Generating QR code for door: {door_name} (readerId: {reader_id})")
        return qrlock_client.generate_qr_code(int(reader_id), checkin_time, checkout_time)

    except Exception as e:
        print(f"Error in generate_qr_code: {str(e)}")
        return None


def generate_pin_code(
    door_config: Dict[str, Any],
    checkin_time: int,
    checkout_time: int,
    guest_name: str,
    guest_phone: Optional[str] = None,
    prefer_push: bool = True,
) -> Optional[str]:
    """
    Generate PIN code for TTLock door.

    Strategy:
      - If prefer_push=True: try remote push via gateway (/keyboardPwd/add).
      - On failure (e.g., no gateway / offline), automatically fall back to offline
        algorithmic code (/keyboardPwd/get) which requires no gateway.
    """
    try:
        lock_id = door_config.get("readerId")
        if not lock_id:
            print(f"No readerId found for door {door_config.get('name', 'unknown')}")
            return None

        door_name = door_config.get("name", f"Door {lock_id}")
        pin_name = f"{guest_name}_{door_name}_{int(time.time())}"
        print(f"Generating PIN code for door: {door_name} (readerId: {lock_id})")
        if guest_phone:
            print(f"Will attempt to use last 4 digits of phone (push mode only): {guest_phone}")

        res = ttlock_client.generate_pin_with_fallback(
            str(lock_id), pin_name, checkin_time, checkout_time, guest_phone, prefer_push=prefer_push
        )
        if not res:
            print("Failed to generate TTLock PIN in both push and offline modes.")
            return None

        print(f"PIN generated [{res['mode']}]: {res['pin']}")
        return res["pin"]

    except Exception as e:
        print(f"Error in generate_pin_code: {str(e)}")
        return None


def _floor_to_hour_ms(ts_ms: int) -> int:
    dt = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
    dt0 = dt.replace(minute=0, second=0, microsecond=0)
    return int(dt0.timestamp() * 1000)

def _ceil_to_hour_ms(ts_ms: int) -> int:
    dt = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
    top = dt.replace(minute=0, second=0, microsecond=0)
    if dt > top:
        top += timedelta(hours=1)
    return int(top.timestamp() * 1000)

def sanitize_for_push(start_ms: int, end_ms: int) -> tuple[int, int]:
    """For /keyboardPwd/add: allow immediate activation; no hour alignment."""
    now_ms = int(time.time() * 1000)
    s = max(start_ms, now_ms)                 # if past -> now
    e = max(end_ms, s + 60*60*1000)          # ensure ≥1h window
    return s, e

def sanitize_for_offline(start_ms: int, end_ms: int) -> tuple[int, int]:
    """For /keyboardPwd/get: align to hour, active now if past."""
    now_ms = int(time.time() * 1000)
    if start_ms < now_ms:
        s = _floor_to_hour_ms(now_ms)        # current block → active now
    else:
        s = _ceil_to_hour_ms(start_ms)       # future → next hour boundary
    e = _ceil_to_hour_ms(max(end_ms, s + 60*60*1000))
    return s, e