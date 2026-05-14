"""
Email utility functions for sending emails via Zoho SMTP
Supports both check-in completion and access notification emails
"""

import smtplib
import ssl
import json
import boto3
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, Optional
from datetime import datetime

# Harmonest Brand Colors
HARMONEST_PRIMARY_COLOR = "#3f7eb1"  # Blue
HARMONEST_SECONDARY_COLOR = "#b3c37d"  # Green

def get_zoho_smtp_credentials() -> Dict[str, str]:
    """Get Zoho SMTP credentials from AWS Secrets Manager"""
    import os
    
    # Get environment variables
    client_name = os.environ.get('CLIENT_NAME', 'harmonest')
    env_name = os.environ.get('ENVIRONMENT', 'prod')
    
    # Get secret ARN from SSM parameter
    ssm_client = boto3.client('ssm')
    secret_arn_param = f"/{client_name}/{env_name}/secrets/email/zoho-smtp/arn"
    
    try:
        secret_arn = ssm_client.get_parameter(Name=secret_arn_param)['Parameter']['Value']
        
        # Get secret value
        secrets_client = boto3.client('secretsmanager')
        secret_response = secrets_client.get_secret_value(SecretId=secret_arn)
        credentials = json.loads(secret_response['SecretString'])
        
        return credentials
        
    except Exception as e:
        print(f"Error getting Zoho SMTP credentials: {str(e)}")
        raise

import smtplib, ssl, base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from typing import List, Dict, Any, Optional

def send_email_via_zoho(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
    attachments: Optional[List[Dict[str, Any]]] = None
) -> bool:
    """
    Send email via Zoho SMTP, with optional attachments (inline or normal).

    attachments: list of dicts
        {
          "filename": "QR_Main.png",
          "mime_type": "image/png",
          "content_base64": "<base64 string>",
          "content_id": "qr-123@harmonest",    # optional (for inline <img src="cid:...">)
          "disposition": "inline"              # "inline" or "attachment"
        }
    """
    try:
        # Get SMTP credentials
        creds = get_zoho_smtp_credentials()

        # Create root message (mixed if attachments, alternative if no attachments)
        if attachments:
            message = MIMEMultipart("mixed")
        else:
            message = MIMEMultipart("alternative")

        message["Subject"] = subject
        message["From"] = f"{creds['from_name']} <{creds['from_email']}>"
        message["To"] = to_email

        # Fallback plain text if not provided
        if not text_content:
            import re
            text_content = re.sub('<[^<]+?>', '', html_content)
            text_content = re.sub(r'\s+', ' ', text_content).strip()

        # Alternative part (text + html)
        alt_part = MIMEMultipart("alternative")
        alt_part.attach(MIMEText(text_content, "plain"))
        alt_part.attach(MIMEText(html_content, "html"))
        message.attach(alt_part)

        # Attachments
        if attachments:
            for att in attachments:
                mime_type = att["mime_type"]
                main_type, sub_type = mime_type.split("/", 1)
                content = base64.b64decode(att["content_base64"])

                if main_type == "image":
                    mime = MIMEImage(content, _subtype=sub_type)
                    if att.get("content_id"):
                        mime.add_header("Content-ID", f"<{att['content_id']}>")
                    mime.add_header(
                        "Content-Disposition",
                        att.get("disposition", "attachment"),
                        filename=att["filename"]
                    )
                else:
                    from email.mime.base import MIMEBase
                    from email import encoders
                    mime = MIMEBase(main_type, sub_type)
                    mime.set_payload(content)
                    encoders.encode_base64(mime)
                    mime.add_header(
                        "Content-Disposition",
                        att.get("disposition", "attachment"),
                        filename=att["filename"]
                    )

                message.attach(mime)

        # Connect and send
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(creds["host"], int(creds["port"]), context=context) as server:
            server.login(creds["username"], creds["password"])
            server.sendmail(creds["from_email"], to_email, message.as_string())

        print(f"✅ Email sent successfully to {to_email}")
        return True

    except Exception as e:
        print(f"❌ Error sending email to {to_email}: {e}")
        return False


