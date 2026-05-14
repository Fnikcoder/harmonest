import os, hashlib, requests, json
from dotenv import load_dotenv

load_dotenv()

BASE = os.getenv("TTLOCK_BASE", "https://euapi.ttlock.com")
CLIENT_ID = os.getenv("TTLOCK_CLIENT_ID")
CLIENT_SECRET = os.getenv("TTLOCK_CLIENT_SECRET")
USERNAME = os.getenv("TTLOCK_USERNAME")
PASSWORD = os.getenv("TTLOCK_PASSWORD")

def maybe_md5(pw: str) -> str:
    """Return MD5(password) if not already 32-hex lowercase."""
    if not pw:
        raise ValueError("Password missing")
    is_md5 = len(pw) == 32 and all(c in "0123456789abcdef" for c in pw.lower())
    return pw.lower() if is_md5 else hashlib.md5(pw.encode("utf-8")).hexdigest()

def get_access_token():
    url = f"{BASE}/oauth2/token"
    data = {
        "clientId": CLIENT_ID,
        "clientSecret": CLIENT_SECRET,
        "username": USERNAME,
        "password": maybe_md5(PASSWORD),
        "grant_type": "password",
    }
    r = requests.post(url, data=data, timeout=30)
    r.raise_for_status()
    js = r.json()
    print("→ Access token response:", json.dumps(js, indent=2, ensure_ascii=False))
    return js

def refresh_token(refresh_token: str):
    url = f"{BASE}/oauth2/token"
    data = {
        "clientId": CLIENT_ID,
        "clientSecret": CLIENT_SECRET,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }
    r = requests.post(url, data=data, timeout=30)
    r.raise_for_status()
    js = r.json()
    print("→ Refresh response:", json.dumps(js, indent=2, ensure_ascii=False))
    return js

if __name__ == "__main__":
    auth = get_access_token()
    access_token = auth.get("access_token")
    refresh = auth.get("refresh_token")

    if access_token:
        print(f"\n✔ Got access_token: {access_token[:8]}…")
    if refresh:
        print(f"✔ Got refresh_token: {refresh[:8]}…")

    # Demo refresh
    if refresh:
        refreshed = refresh_token(refresh)
