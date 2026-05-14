#!/usr/bin/env python3
"""
Test script for the refactored listings system
Tests:
1. G4H sync preserves custom fields
2. Custom fields can be updated via API
3. QR code generation uses new structure
"""

import json
import sys
import os
from unittest.mock import Mock, patch, MagicMock

# Mock environment variables before importing
os.environ['G4H_CRED_SECRET'] = 'mock-secret'
os.environ['G4H_SESSION_SECRET'] = 'mock-session-secret'
os.environ['APP_TABLE'] = 'mock-table'

# Add paths for testing
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'functions', 'listings'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'layer-src', 'python'))

def test_listing_structure():
    """Test that listings have the correct structure with custom fields"""
    print("Testing listing structure...")
    
    # Mock G4H data
    mock_raw_data = {
        "roomId": "test-room-123",
        "roomName": "Test Room",
        "ownerId": "owner-123",
        "guestyListing": {"id": "guesty-123", "name": "Test Room"},
        "roomApiConnection": {},
        "links": [],
        "bookingUserHotel": {},
        "bookingListing": {},
        "bookingRoomTypePricing": {},
        "homeAwayListings": [],
        "homeAwayHosts": [],
        "primaryHost": {},
        "airbnbHosts": [],
        "groupContext": {"groupId": "group-123"}
    }
    
    with patch('common.ddb.get') as mock_get, \
         patch('boto3.resource'):
        # No existing listing
        mock_get.return_value = None

        from functions.listings.handler import _project_listing

        result = _project_listing(mock_raw_data)
        
        # Check structure
        assert result["type"] == "listing"
        assert result["roomId"] == "test-room-123"
        assert "customFields" in result
        assert result["customFields"]["address"] == ""
        assert result["customFields"]["responsiblePerson"] == ""
        assert result["customFields"]["info4guest"] == ""
        assert result["customFields"]["doors"] == []
        assert "lastGuestySync" in result
        
        print("✓ New listing structure is correct")

def test_custom_fields_preservation():
    """Test that custom fields are preserved during G4H sync"""
    print("Testing custom fields preservation...")
    
    # Mock existing listing with custom fields
    existing_listing = {
        "PK": "LISTING#test-room-123",
        "SK": "META",
        "type": "listing",
        "roomId": "test-room-123",
        "customFields": {
            "address": "123 Test Street, Test City",
            "responsiblePerson": "John Doe",
            "info4guest": "Welcome to our property!",
            "doors": [
                {
                    "name": "Main Door",
                    "type": "qrlock",
                    "readerId": "reader-123"
                }
            ]
        },
        "lastCustomUpdate": 1234567890
    }
    
    # Mock G4H data (updated)
    mock_raw_data = {
        "roomId": "test-room-123",
        "roomName": "Updated Test Room",  # Changed
        "ownerId": "owner-123",
        "guestyListing": {"id": "guesty-123", "name": "Updated Test Room"},
        "roomApiConnection": {},
        "links": [],
        "bookingUserHotel": {},
        "bookingListing": {},
        "bookingRoomTypePricing": {},
        "homeAwayListings": [],
        "homeAwayHosts": [],
        "primaryHost": {},
        "airbnbHosts": [],
        "groupContext": {"groupId": "group-123"}
    }
    
    with patch('functions.listings.handler.get') as mock_get, \
         patch('boto3.resource'):
        # Mock get to return existing listing when called with the right parameters
        def mock_get_func(pk, sk):
            if pk == "LISTING#test-room-123" and sk == "META":
                return existing_listing
            return None
        mock_get.side_effect = mock_get_func

        from functions.listings.handler import _project_listing

        result = _project_listing(mock_raw_data)
        
        # Check that G4H data was updated
        assert result["roomName"] == "Updated Test Room"
        
        # Check that custom fields were preserved
        assert result["customFields"]["address"] == "123 Test Street, Test City"
        assert result["customFields"]["responsiblePerson"] == "John Doe"
        assert result["customFields"]["info4guest"] == "Welcome to our property!"
        assert len(result["customFields"]["doors"]) == 1
        assert result["customFields"]["doors"][0]["name"] == "Main Door"
        assert result["lastCustomUpdate"] == 1234567890
        
        print("✓ Custom fields preserved during G4H sync")

def test_api_custom_fields_update():
    """Test API endpoint for updating custom fields"""
    print("Testing API custom fields update...")
    
    # Mock existing listing
    existing_listing = {
        "PK": "LISTING#test-room-123",
        "SK": "META",
        "type": "listing",
        "roomId": "test-room-123",
        "customFields": {
            "address": "",
            "responsiblePerson": "",
            "info4guest": "",
            "doors": []
        }
    }
    
    # Mock user context (admin)
    user_context = {
        "authenticated": True,
        "user_role": "admin",
        "user_id": "admin-123"
    }
    
    # Custom fields to update
    custom_fields = {
        "address": "456 New Street, New City",
        "responsiblePerson": "Jane Smith",
        "doors": [
            {
                "name": "Front Door",
                "type": "ttlock",
                "lockId": "lock-456"
            }
        ]
    }
    
    with patch('common.ddb.get') as mock_get, \
         patch('common.ddb.put') as mock_put, \
         patch('boto3.resource'):

        mock_get.return_value = existing_listing

        from functions.listings.enhanced_handler import update_listing_custom_fields
        
        result = update_listing_custom_fields("test-room-123", custom_fields, user_context)
        
        # Check response
        assert result["statusCode"] == 200
        response_data = json.loads(result["body"])
        assert response_data["success"] == True
        assert "address" in response_data["data"]["updatedFields"]
        assert "responsiblePerson" in response_data["data"]["updatedFields"]
        assert "doors" in response_data["data"]["updatedFields"]
        
        # Check that put was called
        mock_put.assert_called_once()
        saved_listing = mock_put.call_args[0][0]
        assert saved_listing["customFields"]["address"] == "456 New Street, New City"
        assert saved_listing["customFields"]["responsiblePerson"] == "Jane Smith"
        assert len(saved_listing["customFields"]["doors"]) == 1
        
        print("✓ API custom fields update works correctly")

def test_unauthorized_access():
    """Test that unauthorized users cannot update custom fields"""
    print("Testing unauthorized access...")
    
    # Mock user context (guest - unauthorized)
    user_context = {
        "authenticated": True,
        "user_role": "guest",
        "user_id": "guest-123"
    }
    
    custom_fields = {"address": "Unauthorized update"}
    
    from functions.listings.enhanced_handler import update_listing_custom_fields
    
    result = update_listing_custom_fields("test-room-123", custom_fields, user_context)
    
    # Check that access was denied
    assert result["statusCode"] == 403
    response_data = json.loads(result["body"])
    assert response_data["success"] == False
    assert "Insufficient permissions" in response_data["message"]
    
    print("✓ Unauthorized access properly blocked")

def run_all_tests():
    """Run all tests"""
    print("Running refactored listings system tests...\n")
    
    try:
        test_listing_structure()
        test_custom_fields_preservation()
        test_api_custom_fields_update()
        test_unauthorized_access()
        
        print("\n✅ All tests passed! Refactored system is working correctly.")
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