def create_harmonest_email_template(title: str, content: str, footer_info: str = None) -> str:
    """Create a standardized Harmonest email template with brand colors"""

    footer_content = footer_info or """
        <p style="margin: 0; font-style: italic;">
            This is an automated message from Harmonest. Please do not reply to this email.
        </p>
    """

    return f"""
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
          <h2 style="color: {HARMONEST_PRIMARY_COLOR}; margin-top: 0;">{title}</h2>

          {content}

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
          <div style="color: #6c757d; font-size: 12px;">
            {footer_content}
          </div>
        </div>
      </body>
    </html>
    """

def create_info_box(content: str, box_type: str = "info") -> str:
    """Create a styled info box for emails"""

    box_styles = {
        "info": {
            "bg_color": "#e8f4fd",
            "border_color": HARMONEST_PRIMARY_COLOR
        },
        "success": {
            "bg_color": "#f0f7e6",
            "border_color": HARMONEST_SECONDARY_COLOR
        },
        "warning": {
            "bg_color": "#fff3cd",
            "border_color": "#ffc107"
        }
    }

    style = box_styles.get(box_type, box_styles["info"])

    return f"""
    <div style="background-color: {style['bg_color']}; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid {style['border_color']};">
        {content}
    </div>
    """

def create_checkin_completion_email(reservation_data: Dict[str, Any], checkin_data: Dict[str, Any]) -> tuple:
    """Create check-in completion email content"""

    # Extract reservation details from DynamoDB structure
    # The reservation data might be nested in rawData.reservation.reservation
    raw_data = reservation_data.get('rawData', {})
    if raw_data and 'reservation' in raw_data:
        reservation_detail = raw_data['reservation'].get('reservation', {})
    else:
        # Fallback to direct access if structure is different
        reservation_detail = reservation_data

    # Extract data
    guest_name = f"{checkin_data.get('firstName', '')} {checkin_data.get('lastName', '')}"
    listing_title = reservation_detail.get('listingTitle') or reservation_detail.get('roomName') or 'Your Accommodation'

    # Get custom fields for additional info
    custom_fields = reservation_data.get('customFields', {})
    info_to_guest = custom_fields.get('info4guest', 'No additional information available')
    responsible_person = custom_fields.get('responsiblePerson', 'Support team')

    # Format dates - get from reservation detail
    checkin_date = reservation_detail.get('checkInDate')
    checkout_date = reservation_detail.get('checkOutDate')

    print(f"DEBUG: checkin_date = {checkin_date} (type: {type(checkin_date)})")
    print(f"DEBUG: checkout_date = {checkout_date} (type: {type(checkout_date)})")

    if checkin_date:
        try:
            # Convert timestamp to readable date (handle Decimal from DynamoDB)
            from decimal import Decimal
            if isinstance(checkin_date, (int, float, Decimal)):
                timestamp = float(checkin_date) / 1000
                checkin_date_str = datetime.fromtimestamp(timestamp).strftime('%B %d, %Y')
            else:
                checkin_date_str = str(checkin_date)
        except Exception as e:
            print(f"Error formatting checkin date {checkin_date}: {str(e)}")
            checkin_date_str = 'Date not available'
    else:
        checkin_date_str = 'Date not available'

    if checkout_date:
        try:
            # Convert timestamp to readable date (handle Decimal from DynamoDB)
            from decimal import Decimal
            if isinstance(checkout_date, (int, float, Decimal)):
                timestamp = float(checkout_date) / 1000
                checkout_date_str = datetime.fromtimestamp(timestamp).strftime('%B %d, %Y')
            else:
                checkout_date_str = str(checkout_date)
        except Exception as e:
            print(f"Error formatting checkout date {checkout_date}: {str(e)}")
            checkout_date_str = 'Date not available'
    else:
        checkout_date_str = 'Date not available'
    
    # Get door access information
    doors_list = custom_fields.get('doors', [])
    if doors_list:
        door_info = []
        for door in doors_list:
            door_name = door.get('name', 'Door')
            door_type = door.get('type', 'Unknown')
            door_info.append(f"{door_name} ({door_type})")
        door_access_info = ', '.join(door_info)
    else:
        door_access_info = 'Door access information will be provided separately'
    
    # Create subject
    subject = f"✅ Check-in Completed - {listing_title}"
    
    # Create HTML content
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
          <h2 style="color: #3f7eb1; margin-top: 0;">✅ Check-in Completed Successfully!</h2>
          
          <p>Dear <strong>{guest_name}</strong>,</p>
          
          <p>Your check-in has been completed successfully for:</p>
          
          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #3f7eb1;">
            <h3 style="margin-top: 0; color: #3f7eb1;">{listing_title}</h3>
            <p><strong>📅 Check-in:</strong> {checkin_date_str} from 14:00</p>
            <p><strong>📅 Check-out:</strong> {checkout_date_str} until 11:00</p>
          </div>
          
          <h3 style="color: #3f7eb1;">🔑 Access Information:</h3>
          <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px;">
            <p><strong>Door Access:</strong> {door_access_info}</p>
            <p><strong>QR Code:</strong> Your access QR code will be generated and sent to you 24 hours before your check-in date.</p>
          </div>
          
          <h3 style="color: #3f7eb1;">📋 Important Information:</h3>
          <div style="background-color: #f0f7e6; padding: 15px; border-radius: 5px; border-left: 4px solid #b3c37d;">
            <p>{info_to_guest}</p>
          </div>
          
          <p style="margin-top: 20px;">If you have any questions or need assistance, please contact:</p>
          <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 10px 0;">
            <p style="margin: 0;"><strong>📞 Contact:</strong> {responsible_person}</p>
            <p style="margin: 5px 0 0 0;"><strong>📧 Email:</strong> support@harmonest.de</p>
            <p style="margin: 5px 0 0 0;"><strong>📱 Phone:</strong> +49 176 8630 6753</p>
            <p style="margin: 5px 0 0 0;"><strong>🌐 Website:</strong> harmonest.de</p>
          </div>
          
          <div style="margin-top: 30px; padding: 15px; background-color: #e8f4fd; border-radius: 5px; border-left: 4px solid #3f7eb1;">
            <p style="margin: 0;"><strong>What's Next?</strong></p>
            <ul style="margin: 10px 0;">
              <li>You will receive your access QR code 24 hours before check-in</li>
              <li>Keep this email for your records</li>
              <li>Contact us if you need to make any changes</li>
            </ul>
          </div>
          
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #dee2e6;">
          <p style="color: #6c757d; font-size: 12px; margin: 0;">
            This is an automated message from Harmonest. Please do not reply to this email.
          </p>
        </div>
      </body>
    </html>
    """
    
    # Create text version
    text_content = f"""
