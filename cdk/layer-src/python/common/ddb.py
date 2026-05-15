import os, time, json, hashlib, boto3
from decimal import Decimal
from typing import Any, Dict

TABLE = boto3.resource("dynamodb", region_name="eu-central-1").Table(os.environ["APP_TABLE"])

def now_ms() -> int: return int(time.time()*1000)

def _decimal_default(obj):
    """JSON serializer for objects not serializable by default json code"""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")

def sha(obj: Any) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, ensure_ascii=False, default=_decimal_default).encode()).hexdigest()

def get(pk: str, sk: str) -> Dict[str, Any] | None:
    return TABLE.get_item(Key={"PK": pk, "SK": sk}).get("Item")

def put(item: Dict[str, Any]):
    item.setdefault("updatedAt", now_ms())
    # Top-level NULL breaks GSIs keyed on STRING attributes (e.g. reservationCode).
    payload = {k: v for k, v in item.items() if v is not None}
    TABLE.put_item(Item=payload)

def put_if_changed(pk: str, sk: str, body: Dict[str, Any], hash_fields: list[str]) -> bool:
    """Compute hash from subset, write only if changed. Returns True if written."""
    cur = get(pk, sk)
    subset = {k: body.get(k) for k in hash_fields}
    body["hash"] = sha(subset)
    body["PK"], body["SK"] = pk, sk
    if cur and cur.get("hash") == body["hash"]:
        return False
    put(body)
    return True
