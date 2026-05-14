import os, json, time, logging, requests, boto3
from requests.adapters import HTTPAdapter, Retry

BASE = "https://api.guestyforhosts.com"
LOGIN_URL = f"{BASE}/login"
ORIGIN = os.getenv("G4H_ORIGIN", "https://app.guestyforhosts.com")

G4H_CRED_SECRET   = os.environ["G4H_CRED_SECRET"]
G4H_SESSION_SECRET= os.environ["G4H_SESSION_SECRET"]

APP_VERSION = os.getenv("G4H_APP_VERSION", "6.x")
PLATFORM    = os.getenv("G4H_PLATFORM", "browser--win32")
DEVICE_UUID = os.getenv("G4H_DEVICE_UUID", "ypa-uuid-lambda")
G_AID_CS    = os.getenv("G4H_G_AID_CS")  # optional

log = logging.getLogger(__name__)
sm  = boto3.client("secretsmanager")

# Warm-container cache
_CACHED = {"exp": 0, "cookies": None, "utoken": None, "stoken": None}
_SESS = None

def _requests_session() -> requests.Session:
    s = requests.Session()
    retry = Retry(
        total=5, backoff_factor=0.2,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["HEAD","GET","POST","PUT","DELETE","OPTIONS","TRACE"]
    )
    s.mount("https://", HTTPAdapter(max_retries=retry))
    s.mount("http://",  HTTPAdapter(max_retries=retry))
    return s

def _get_secret_json(name_or_arn: str) -> dict:
    return json.loads(sm.get_secret_value(SecretId=name_or_arn)["SecretString"])

def _put_secret_json(name_or_arn: str, obj: dict):
    s = json.dumps(obj)
    try:
        sm.put_secret_value(SecretId=name_or_arn, SecretString=s)
    except sm.exceptions.ResourceNotFoundException:
        # If it's an ARN, extract the name for create_secret
        if name_or_arn.startswith("arn:aws:secretsmanager:"):
            # Extract name from ARN: arn:aws:secretsmanager:region:account:secret:name-suffix
            secret_name = name_or_arn.split(":")[-1].rsplit("-", 1)[0]  # Remove the suffix
        else:
            secret_name = name_or_arn
        sm.create_secret(Name=secret_name, SecretString=s)

def _login_and_store() -> dict:
    creds = _get_secret_json(G4H_CRED_SECRET)
    s = _requests_session()
    headers = {
        "accept": "application/json, text/plain, */*",
        "content-type": "application/json",
        "origin": ORIGIN, "referer": ORIGIN + "/", "user-agent": "Mozilla/5.0",
        "authorization": "Bearer null",
    }
    if G_AID_CS: headers["g-aid-cs"] = G_AID_CS
    body = {
        "email": creds["email"], "password": creds["password"],
        "model": "undefined", "appVersion": APP_VERSION, "deviceToken": "undefined",
        "platform": PLATFORM, "deviceUUID": DEVICE_UUID,
        "requestDate": str(int(time.time()*1000)), "manufacturer":"Chrome", "osVersion":"138"
    }
    r = s.post(LOGIN_URL, headers=headers, json=body, timeout=30)
    r.raise_for_status()
    data = r.json()
    if not data.get("success"):
        raise RuntimeError(f"G4H login failed: {data}")

    utoken = data.get("userToken") or data.get("baseUserInfo").get("userId")
    stoken = data.get("sessionToken") or data.get("stoken")
    if not utoken or not stoken:
        raise RuntimeError(f"G4H tokens missing: {data}")

    sess = {
        "cookies": requests.utils.dict_from_cookiejar(s.cookies),
        "utoken": utoken, "stoken": stoken,
        "exp": int(time.time()) + 12*3600   # ~12h
    }
    _put_secret_json(G4H_SESSION_SECRET, sess)
    return sess

def _load_or_login() -> dict:
    # 1) warm cache
    if _CACHED["exp"] > time.time():
        return _CACHED
    # 2) secret
    try:
        sess = _get_secret_json(G4H_SESSION_SECRET)
        if sess.get("exp", 0) < time.time():
            raise KeyError("expired")
    except Exception:
        sess = _login_and_store()
    # update warm cache
    _CACHED.update(sess)
    return _CACHED

def get_client() -> tuple[requests.Session, str]:
    """
    Returns (requests.Session with headers/cookies set, utoken).
    Auto-refreshes tokens if expired and on first 401/403.
    """
    global _SESS
    sess_info = _load_or_login()

    if _SESS is None:
        _SESS = _requests_session()

    _SESS.cookies.clear()
    _SESS.cookies.update(sess_info["cookies"])
    _SESS.headers.update({
        "accept": "application/json, text/plain, */*",
        "content-type": "application/json;charset=UTF-8",
        "origin": ORIGIN, "referer": ORIGIN + "/", "user-agent": "Mozilla/5.0",
        "utoken": sess_info["utoken"], "stoken": sess_info["stoken"]
    })
    return _SESS, sess_info["utoken"]

def refresh_on_auth_error(fn, *args, **kwargs):
    """Call fn; if 401/403, relogin once and retry."""
    try:
        r = fn(*args, **kwargs)
        if r.status_code in (401,403):
            raise PermissionError("auth")
        return r
    except PermissionError:
        # force relogin
        fresh = _login_and_store()
        _CACHED.update(fresh)
        s, _ = get_client()
        r = fn(*args, **kwargs)
        return r