Check-in Completed Successfully!

Dear {guest_name},

Your check-in has been completed successfully for:

{listing_title}
Check-in: {checkin_date_str} from 14:00
Check-out: {checkout_date_str} until 11:00

ACCESS INFORMATION:
Door Access: {door_access_info}
QR Code: Your access QR code will be generated and sent to you 24 hours before your check-in date.

IMPORTANT INFORMATION:
{info_to_guest}

If you have any questions or need assistance, please contact:
Contact: {responsible_person}
Email: support@harmonest.de
Phone: +49 176 8630 6753
Website: harmonest.de

WHAT'S NEXT:
- You will receive your access QR code 24 hours before check-in
- Keep this email for your records
- Contact us if you need to make any changes

This is an automated message from Harmonest.
    """
    
    return subject, html_content, text_content

def send_checkin_completion_email(reservation_data: Dict[str, Any], checkin_data: Dict[str, Any]) -> bool:
    """Send check-in completion email to guest"""
    try:
        # Get guest email
        guest_email = checkin_data.get('email')
        if not guest_email:
            print("No guest email provided, skipping check-in completion email")
            return False

        # Create email content
        subject, html_content, text_content = create_checkin_completion_email(reservation_data, checkin_data)

        # Send email
        return send_email_via_zoho(guest_email, subject, html_content, text_content)

    except Exception as e:
        print(f"Error sending check-in completion email: {str(e)}")
        return False


def send_support_notification_failed_door_access(
    reservation_id: str,
    guest_info: Dict[str, Any],
    listing_info: Dict[str, Any],
    failed_doors: List[Dict[str, Any]],
    error_details: Dict[str, str]
) -> bool:
    """Send notification to support when door access creation fails"""
    try:
        support_email = "support@harmonest.de"

        # Extract relevant information
        guest_name = guest_info.get("fullName", "Unknown Guest")
        guest_email = guest_info.get("email", "No email")
        guest_phone = guest_info.get("phone", "No phone")
        room_name = listing_info.get("roomName", "Unknown Room")
        room_id = listing_info.get("roomId", "Unknown ID")

        # Create failed doors summary
        failed_doors_summary = []
        for door in failed_doors:
            door_name = door.get("name", "Unknown Door")
            door_type = door.get("type", "Unknown Type")
            reader_id = door.get("readerId", "No Reader ID")
            error_msg = error_details.get(door_name, "Unknown error")
            failed_doors_summary.append(f"• {door_name} ({door_type}) - Reader ID: {reader_id} - Error: {error_msg}")

        failed_doors_text = "\n".join(failed_doors_summary)

        # Create subject
        subject = f"🚨 Door Access Creation Failed - Reservation {reservation_id}"

        # Create HTML content
        html_content = create_harmonest_email_template(
            title="Door Access Creation Failed - Manual Intervention Required",
            content=f"""
            <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #dc3545;">
                <h3 style="color: #721c24; margin-top: 0;">⚠️ Action Required</h3>
                <p>Door access creation failed for one or more doors. Manual intervention is needed.</p>
            </div>

            <h3 style="color: {HARMONEST_PRIMARY_COLOR};">Reservation Details:</h3>
            <ul>
                <li><strong>Reservation ID:</strong> {reservation_id}</li>
                <li><strong>Guest:</strong> {guest_name}</li>
                <li><strong>Email:</strong> {guest_email}</li>
                <li><strong>Phone:</strong> {guest_phone}</li>
                <li><strong>Room:</strong> {room_name} (ID: {room_id})</li>
            </ul>

            <h3 style="color: {HARMONEST_PRIMARY_COLOR};">Failed Doors:</h3>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; font-family: monospace; white-space: pre-line;">
{failed_doors_text}
            </div>

            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107;">
                <h4 style="color: #856404; margin-top: 0;">Next Steps:</h4>
                <ol style="color: #856404;">
                    <li>Check the door configuration and reader IDs</li>
                    <li>Verify API credentials and connectivity</li>
                    <li>Manually create access codes if needed</li>
                    <li>Contact the guest with access information</li>
                </ol>
            </div>
            """,
            footer_info=f"""
                <p style="margin: 0; font-style: italic;">
                    This is an automated alert from the Harmonest access notification system.
                    Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}
                </p>
            """
        )

        # Create text content
        text_content = f"""
Door Access Creation Failed - Manual Intervention Required

RESERVATION DETAILS:
- Reservation ID: {reservation_id}
- Guest: {guest_name}
- Email: {guest_email}
- Phone: {guest_phone}
- Room: {room_name} (ID: {room_id})

FAILED DOORS:
{failed_doors_text}

NEXT STEPS:
1. Check the door configuration and reader IDs
2. Verify API credentials and connectivity
3. Manually create access codes if needed
4. Contact the guest with access information

This is an automated alert from the Harmonest access notification system.
Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}
        """

        # Send email to support
        return send_email_via_zoho(support_email, subject, html_content, text_content)

    except Exception as e:
        print(f"Error sending support notification for failed door access: {str(e)}")
        return False
