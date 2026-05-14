#!/usr/bin/env python3
"""
Test script for Zoho SMTP connection
Run this locally to verify your Zoho SMTP credentials work before deploying to AWS
"""

import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def test_zoho_smtp():
    """Test Zoho SMTP connection and send a test email"""
    
    # Zoho SMTP Configuration
    SMTP_HOST = "smtppro.zoho.eu"
    SMTP_PORT = 465  # SSL port
    
    # TODO: Replace with your actual Zoho credentials
    SMTP_USERNAME = "noreplay@harmonest.de"  # Your Zoho email
    SMTP_PASSWORD = "1eSTQsy5KGQ9"  # Your Zoho password or app-specific password
    
    # Email details
    FROM_EMAIL = SMTP_USERNAME
    FROM_NAME = "Harmonest Test"
    TO_EMAIL = "fnikcoder@gmail.com"  # Replace with test recipient
    
    # Create message
    message = MIMEMultipart("alternative")
    message["Subject"] = "Zoho SMTP Test - Harmonest"
    message["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
    message["To"] = TO_EMAIL
    
    # Create HTML and text versions
    text_content = """
    Hi there!
    
    This is a test email from Harmonest using Zoho SMTP.
    
    If you received this email, the SMTP configuration is working correctly!
    
    Best regards,
    Harmonest Team
    """
    
    html_content = """
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
          <h2 style="color: #3f7eb1; margin-top: 0;">✅ Zoho SMTP Test - Harmonest</h2>
          <p>Hi there!</p>
          <p>This is a test email from <strong>Harmonest</strong> using Zoho SMTP.</p>

          <div style="background-color: #e8f4fd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #3f7eb1;">
            <p style="margin: 0;"><strong>✅ Success!</strong> If you received this email, the SMTP configuration is working correctly!</p>
          </div>

          <p>Best regards,<br>
          <strong style="color: #3f7eb1;">Harmonest Team</strong></p>

          <hr style="margin: 20px 0; border: none; border-top: 1px solid #dee2e6;">
          <p style="color: #6c757d; font-size: 12px; margin: 0;">
            This is a test message from Harmonest SMTP configuration.
          </p>
        </div>
      </body>
    </html>
    """
    
    # Create MIMEText objects
    text_part = MIMEText(text_content, "plain")
    html_part = MIMEText(html_content, "html")
    
    # Add parts to message
    message.attach(text_part)
    message.attach(html_part)
    
    try:
        print("🔄 Connecting to Zoho SMTP server...")

        # Create SMTP session with SSL
        context = ssl.create_default_context()
        server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context)
        
        print("🔐 Authenticating with Zoho...")
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        
        print("📧 Sending test email...")
        server.sendmail(FROM_EMAIL, TO_EMAIL, message.as_string())
        server.quit()
        
        print("✅ SUCCESS! Test email sent successfully!")
        print(f"   From: {FROM_EMAIL}")
        print(f"   To: {TO_EMAIL}")
        print(f"   Subject: {message['Subject']}")
        
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        print("❌ AUTHENTICATION FAILED!")
        print(f"   Error: {e}")
        print("   Check your email and password/app-password")
        return False
        
    except smtplib.SMTPConnectError as e:
        print("❌ CONNECTION FAILED!")
        print(f"   Error: {e}")
        print("   Check your internet connection and SMTP settings")
        return False
        
    except Exception as e:
        print("❌ UNEXPECTED ERROR!")
        print(f"   Error: {e}")
        return False

def create_check_in_email_template():
    """Create a sample check-in completion email template"""
    
    html_template = """
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
          <h2 style="color: #28a745;">✅ Check-in Completed Successfully!</h2>
          
          <p>Dear <strong>{guest_name}</strong>,</p>
          
          <p>Your check-in has been completed successfully for:</p>
          
          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h3 style="margin-top: 0; color: #007bff;">{listing_title}</h3>
            <p><strong>📍 Address:</strong> {listing_address}</p>
            <p><strong>📅 Check-in Date:</strong> {checkin_date}</p>
            <p><strong>🕐 Check-in Time:</strong> {checkin_time}</p>
          </div>
          
          <h3>🔑 Access Information:</h3>
          <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px;">
            <p><strong>Door Access:</strong> {door_access_info}</p>
            <p><strong>QR Code:</strong> Your access QR code has been generated and is ready to use.</p>
          </div>
          
          <h3>📋 Important Information:</h3>
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107;">
            <p>{info_to_guest}</p>
          </div>
          
          <p style="margin-top: 20px;">If you have any questions or need assistance, please contact:</p>
          <p><strong>📞 Contact:</strong> {responsible_person}</p>
          
          <hr style="margin: 20px 0;">
          <p style="color: #6c757d; font-size: 12px;">
            This is an automated message from Harmonest. Please do not reply to this email.
          </p>
        </div>
      </body>
    </html>
    """
    
    print("\n📧 Check-in Email Template Created!")
    print("This template will be used for check-in completion emails.")
    
    return html_template

if __name__ == "__main__":
    print("🧪 Zoho SMTP Test for Harmonest")
    print("=" * 40)
    
    print("\n⚠️  BEFORE RUNNING:")
    print("1. Update SMTP_USERNAME with your Zoho email")
    print("2. Update SMTP_PASSWORD with your Zoho password or app-specific password")
    print("3. Update TO_EMAIL with a test recipient email")
    print("4. Make sure you have enabled 'Less Secure Apps' or use App-Specific Password")
    
    # Run the test
    test_zoho_smtp()
    
    # Show the email template
    create_check_in_email_template()
    
    print("\n📝 Next Steps:")
    print("1. Test the SMTP connection by updating credentials and running test_zoho_smtp()")
    print("2. Once working, we'll add these credentials to AWS Secrets Manager")
    print("3. Update the check-in Lambda function to send emails")
