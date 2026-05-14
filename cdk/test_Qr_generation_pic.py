import base64
from pathlib import Path

# import your function (if it’s in another file, e.g. access_email.py)
# from access_email import create_qr_attachment

# Inline here for quick testing
def create_qr_attachment(qr_code: str, client_display_name: str, door_name: str):
    import io, qrcode
    from PIL import Image

    qr_img = qrcode.make(qr_code)
    buf = io.BytesIO()
    qr_img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    cid = f"qr-{abs(hash(door_name + qr_code))}@harmonest"

    return {
        "filename": f"QR_{door_name.replace(' ', '_')}.png",
        "mime_type": "image/png",
        "content_base64": b64,
        "content_id": cid,
        "disposition": "inline"
    }

# ---- Local test ----
if __name__ == "__main__":
    test_attachment = create_qr_attachment("TEST-CODE-123", "My Apartments", "HN Main")

    if not test_attachment:
        print("❌ QR attachment generation failed")
    else:
        print("✅ Attachment dict created:")
        for k, v in test_attachment.items():
            if k == "content_base64":
                print(f"  {k}: <{len(v)} chars base64>")
            else:
                print(f"  {k}: {v}")

        # Save PNG locally to visually check it
        out_path = Path(test_attachment["filename"])
        with open(out_path, "wb") as f:
            f.write(base64.b64decode(test_attachment["content_base64"]))
        print(f"📂 QR PNG written to {out_path.resolve()}")
