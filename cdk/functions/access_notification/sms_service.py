"""
SMS Service for QR Code Notifications
Handles SMS sending via AWS SNS with proper formatting and error handling
"""
import os
import boto3
import re
from typing import Optional


class SMSService:
    """Service for sending SMS notifications via AWS SNS"""
    
    def __init__(self):
        self.sns_client = boto3.client("sns", region_name=os.environ.get("SNS_REGION", "eu-central-1"))
        self.sender_id = os.environ.get("SMS_SENDER_ID", "Harmonest")  # Custom sender ID if supported
        
    def send_sms(self, phone_number: str, message: str) -> bool:
        """Send SMS message to phone number"""
        try:
            # Format and validate phone number
            formatted_phone = self._format_phone_number(phone_number)
            if not formatted_phone:
                print(f"Invalid phone number format: {phone_number}")
                return False
            
            # Validate message length (SMS limit is 160 characters for single SMS)
            if len(message) > 160:
                print(f"Warning: SMS message is {len(message)} characters, may be split into multiple messages")
            
            # Send SMS
            response = self.sns_client.publish(
                PhoneNumber=formatted_phone,
                Message=message,
                MessageAttributes={
                    'AWS.SNS.SMS.SenderID': {
                        'DataType': 'String',
                        'StringValue': self.sender_id
                    },
                    'AWS.SNS.SMS.SMSType': {
                        'DataType': 'String',
                        'StringValue': 'Transactional'  # For important notifications
                    }
                }
            )
            
            message_id = response.get('MessageId')
            if message_id:
                print(f"SMS sent successfully to {formatted_phone}, MessageId: {message_id}")
                return True
            else:
                print(f"SMS sending failed for {formatted_phone}: No MessageId returned")
                return False
                
        except Exception as e:
            print(f"Error sending SMS to {phone_number}: {str(e)}")
            return False
    
    def _format_phone_number(self, phone_number: str) -> Optional[str]:
        """Format phone number to E.164 format"""
        if not phone_number:
            return None
        
        # Remove all non-digit characters except +
        cleaned = re.sub(r'[^\d+]', '', phone_number)
        
        # If it starts with +, it's already in international format
        if cleaned.startswith('+'):
            return cleaned
        
        # If it starts with 00, replace with +
        if cleaned.startswith('00'):
            return '+' + cleaned[2:]
        
        # If it doesn't start with +, assume it needs country code
        # Default to Germany (+49) - you can make this configurable
        default_country_code = os.environ.get("DEFAULT_COUNTRY_CODE", "49")
        
        # Remove leading 0 if present (common in German numbers)
        if cleaned.startswith('0'):
            cleaned = cleaned[1:]
        
        return f"+{default_country_code}{cleaned}"
    
    def validate_phone_number(self, phone_number: str) -> bool:
        """Validate if phone number is in correct format"""
        formatted = self._format_phone_number(phone_number)
        if not formatted:
            return False
        
        # Basic E.164 validation: + followed by 1-15 digits
        pattern = r'^\+[1-9]\d{1,14}$'
        return bool(re.match(pattern, formatted))
    
    def create_short_url(self, long_url: str) -> str:
        """Create shortened URL for SMS (placeholder - implement with URL shortener service)"""
        # For now, return the original URL
        # In production, you might want to integrate with a URL shortener service
        # like bit.ly, tinyurl, or create your own shortener
        return long_url
    
    def estimate_sms_parts(self, message: str) -> int:
        """Estimate how many SMS parts the message will be split into"""
        # Standard SMS is 160 characters
        # If message contains non-GSM characters, limit is 70 characters per part
        
        # Check if message contains non-GSM characters
        gsm_chars = set("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà")
        
        has_non_gsm = any(char not in gsm_chars for char in message)
        
        if has_non_gsm:
            # Unicode SMS: 70 characters per part
            return (len(message) + 69) // 70
        else:
            # GSM 7-bit: 160 characters per part
            return (len(message) + 159) // 160


class SMSTemplateManager:
    """Manages SMS templates with length optimization"""
    
    def __init__(self, sms_service: SMSService):
        self.sms_service = sms_service
    
    def create_qr_code_sms(self, guest_name: str, qr_code: str, domain: str, client_name: str) -> str:
        """Create optimized SMS message for QR code delivery"""
        
        # Create QR code link
        qr_link = f"https://{domain}/activatedqrcode?qrcode={qr_code}"
        
        # Try to shorten URL if service is available
        short_link = self.sms_service.create_short_url(qr_link)
        
        # Create message with different lengths based on available space
        base_message = f"Hi {guest_name}! Your room access QR code: {short_link}"
        
        # If message is too long, create shorter version
        if len(base_message) > 160:
            base_message = f"{guest_name}, your QR code: {short_link}"
        
        # If still too long, use even shorter version
        if len(base_message) > 160:
            base_message = f"QR code ready: {short_link}"
        
        # Add sender info if there's space
        remaining_chars = 160 - len(base_message)
        if remaining_chars > len(f" - {client_name}"):
            base_message += f" - {client_name}"
        
        return base_message
    
    def create_pin_code_sms(self, guest_name: str, pin_codes: dict, client_name: str) -> str:
        """Create SMS message for PIN codes"""
        
        # Format PIN codes
        pin_text = ", ".join([f"{name}: {pin}" for name, pin in pin_codes.items()])
        
        base_message = f"Hi {guest_name}! PIN codes: {pin_text}"
        
        # If too long, abbreviate
        if len(base_message) > 160:
            base_message = f"{guest_name}, PINs: {pin_text}"
        
        # Add sender if space allows
        remaining_chars = 160 - len(base_message)
        if remaining_chars > len(f" - {client_name}"):
            base_message += f" - {client_name}"
        
        return base_message
    
    def create_welcome_sms(self, guest_name: str, room_name: str, client_name: str) -> str:
        """Create welcome SMS message"""
        
        message = f"Welcome {guest_name}! Room {room_name} access codes coming soon."
        
        # Add sender if space allows
        remaining_chars = 160 - len(message)
        if remaining_chars > len(f" - {client_name}"):
            message += f" - {client_name}"
        
        return message


# Example usage and testing functions
def test_phone_formatting():
    """Test phone number formatting"""
    sms_service = SMSService()
    
    test_numbers = [
        "+49123456789",      # Already formatted
        "0049123456789",     # International with 00
        "0123456789",        # German format with leading 0
        "123456789",         # German format without leading 0
        "+1234567890",       # US number
        "invalid",           # Invalid number
    ]
    
    for number in test_numbers:
        formatted = sms_service._format_phone_number(number)
        valid = sms_service.validate_phone_number(number)
        print(f"{number} -> {formatted} (valid: {valid})")


def test_sms_length():
    """Test SMS length estimation"""
    sms_service = SMSService()
    
    test_messages = [
        "Short message",
        "This is a longer message that might exceed the standard SMS length limit of 160 characters and therefore might be split into multiple parts",
        "Message with émojis 🎉 and special characters",
    ]
    
    for message in test_messages:
        parts = sms_service.estimate_sms_parts(message)
        print(f"Message ({len(message)} chars): {parts} parts")
        print(f"  '{message[:50]}...'")


if __name__ == "__main__":
    test_phone_formatting()
    print("\n" + "="*50 + "\n")
    test_sms_length()
