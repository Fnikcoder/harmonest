#!/usr/bin/env python3
"""
Simple test to verify email verification function works
"""

import json
import sys
import os

# Add the layer path to sys.path to import common modules
sys.path.insert(0, 'layer-src/python')

# Set environment variables that the function expects
os.environ['CLIENT_NAME'] = 'harmonest'
os.environ['CLIENT_DISPLAY_NAME'] = 'HarmoNest'
os.environ['ENVIRONMENT'] = 'prod'
os.environ['CLIENT_DOMAIN_PRIMARY'] = 'harmonest.de'
os.environ['CLIENT_EMAIL_SUPPORT'] = 'support@harmonest.de'
os.environ['CLIENT_EMAIL_FROM_NAME'] = 'HarmoNest'
os.environ['CLIENT_BRANDING_PRIMARY_COLOR'] = '#3f7eb1'
os.environ['CLIENT_BRANDING_SECONDARY_COLOR'] = '#b3c37d'
os.environ['APP_TABLE'] = 'harmonest-main'

# Import the handler
sys.path.insert(0, 'functions/email_verification')
from handler import handler

def test_email_verification():
    """Test the email verification function"""
    
    # Create a test event
    event = {
        "httpMethod": "POST",
        "path": "/email-verification",
        "body": json.dumps({
            "operation": "send-verification-email",
            "email": "fnikcoder@gmail.com",
            "type": "checkin"
        })
    }
    
    context = {}
    
    try:
        print("🧪 Testing email verification function...")
        result = handler(event, context)
        
        print("✅ Function executed successfully!")
        print("Response:", json.dumps(result, indent=2))
        
        return result
        
    except Exception as e:
        print("❌ Function failed!")
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    test_email_verification()
