#!/usr/bin/env python3
"""
Test script for the refactored reservation system
Tests:
1. G4H sync preserves custom fields (checkin and doorAccesses)
2. Check-in handler updates customFields.checkin
3. QR code handler updates customFields.doorAccesses
"""

import json
import sys
import os
from unittest.mock import Mock, patch, MagicMock

# Mock environment variables before importing
os.environ['G4H_CRED_SECRET'] = 'mock-secret'
os.environ['G4H_SESSION_SECRET'] = 'mock-session-secret'
os.environ['APP_TABLE'] = 'mock-table'
os.environ['STORAGE_BUCKET'] = 'mock-bucket'

# Add paths for testing
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'functions', 'reservations'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'functions', 'checkin'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'functions', 'qr_code_notification'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'layer-src', 'python'))

def test_reservation_structure():
    """Test that reservations have the correct structure with custom fields"""
    print("Testing reservation structure...")
    
    # Mock G4H reservation data
    mock_raw_data = {
        "reservationId": "test-reservation-123",
        "roomId": "room-456",
        "guestName": "John",
        "guestSurname": "Doe",
        "email": "john.doe@email.com",
        "phoneNumber": "+1234567890",
        "checkInDate": 1234567890000,
        "checkOutDate": 1234654290000,
        "status": 1,
        "price": 150.0
    }
    
    with patch('common.ddb.get') as mock_get, \
         patch('boto3.resource'):
        # No existing reservation
        mock_get.return_value = None
        
        from functions.reservations.handler import _project_reservation
        
        result = _project_reservation(mock_raw_data)
        
        # Check structure
        assert result["reservationId"] == "test-reservation-123"
        assert "customFields" in result
        assert "checkin" in result["customFields"]
        assert "doorAccesses" in result["customFields"]
        
        # Check checkin structure
        checkin = result["customFields"]["checkin"]
        assert checkin["status"] == "pending"
        assert checkin["mainGuestFirstname"] == ""
        assert checkin["mainGuestLastname"] == ""
        assert checkin["mainGuestEmail"] == ""
        assert checkin["mainGuestPhoneNumber"] == ""
        assert checkin["qrCodeScheduled"] == False
        assert checkin["qrCodeTriggerTime"] is None
        assert "createdAt" in checkin
        assert "updatedAt" in checkin
        
        # Check doorAccesses structure
        door_accesses = result["customFields"]["doorAccesses"]
        assert door_accesses["qrCode"] == ""
        assert door_accesses["pinCodes"] == {}
        assert door_accesses["status"] == "pending"
        
        assert "lastGuestySync" in result
        
        print("✓ New reservation structure is correct")

def test_custom_fields_preservation():
    """Test that custom fields are preserved during G4H sync"""
    print("Testing custom fields preservation...")
    
    # Mock existing reservation with custom fields
    existing_reservation = {
        "PK": "RESERVATION#test-reservation-123",
        "SK": "META",
        "reservationId": "test-reservation-123",
        "customFields": {
            "checkin": {
                "status": "completed",
                "mainGuestFirstname": "John",
                "mainGuestLastname": "Doe",
                "mainGuestEmail": "john.doe@email.com",
                "mainGuestPhoneNumber": "+1234567890",
                "submittedAt": 1234567890,
                "createdAt": 1234567890,
                "updatedAt": 1234567890,
                "qrCodeScheduled": True,
                "qrCodeTriggerTime": 1234567890,
                "qrCodeGeneratedAt": 1234567890
            },
            "doorAccesses": {
                "qrCode": "QR123456",
                "pinCodes": {"Main Door": "1234"},
                "status": "active",
                "generatedAt": 1234567890
            }
        },
        "lastCustomUpdate": 1234567890
    }
    
    # Mock G4H data (updated price)
    mock_raw_data = {
        "reservationId": "test-reservation-123",
        "roomId": "room-456",
        "guestName": "John",
        "guestSurname": "Doe",
        "email": "john.doe@email.com",
        "phoneNumber": "+1234567890",
        "checkInDate": 1234567890000,
        "checkOutDate": 1234654290000,
        "status": 1,
        "price": 175.0  # Changed price
    }
    
    with patch('functions.reservations.handler.get') as mock_get, \
         patch('boto3.resource'):
        # Mock get to return existing reservation
        def mock_get_func(pk, sk):
            if pk == "RESERVATION#test-reservation-123" and sk == "META":
                return existing_reservation
            return None
        mock_get.side_effect = mock_get_func
        
        from functions.reservations.handler import _project_reservation
        
        result = _project_reservation(mock_raw_data)
        
        # Check that G4H data was updated
        assert result["price"] == 175.0
        
        # Check that custom fields were preserved
        assert result["customFields"]["checkin"]["status"] == "completed"
        assert result["customFields"]["checkin"]["mainGuestFirstname"] == "John"
        assert result["customFields"]["checkin"]["qrCodeTriggerTime"] == 1234567890
        assert result["customFields"]["checkin"]["qrCodeGeneratedAt"] == 1234567890
        assert result["customFields"]["doorAccesses"]["qrCode"] == "QR123456"
        assert result["customFields"]["doorAccesses"]["pinCodes"]["Main Door"] == "1234"
        assert result["lastCustomUpdate"] == 1234567890
        
        print("✓ Custom fields preserved during G4H sync")

