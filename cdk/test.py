# guesty_recent_paged.py
import os, time, json, requests
from dotenv import load_dotenv

load_dotenv()

# --- .env (required) ---
EMAIL = os.getenv("G4H_EMAIL")
PASSWORD = os.getenv("G4H_PASSWORD")

# --- .env (optional; mirror your capture if needed) ---
G_AID_CS     = os.getenv("G4H_G_AID_CS", "G-89C7E-9FB65-B6F69")
APP_VERSION  = os.getenv("G4H_APP_VERSION", "5.0.2")
PLATFORM     = os.getenv("G4H_PLATFORM", "browser--macintel")
DEVICE_UUID  = os.getenv("G4H_DEVICE_UUID", "ypa-uuid-local-dev")
MANUFACTURER = os.getenv("G4H_MANUFACTURER", "Chrome")
OS_VERSION   = os.getenv("G4H_OS_VERSION", "138")
ORIGIN       = os.getenv("G4H_ORIGIN", "https://app.guestyforhosts.com")

BASE = "https://api.guestyforhosts.com"
LOGIN_URL   = f"{BASE}/login"
RECENT_URL  = f"{BASE}/reservations/recent"

FIELDS = [
    "reservationId","roomId","sourceId","checkInDate","checkOutDate","guestId","guestName",
    "guestSurname","phoneNumber","nights","note","preferredEmail","email","reservationCode",
    "status","currency","price","checkInDateWithTime","checkOutDateWithTime","addedDate",
    "lastUpdateDate","isDeleted","isModified","hostId","numOfAdults","numOfKids","numOfInfants",
    "homeAwayReferenceNumber","guestFormShortLink","porterReservationPrice","roomAlias","roomName"
]

def login() -> dict:
    if not EMAIL or not PASSWORD:
        raise SystemExit("Set G4H_EMAIL and G4H_PASSWORD in .env")

    headers = {
        "accept": "application/json, text/plain, */*",
        "content-type": "application/json",
        "origin": ORIGIN,
        "referer": ORIGIN + "/",
        "user-agent": "Mozilla/5.0",
        "authorization": "Bearer null",
        "g-aid-cs": G_AID_CS,
        "accept-language": "en-US,en;q=0.9",
    }
    body = {
        "email": EMAIL,
        "password": PASSWORD,
        "model": "undefined",
        "appVersion": APP_VERSION,
        "deviceToken": "undefined",
        "platform": PLATFORM,
        "deviceUUID": DEVICE_UUID,
        "requestDate": str(int(time.time() * 1000)),
        "manufacturer": MANUFACTURER,
        "osVersion": OS_VERSION,
    }

    s = requests.Session()
    r = s.post(LOGIN_URL, headers=headers, json=body, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"Login HTTP {r.status_code}: {r.text[:300]}")
    data = r.json()
    if not data.get("success"):
        raise RuntimeError(f"Login failed: {data}")

    utoken = data.get("userToken") or data.get("baseUserInfo").get("userId")
    stoken = data.get("sessionToken") or data.get("stoken")
    if not utoken or not stoken:
        raise RuntimeError(f"Tokens missing in login response: {data}")

    cookies = requests.utils.dict_from_cookiejar(s.cookies)
    return {"utoken": utoken, "stoken": stoken, "cookies": cookies}

def build_session(sess: dict) -> requests.Session:
    s = requests.Session()
    s.cookies.update(sess.get("cookies", {}))
    s.headers.update({
        "accept": "application/json, text/plain, */*",
        "content-type": "application/json;charset=UTF-8",
        "origin": ORIGIN,          # if needed: use https://frame.guestyforhosts.com
        "referer": ORIGIN + "/",
        "user-agent": "Mozilla/5.0",
        "utoken": sess["utoken"],
        "stoken": sess["stoken"],
    })
    return s

def fetch_recent_page(s: requests.Session, user_id: str, page: int):
    """POST /reservations/recent with {'userId','page'} and return a list for that page."""
    r = s.post(RECENT_URL, json={"userId": user_id, "page": page}, timeout=30)
    if r.status_code in (401, 403):
        raise RuntimeError(f"Session expired at page {page}: {r.text[:200]}")
    r.raise_for_status()
    js = r.json()
    return js.get("reservations") or js.get("items") or js

def fetch_recent_all(s: requests.Session, user_id: str, sleep_s: float = 0.2):
    """Iterate pages 0..N (no page size param, server decides). Stops when an empty page is returned."""
    all_rows = []
    page = 0
    while True:
        rows = fetch_recent_page(s, user_id, page)
        if not rows:
            break
        if page == 4:
            break
        all_rows.extend(rows.get("reservationList"))
        print(f"page {page}: +{len(rows)} (total {len(all_rows)})")
        page += 1
        time.sleep(sleep_s)  # be polite
    return all_rows

def select_fields(rec: dict) -> dict:
    return {k: rec.get(k) for k in FIELDS}

def main():
    sess = login()
    s = build_session(sess)

    rows = fetch_recent_all(s, sess["utoken"])
    projected = [select_fields(r) for r in rows]

    print(f"\nTotal reservations fetched: {len(projected)}")
    print(json.dumps(projected, ensure_ascii=False, indent=2))

    # Save to file if you want
    # with open("reservations_selected.json", "w", encoding="utf-8") as f:
    #     json.dump(projected, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
