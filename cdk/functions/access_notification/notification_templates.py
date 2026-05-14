# notification_templates.py

from typing import Dict, Any, Optional, List
from common.config import get_email_template_vars
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

class UnifiedNotificationTemplateManager:
    def __init__(self):
        self.vars = get_email_template_vars()
        self.vars.setdefault("client_display_name", "Harmonest")
        self.vars.setdefault("primary_domain", "harmonest.de")
        self.vars.setdefault("primary_color", "#0d6efd")
        self.vars.setdefault("support_email", "support@harmonest.de")

    def _fmt_ts_ms(self, ts_ms: int, tz_name: str = "Europe/Berlin") -> str:
        dt_utc = datetime.fromtimestamp(int(ts_ms) / 1000, tz=timezone.utc)
        dt_loc = dt_utc.astimezone(ZoneInfo(tz_name))
        return dt_loc.strftime("%Y-%m-%d %H:%M")

    def create_door_access_email_template(
        self,
        guest_name: str,
        room_name: str,
        qr_code: Optional[str],
        pin_codes: Dict[str, str],
        door_info: Dict[str, Any],
        address: str = "",
        info4guest: str = "",
        contact_person: str = "",
        frontend_link: str = "",
        qr_inline_cids: Optional[List[str]] = None,
        checkin_time: int = 0,
        checkout_time: int = 0
    ) -> Dict[str, str]:
        qr_link = self._qr_link(qr_code)
        subject = f"{self.vars['client_display_name']} – Your Access for {room_name}"

        html = self._html_email(
            guest_name, room_name, qr_link, pin_codes, door_info,
            address, info4guest, contact_person, frontend_link, qr_inline_cids or [],
            checkin_time=checkin_time, checkout_time=checkout_time
        )
        text = self._text_email(
            guest_name, room_name, qr_link, pin_codes, door_info,
            address, info4guest, contact_person, frontend_link
        )
        return {"subject": subject, "html": html, "text": text}

    # ---------- helpers ----------

    def _qr_link(self, qr_code: Optional[str]) -> Optional[str]:
        return None if not qr_code else f"https://{self.vars['primary_domain']}/activatedqrcode?qrcode={qr_code}"

    def _door_names(self, door_info: Dict[str, Any], key: str) -> list[str]:
        val = door_info.get(key) or []
        if val and isinstance(val[0], dict):
            return [d.get("name", "").strip() for d in val if d.get("name")]
        return [str(x).strip() for x in val if str(x).strip()]

    def _html_email(
        self,
        guest_name: str,
        room_name: str,
        qr_link: Optional[str],
        pin_codes: Dict[str, str],
        door_info: Dict[str, Any],
        address: str,
        info4guest: str,
        contact_person: str,
        frontend_link: str,
        qr_inline_cids: List[str],
        checkin_time: int,
        checkout_time: int
    ) -> str:
        primary = self.vars["primary_color"]
        brand = self.vars["client_display_name"]
        support = self.vars["support_email"]
        # Access sections
        qr_doors = self._door_names(door_info, "qr_doors")
        pin_doors = self._door_names(door_info, "pin_doors")
        # format times (inputs are in ms)
        checkin_str = self._fmt_ts_ms(checkin_time)
        checkout_str = self._fmt_ts_ms(checkout_time)
        qr_section = ""
        if qr_link or qr_inline_cids:
            imgs = "".join(
                f'<img src="cid:{cid}" alt="QR code" style="max-width:160px;margin:8px;border:1px solid #e0e0e0;border-radius:8px;" />'
                for cid in qr_inline_cids
            )
            qr_section = f"""
            <div style="background:#e8f5e8;border:1px solid #c3e6c3;padding:16px;border-radius:12px;margin:16px 0;">
              <h3 style="color:#2d5a2d;margin:0 0 8px;">📱 QR Code Access</h3>
              {'<p style="color:#2d5a2d;margin:6px 0;">Use your QR code for:</p>' if qr_doors else ''}
              {'<ul style="color:#2d5a2d;margin:4px 0 10px 20px;">' + ''.join(f'<li>{n}</li>' for n in qr_doors) + '</ul>' if qr_doors else ''}
              {f'<div style="text-align:center;">{imgs}</div>' if imgs else ''}
              <p style="font-size:12px;color:#2d5a2d;margin-top:8px;text-align:center;">Tip: Save the QR to your phone.</p>
            </div>
            """

        pin_section = ""
        if pin_codes:
            pin_items = "".join(
                f"""<div style="display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid #ffcc80;border-radius:8px;padding:10px 12px;margin:8px 0;">
                      <strong style="font-family:monospace;font-size:16px;font-weight:700;color:#e65100;background:#fff3e0;padding:4px 8px;border-radius:6px;">{door}</strong>
                      <span style="font-family:monospace;font-size:16px;font-weight:700;color:#e65100;background:#fff3e0;padding:4px 8px;border-radius:6px;">
                        {code}#
                      </span>
                    </div>"""
                for door, code in pin_codes.items()
            )
            pin_section = f"""
            <div style="background:#fff3e0;border:1px solid #ffcc80;padding:16px;border-radius:12px;margin:16px 0;">
              <h3 style="color:#e65100;margin:0 0 8px;">🔢 PIN Code Access</h3>
              {'<ul style="color:#e65100;margin:0 0 10px 20px;">' + ''.join(f'<li>{n}</li>' for n in pin_doors) + '</ul>' if pin_doors else ''}
              {pin_items}
              <p style="font-size:12px;color:#e65100;margin-top:8px;">Keep PINs secure. Do not share.</p>
            </div>
            """

        # Safely format info4guest with <br> for line breaks
        info_html = info4guest.replace("\n", "<br>") if info4guest else ""

        details_block = f"""
        <div style="background:#f8f9fa;border:1px solid #e9ecef;padding:16px;border-radius:12px;margin:16px 0;">
          <h3 style="color:{primary};margin:0 0 8px;">🏨 Stay Details</h3>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#555;width:140px;">Accommodation</td><td style="padding:6px 0;"><strong>{room_name}</strong></td></tr>
            {'<tr><td style="padding:6px 0;color:#555;">Address</td><td style="padding:6px 0;">' + address + '</td></tr>' if address else ''}
            {'<tr><td style="padding:6px 0;color:#555;">Contact</td><td style="padding:6px 0;">' + contact_person + '</td></tr>' if contact_person else ''}
            {'<tr><td style="padding:6px 0;color:#555;">More info</td><td style="padding:6px 0;">' + info_html + '</td></tr>' if info4guest else ''}
          </table>
        </div>
        """



        door_table = f"""
          <div style="margin:16px 0;">
            <h3 style="color:{primary};margin:0 0 8px;">⏱ Validity of Accesses</h3>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#f1f3f5;">
                  <th style="text-align:left;padding:8px;">Valid From</th>
                  <th style="text-align:left;padding:8px;">Valid To</th>
                </tr>
              </thead>
              <tbody>
                  <tr>
                    <td style="padding:8px;border-bottom:1px solid #eee;white-space:nowrap;">{checkin_str}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;white-space:nowrap;">{checkout_str}</td>
                  </tr>
              </tbody>
            </table>
          </div>
        """

        return f"""
        <div style="font-family:Arial, sans-serif; max-width:640px; margin:0 auto; background:#fff;">
          <div style="background:{primary}; color:#fff; padding:20px; text-align:center;">
            <h1 style="margin:0; font-size:22px;">{brand}</h1>
            <p style="margin:6px 0 0; opacity:0.9;">Your Access is Ready</p>
          </div>

          <div style="padding:22px 18px;">
            <h2 style="color:{primary}; margin:0 0 8px;">Hi {guest_name},</h2>
            <p style="font-size:15px; line-height:1.6; color:#333; margin:0 0 10px;">
              Below are your access methods for <strong>{room_name}</strong>.
            </p>

            {details_block}
            {qr_section}
            {pin_section}
            {door_table}

            <div style="background:#fff3cd;border:1px solid #ffeaa7;border-radius:8px;padding:14px;margin:18px 0;">
              <strong>Important:</strong>
              <ul style="margin:8px 0 0 18px; color:#856404;">
                <li>Save codes locally</li>
                <li>Valid for the duration of your stay</li>
                <li>Do not share with others</li>
              </ul>
            </div>

            <div style="background:#f8f9fa;border-radius:8px;padding:14px;margin:18px 0;">
              Need help? <a href="mailto:{support}" style="color:{primary};">{support}</a>
            </div>
          </div>

          <div style="background:#f8f9fa; padding:14px; text-align:center; border-top:1px solid #dee2e6;">
            <p style="margin:0; color:#6c757d; font-size:13px;">
              Automated message from {brand}.
            </p>
          </div>
        </div>
        """.strip()

    def _text_email(
        self,
        guest_name: str,
        room_name: str,
        qr_link: Optional[str],
        pin_codes: Dict[str, str],
        door_info: Dict[str, Any],
        address: str,
        info4guest: str,
        contact_person: str,
        frontend_link: str
    ) -> str:
        brand = self.vars["client_display_name"]
        support = self.vars["support_email"]

        lines = [
            f"{brand} – Access Details",
            "",
            f"Dear {guest_name},",
            f"Your access for {room_name} is ready.",
            "",
        ]
        if address:
            lines += [f"Address: {address}"]
        if contact_person:
            lines += [f"Contact: {contact_person}"]
        if info4guest:
            lines += [f"Info: {info4guest}"]
        if frontend_link:
            lines += [f"Guest portal: {frontend_link}"]
        lines.append("")

        if qr_link:
            lines += ["QR code:", qr_link, ""]

        qr_doors = self._door_names(door_info, "qr_doors")
        pin_doors = self._door_names(door_info, "pin_doors")
        if qr_doors:
            lines += ["QR doors:"] + [f"- {n}" for n in qr_doors] + [""]
        if pin_doors:
            lines += ["PIN doors:"] + [f"- {n}" for n in pin_doors] + [""]

        if pin_codes:
            lines += ["PIN codes:"] + [f"- {d}: {c}" for d, c in pin_codes.items()] + [""]

        lines += [
            "Important:",
            "- Save your codes; valid for your stay",
            "- Do not share with others",
            "",
            f"Need help? {support}",
        ]
        return "\n".join(lines).strip()
