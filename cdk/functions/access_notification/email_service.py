"""
Email Service - Door Access via Zoho SMTP
- Renders unified door-access emails (QR + PIN) using notification_templates.UnifiedNotificationTemplateManager
- Generates QR PNG attachments with optional centered logo
"""
from __future__ import annotations
from qrcode.image.pil import PilImage
import base64
import io
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from zoneinfo import ZoneInfo

import qrcode
from qrcode.image.pure import PyPNGImage  # <- no Pillow needed

from qrcode.constants import ERROR_CORRECT_H
# Note: PIL removed to avoid platform compatibility issues
# QR codes will be generated without logo overlay

try:
    import boto3  # optional, only if loading logo from S3
except Exception:
    boto3 = None

from common.email_utils import send_email_via_zoho


# -----------------------------
# Utilities
# -----------------------------

def _fmt_ts_ms(ts_ms: Any, tz: str = "Europe/Berlin") -> str:
    """Format millis timestamp to readable local time string."""
    try:
        dt = datetime.fromtimestamp(int(ts_ms) / 1000, tz=timezone.utc).astimezone(ZoneInfo(tz))
        return dt.strftime("%Y-%m-%d %H:%M (%Z)")
    except Exception:
        return str(ts_ms)


# -----------------------------
# Email sending (uses templates)
# -----------------------------

def send_door_access_email(guest_email: str, email_data: Dict[str, Any], door_accesses: List[Dict[str, Any]],
                           checkin_time: int, checkout_time: int) -> bool:
    """
    Sends the unified door-access email using `email_data`:
      {
        "guest_name": str,
        "listing_name": str,
        "address": str,
        "info4guest": str,
        "contact_person": str,
        "door_accesses": [...],
        "frontend_link": str,
        "qr_images": [ attachment-dicts from create_qr_attachment(...) ]
      }
    """
    try:
        from notification_templates import UnifiedNotificationTemplateManager

        # Build door_info for the template
        qr_doors: List[Dict[str, str]] = []
        pin_doors: List[Dict[str, str]] = []
        pin_codes: Dict[str, str] = {}
        qr_code_token: Optional[str] = None

        for acc in door_accesses:
            door_obj = {
                "name": acc.get("doorName", ""),
                "location": acc.get("doorLocation", ""),
                "validFrom": _fmt_ts_ms(acc.get("validFrom")),
                "validTo": _fmt_ts_ms(acc.get("validTo")),
            }
            if acc.get("type") == "qr_code":
                qr_doors.append(door_obj)
                qr_code_token = acc.get("accessCode", qr_code_token)
            elif acc.get("type") == "pin_code":
                pin_doors.append(door_obj)
                if acc.get("doorName") and acc.get("accessCode"):
                    pin_codes[acc["doorName"]] = acc["accessCode"]

        door_info = {
            "has_qr_doors": bool(qr_doors),
            "qr_doors": qr_doors,
            "has_pin_doors": bool(pin_doors),
            "pin_doors": pin_doors,
        }

        # Render templates (supports address/info/contact/link and optional inline QR via CIDs)
        tm = UnifiedNotificationTemplateManager()
        template = tm.create_door_access_email_template(
            guest_name=email_data.get("guest_name", "Guest"),
            room_name=email_data.get("listing_name", "Your Accommodation"),
            qr_code=qr_code_token,
            pin_codes=pin_codes,
            door_info=door_info,
            address=email_data.get("address", ""),
            info4guest=email_data.get("info4guest", ""),
            contact_person=email_data.get("contact_person", ""),
            frontend_link=email_data.get("frontend_link", ""),
            qr_inline_cids=[att["content_id"] for att in (email_data.get("qr_images") or []) if att.get("content_id")],
            checkin_time=checkin_time,
            checkout_time=checkout_time,
        )

        # Attach any QR images we generated earlier
        attachments = email_data.get("qr_images") or []

        return send_email_via_zoho(
            to_email=guest_email,
            subject=template["subject"],
            html_content=template["html"],
            text_content=template["text"],
            attachments=attachments,
        )
    except Exception as e:
        print(f"Error sending enhanced door access email to {guest_email}: {e}")
        return False
# -----------------------------
# QR + Logo generation helpers
# -----------------------------

# Logo functionality disabled - requires PIL which has platform compatibility issues
# def _load_logo_image(...): # DISABLED
# def _rounded_rect_mask(...): # DISABLED

def create_qr_attachment(
    qr_code: str,
    client_display_name: str,
    door_name: str,
    *,
    qr_box_size: int = 10,
    qr_border: int = 4,
) -> Optional[Dict[str, Any]]:
    """
    Create a PNG QR image attachment (pure-PNG backend, no Pillow).
    Returns dict with base64 content for email attachment, or None on failure.
    """
    try:
        qr = qrcode.QRCode(
            version=None,
            error_correction=ERROR_CORRECT_H,
            box_size=qr_box_size,
            border=qr_border,
        )
        qr.add_data(qr_code)
        qr.make(fit=True)

        # Use pure PNG backend (PyPNG). Do NOT pass format="PNG".
        img = qr.make_image(image_factory=PyPNGImage)

        buf = io.BytesIO()
        img.save(buf)  # no 'format' kwarg here
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")

        cid = f"qr-{abs(hash(door_name + qr_code))}@harmonest"
        return {
            "filename": f"QR_{door_name.replace(' ', '_')}.png",
            "mime_type": "image/png",
            "content_base64": b64,
            "content_id": cid,
            "disposition": "inline",
        }
    except Exception as e:
        print(f"[WARN] Could not render QR attachment for '{door_name}': {e}")
        return None