def test_checkin_handler_updates():
    """Test that check-in handler updates customFields.checkin"""
    print("Testing check-in handler updates...")
    
    # Mock existing reservation
    existing_reservation = {
        "PK": "RESERVATION#test-reservation-123",
        "SK": "META",
        "reservationId": "test-reservation-123",
        "customFields": {
            "checkin": {
                "status": "pending",
                "mainGuestFirstname": "",
                "mainGuestLastname": "",
                "mainGuestEmail": "",
                "mainGuestPhoneNumber": ""
            },
            "doorAccesses": {
                "qrCode": "",
                "pinCodes": {},
                "status": "pending"
            }
        }
    }
    
    # Mock check-in data
    checkin_data = {
        "firstName": "Jane",
        "lastName": "Smith",
        "email": "jane.smith@email.com",
        "phone": "+9876543210",
        "status": "completed",
        "idCardUrl": "s3://bucket/file.jpg",
        "qrCodeTriggerScheduled": True,
        "qrCodeTriggerTime": 1234567890
    }
    
    with patch('common.ddb.get') as mock_get, \
         patch('common.ddb.put') as mock_put, \
         patch('boto3.resource'):
        
        mock_get.return_value = existing_reservation
        
        from functions.checkin.handler import _create_or_update_checkin_record
        
        _create_or_update_checkin_record("test-reservation-123", checkin_data)
        
        # Check that put was called
        mock_put.assert_called_once()
        saved_reservation = mock_put.call_args[0][0]
        
        # Check that custom fields were updated
        checkin_fields = saved_reservation["customFields"]["checkin"]
        assert checkin_fields["status"] == "completed"
        assert checkin_fields["mainGuestFirstname"] == "Jane"
        assert checkin_fields["mainGuestLastname"] == "Smith"
        assert checkin_fields["mainGuestEmail"] == "jane.smith@email.com"
        assert checkin_fields["mainGuestPhoneNumber"] == "+9876543210"
        assert checkin_fields["qrCodeScheduled"] == True
        assert checkin_fields["qrCodeTriggerTime"] == 1234567890
        assert "createdAt" in checkin_fields
        assert "updatedAt" in checkin_fields
        assert len(checkin_fields["documents"]) == 1
        assert checkin_fields["documents"][0]["s3Key"] == "s3://bucket/file.jpg"
        
        print("✓ Check-in handler updates customFields.checkin correctly")

def test_door_access_storage():
    """Test that door access data is stored in customFields.doorAccesses"""
    print("Testing door access storage...")
    
    # Mock existing reservation
    existing_reservation = {
        "PK": "RESERVATION#test-reservation-123",
        "SK": "META",
        "reservationId": "test-reservation-123",
        "customFields": {
            "checkin": {"status": "completed"},
            "doorAccesses": {
                "qrCode": "",
                "pinCodes": {},
                "status": "pending",
                "usageHistory": []
            }
        }
    }
    
    # Mock door access data
    door_accesses = [
        {
            "doorName": "Main Door",
            "type": "qr_code",
            "accessCode": "QR789012",
            "doorLocation": "Front entrance"
        },
        {
            "doorName": "Balcony Door",
            "type": "pin_code", 
            "accessCode": "5678",
            "doorLocation": "Balcony"
        }
    ]
    
    with patch('common.ddb.get') as mock_get, \
         patch('common.ddb.put') as mock_put, \
         patch('boto3.resource'):
        
        mock_get.return_value = existing_reservation
        
        from functions.qr_code_notification.handler import _step6_store_access_info
        
        result = _step6_store_access_info("test-reservation-123", door_accesses, True)
        
        # Check success
        assert result["success"] == True
        
        # Check that put was called
        mock_put.assert_called_once()
        saved_reservation = mock_put.call_args[0][0]
        
        # Check that door access data was stored correctly
        door_access_fields = saved_reservation["customFields"]["doorAccesses"]
        assert door_access_fields["qrCode"] == "QR789012"
        assert door_access_fields["pinCodes"]["Balcony Door"] == "5678"
        assert door_access_fields["status"] == "active"
        assert door_access_fields["doorInfo"]["total_doors"] == 2
        assert len(door_access_fields["doorInfo"]["qr_doors"]) == 1
        assert len(door_access_fields["doorInfo"]["pin_doors"]) == 1
        
        print("✓ Door access data stored in customFields.doorAccesses correctly")

def run_all_tests():
    """Run all tests"""
    print("Running refactored reservation system tests...\n")
    
    try:
        test_reservation_structure()
        test_custom_fields_preservation()
        test_checkin_handler_updates()
        test_door_access_storage()
        
        print("\n✅ All reservation tests passed! Refactored system is working correctly.")
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
