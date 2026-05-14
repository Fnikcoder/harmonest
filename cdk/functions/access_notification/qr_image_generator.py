"""
QR Code Image Generator
Generates QR code images for email attachments
"""
import io
import base64
from typing import Optional, Tuple
import qrcode
from PIL import Image, ImageDraw, ImageFont


class QRCodeImageGenerator:
    """Generates QR code images with customization options"""
    
    def __init__(self):
        self.default_size = 256
        self.default_border = 4
        self.default_box_size = 10
    
    def generate_qr_image(self, qr_data: str, size: int = None, add_logo: bool = False) -> Tuple[bytes, str]:
        """
        Generate QR code image as bytes
        Returns: (image_bytes, mime_type)
        """
        try:
            size = size or self.default_size
            
            # Create QR code
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_M,
                box_size=self.default_box_size,
                border=self.default_border,
            )
            qr.add_data(qr_data)
            qr.make(fit=True)
            
            # Create image
            qr_img = qr.make_image(fill_color="black", back_color="white")
            
            # Resize to desired size
            qr_img = qr_img.resize((size, size), Image.Resampling.LANCZOS)
            
            # Add logo if requested
            if add_logo:
                qr_img = self._add_logo_to_qr(qr_img)
            
            # Convert to bytes
            img_buffer = io.BytesIO()
            qr_img.save(img_buffer, format='PNG', optimize=True)
            img_bytes = img_buffer.getvalue()
            
            return img_bytes, "image/png"
            
        except Exception as e:
            print(f"Error generating QR code image: {str(e)}")
            return None, None
    
    def generate_qr_with_branding(self, qr_data: str, client_name: str, room_name: str, size: int = None) -> Tuple[bytes, str]:
        """
        Generate QR code with client branding and room information
        Returns: (image_bytes, mime_type)
        """
        try:
            size = size or self.default_size
            
            # Create QR code
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_H,  # Higher error correction for logo
                box_size=8,
                border=2,
            )
            qr.add_data(qr_data)
            qr.make(fit=True)
            
            # Create QR image
            qr_img = qr.make_image(fill_color="black", back_color="white")
            
            # Create a larger canvas with branding
            canvas_height = size + 80  # Extra space for text
            canvas = Image.new('RGB', (size, canvas_height), 'white')
            
            # Resize QR code to fit canvas
            qr_size = size - 20  # Leave margin
            qr_img = qr_img.resize((qr_size, qr_size), Image.Resampling.LANCZOS)
            
            # Paste QR code on canvas
            qr_x = (size - qr_size) // 2
            qr_y = 10
            canvas.paste(qr_img, (qr_x, qr_y))
            
            # Add text below QR code
            draw = ImageDraw.Draw(canvas)
            
            # Try to use a nice font, fall back to default if not available
            try:
                title_font = ImageFont.truetype("arial.ttf", 16)
                subtitle_font = ImageFont.truetype("arial.ttf", 12)
            except:
                title_font = ImageFont.load_default()
                subtitle_font = ImageFont.load_default()
            
            # Add title
            title_text = f"{client_name}"
            title_bbox = draw.textbbox((0, 0), title_text, font=title_font)
            title_width = title_bbox[2] - title_bbox[0]
            title_x = (size - title_width) // 2
            title_y = qr_y + qr_size + 10
            draw.text((title_x, title_y), title_text, fill="black", font=title_font)
            
            # Add subtitle
            subtitle_text = f"Room {room_name} Access"
            subtitle_bbox = draw.textbbox((0, 0), subtitle_text, font=subtitle_font)
            subtitle_width = subtitle_bbox[2] - subtitle_bbox[0]
            subtitle_x = (size - subtitle_width) // 2
            subtitle_y = title_y + 20
            draw.text((subtitle_x, subtitle_y), subtitle_text, fill="gray", font=subtitle_font)
            
            # Convert to bytes
            img_buffer = io.BytesIO()
            canvas.save(img_buffer, format='PNG', optimize=True)
            img_bytes = img_buffer.getvalue()
            
            return img_bytes, "image/png"
            
        except Exception as e:
            print(f"Error generating branded QR code: {str(e)}")
            # Fall back to simple QR code
            return self.generate_qr_image(qr_data, size)
    
    def _add_logo_to_qr(self, qr_img: Image.Image) -> Image.Image:
        """Add a simple logo/icon to the center of QR code"""
        try:
            # Create a simple logo (circle with "H" for Harmonest)
            logo_size = qr_img.size[0] // 8
            logo = Image.new('RGB', (logo_size, logo_size), 'white')
            logo_draw = ImageDraw.Draw(logo)
            
            # Draw circle background
            logo_draw.ellipse([2, 2, logo_size-2, logo_size-2], fill='black', outline='black')
            
            # Add "H" text
            try:
                font = ImageFont.truetype("arial.ttf", logo_size//3)
            except:
                font = ImageFont.load_default()
            
            text = "H"
            text_bbox = logo_draw.textbbox((0, 0), text, font=font)
            text_width = text_bbox[2] - text_bbox[0]
            text_height = text_bbox[3] - text_bbox[1]
            text_x = (logo_size - text_width) // 2
            text_y = (logo_size - text_height) // 2
            logo_draw.text((text_x, text_y), text, fill='white', font=font)
            
            # Paste logo on QR code
            logo_x = (qr_img.size[0] - logo_size) // 2
            logo_y = (qr_img.size[1] - logo_size) // 2
            qr_img.paste(logo, (logo_x, logo_y))
            
            return qr_img
            
        except Exception as e:
            print(f"Error adding logo to QR code: {str(e)}")
            return qr_img
    
    def generate_base64_qr(self, qr_data: str, size: int = None) -> Optional[str]:
        """Generate QR code as base64 string for embedding in HTML"""
        try:
            img_bytes, mime_type = self.generate_qr_image(qr_data, size)
            if img_bytes:
                base64_str = base64.b64encode(img_bytes).decode('utf-8')
                return f"data:{mime_type};base64,{base64_str}"
            return None
            
        except Exception as e:
            print(f"Error generating base64 QR code: {str(e)}")
            return None
    
    def create_email_attachment(self, qr_data: str, client_name: str, room_name: str, filename: str = None) -> Dict[str, Any]:
        """Create email attachment data for QR code"""
        try:
            filename = filename or f"room_{room_name}_qr_code.png"
            
            # Generate branded QR code
            img_bytes, mime_type = self.generate_qr_with_branding(qr_data, client_name, room_name)
            
            if img_bytes:
                # Encode as base64 for email attachment
                base64_content = base64.b64encode(img_bytes).decode('utf-8')
                
                return {
                    "filename": filename,
                    "content": base64_content,
                    "content_type": mime_type,
                    "disposition": "attachment",
                    "content_id": f"qr_code_{room_name}"  # For inline embedding if needed
                }
            
            return None
            
        except Exception as e:
            print(f"Error creating email attachment: {str(e)}")
            return None


# Utility functions for testing
def test_qr_generation():
    """Test QR code generation"""
    generator = QRCodeImageGenerator()
    
    test_data = "FFB5EAF96908B0C7AF4123456789"
    
    # Test simple QR code
    img_bytes, mime_type = generator.generate_qr_image(test_data)
    print(f"Simple QR: {len(img_bytes) if img_bytes else 0} bytes, {mime_type}")
    
    # Test branded QR code
    img_bytes, mime_type = generator.generate_qr_with_branding(test_data, "Harmonest", "101")
    print(f"Branded QR: {len(img_bytes) if img_bytes else 0} bytes, {mime_type}")
    
    # Test base64 QR code
    base64_qr = generator.generate_base64_qr(test_data)
    print(f"Base64 QR: {len(base64_qr) if base64_qr else 0} characters")
    
    # Test email attachment
    attachment = generator.create_email_attachment(test_data, "Harmonest", "101")
    print(f"Email attachment: {attachment['filename'] if attachment else 'Failed'}")


if __name__ == "__main__":
    test_qr_generation()
