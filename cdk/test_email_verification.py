#!/usr/bin/env python3
"""
Test script for Email Verification API
This script tests the email verification functionality locally or against deployed API
"""

import json
import requests
import time
import sys
from typing import Dict, Any

# Configuration
API_BASE_URL = "https://179a2g0pgk.execute-api.eu-central-1.amazonaws.com/prod"
TEST_EMAIL = "support@harmonest.de"

def test_send_verification_email(base_url: str, email: str) -> Dict[str, Any]:
    """Test sending verification email"""
    print(f"🔄 Testing send verification email to: {email}")
    
    payload = {
        "operation": "send-verification-email",
        "email": email,
        "type": "checkin"
    }
    
    try:
        response = requests.post(
            f"{base_url}/email-verification",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        result = response.json()
        
        if response.status_code == 200 and result.get("success"):
            print("✅ Send verification email: SUCCESS")
            print(f"   Message: {result.get('message')}")
            print(f"   Expires in: {result.get('data', {}).get('expiresInMinutes')} minutes")
            return result
        else:
            print("❌ Send verification email: FAILED")
            print(f"   Status: {response.status_code}")
            print(f"   Error: {result.get('message')}")
            print(f"   Error Code: {result.get('errorCode')}")
            return result
            
    except Exception as e:
        print(f"❌ Send verification email: EXCEPTION - {str(e)}")
        return {"success": False, "error": str(e)}


def test_verify_email_code(base_url: str, email: str, code: str) -> Dict[str, Any]:
    """Test verifying email code"""
    print(f"🔄 Testing verify email code: {code}")
    
    payload = {
        "operation": "verify-email-code",
        "email": email,
        "verificationCode": code,
        "type": "checkin"
    }
    
    try:
        response = requests.post(
            f"{base_url}/email-verification",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        result = response.json()
        
        if response.status_code == 200 and result.get("success"):
            print("✅ Verify email code: SUCCESS")
            print(f"   Message: {result.get('message')}")
            print(f"   Verified at: {result.get('data', {}).get('verifiedAt')}")
            return result
        else:
            print("❌ Verify email code: FAILED")
            print(f"   Status: {response.status_code}")
            print(f"   Error: {result.get('message')}")
            print(f"   Error Code: {result.get('errorCode')}")
            return result
            
    except Exception as e:
        print(f"❌ Verify email code: EXCEPTION - {str(e)}")
        return {"success": False, "error": str(e)}


def test_invalid_operations(base_url: str) -> None:
    """Test invalid operations and error handling"""
    print("🔄 Testing error handling...")
    
    # Test invalid operation
    payload = {
        "operation": "invalid-operation",
        "email": TEST_EMAIL
    }
    
    try:
        response = requests.post(
            f"{base_url}/email-verification",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        result = response.json()
        
        if response.status_code == 400 and result.get("errorCode") == "INVALID_OPERATION":
            print("✅ Invalid operation handling: SUCCESS")
        else:
            print("❌ Invalid operation handling: FAILED")
            print(f"   Expected 400 with INVALID_OPERATION, got {response.status_code} with {result.get('errorCode')}")
            
    except Exception as e:
        print(f"❌ Invalid operation test: EXCEPTION - {str(e)}")
    
    # Test invalid email
    payload = {
        "operation": "send-verification-email",
        "email": "invalid-email"
    }
    
    try:
        response = requests.post(
            f"{base_url}/email-verification",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        result = response.json()
        
        if response.status_code == 400 and result.get("errorCode") == "INVALID_EMAIL":
            print("✅ Invalid email handling: SUCCESS")
        else:
            print("❌ Invalid email handling: FAILED")
            print(f"   Expected 400 with INVALID_EMAIL, got {response.status_code} with {result.get('errorCode')}")
            
    except Exception as e:
        print(f"❌ Invalid email test: EXCEPTION - {str(e)}")


def test_cors(base_url: str) -> None:
    """Test CORS preflight request"""
    print("🔄 Testing CORS preflight...")
    
    try:
        response = requests.options(
            f"{base_url}/email-verification",
            headers={
                "Origin": "https://harmonest.de",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type"
            },
            timeout=30
        )
        
        if response.status_code == 200:
            print("✅ CORS preflight: SUCCESS")
            print(f"   Access-Control-Allow-Origin: {response.headers.get('Access-Control-Allow-Origin')}")
            print(f"   Access-Control-Allow-Methods: {response.headers.get('Access-Control-Allow-Methods')}")
        else:
            print("❌ CORS preflight: FAILED")
            print(f"   Status: {response.status_code}")
            
    except Exception as e:
        print(f"❌ CORS test: EXCEPTION - {str(e)}")


def main():
    """Main test function"""
    print("🚀 Starting Email Verification API Tests")
    print("=" * 50)
    
    # Check if API URL is configured
    if "your-api-id" in API_BASE_URL:
        print("⚠️  Please update API_BASE_URL with your actual API Gateway URL")
        print("   You can find it in the AWS Console or CDK outputs")
        return
    
    # Test 1: Send verification email
    print("\n📧 Test 1: Send Verification Email")
    send_result = test_send_verification_email(API_BASE_URL, TEST_EMAIL)
    
    if not send_result.get("success"):
        print("❌ Cannot proceed with verification test - email sending failed")
        return
    
    # Test 2: Verify with wrong code
    print("\n🔐 Test 2: Verify with Wrong Code")
    test_verify_email_code(API_BASE_URL, TEST_EMAIL, "000000")
    
    # Test 3: Manual verification (if running interactively)
    if len(sys.argv) > 1 and sys.argv[1] == "--interactive":
        print("\n🔐 Test 3: Manual Verification")
        print(f"📧 Check your email at {TEST_EMAIL} for the verification code")
        code = input("Enter the verification code from the email: ").strip()
        
        if code:
            test_verify_email_code(API_BASE_URL, TEST_EMAIL, code)
        else:
            print("⏭️  Skipping manual verification")
    
    # Test 4: Error handling
    print("\n❌ Test 4: Error Handling")
    test_invalid_operations(API_BASE_URL)
    
    # Test 5: CORS
    print("\n🌐 Test 5: CORS")
    test_cors(API_BASE_URL)
    
    print("\n" + "=" * 50)
    print("✅ Email Verification API Tests Completed")
    print("\n📝 Notes:")
    print("   - For production testing, ensure SES is out of sandbox mode")
    print("   - Verify that harmonest.com domain is verified in SES")
    print("   - Check CloudWatch logs for detailed error information")


if __name__ == "__main__":
    main()
