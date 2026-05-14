"""
SMS Service - Simplified
Handles sending door access SMS notifications
"""
from typing import Dict, Any, Optional
from sms_service import SMSService, SMSTemplateManager


def send_combined_access_sms(guest_phone: str, guest_name: str, qr_code: Optional[str], 
                           pin_codes: Dict[str, str], room_name: str, 
                           frontend_link: str, client_display_name: str) -> bool:
    """
    Send combined door access SMS with PIN codes and frontend link
    
    Args:
        guest_phone: Guest phone number
        guest_name: Guest name
        qr_code: QR code string (optional, not used in SMS)
        pin_codes: Dictionary of door names to PIN codes
        room_name: Room name
        frontend_link: Frontend link for full details
        client_display_name: Client display name
        
    Returns:
        True if SMS sent successfully, False otherwise
    """
    try:
        sms_service = SMSService()
        sms_template_manager = SMSTemplateManager(sms_service)
        
        # Create SMS message with PIN codes and frontend link
        if pin_codes:
            sms_message = sms_template_manager.create_pin_code_sms_with_link(
                guest_name, pin_codes, room_name, frontend_link, client_display_name
            )
        else:
            # Fallback to simple message with frontend link
            sms_message = f"Hello {guest_name}! Your access details for {room_name} are ready. View them here: {frontend_link}"
        
        # Send SMS
        return sms_service.send_sms(guest_phone, sms_message)
        
    except Exception as e:
        print(f"Error sending combined access SMS to {guest_phone}: {str(e)}")
        return False
