"""
End-to-End Workflow Tests

Tests that validate complete user workflows across different client configurations.
"""

import pytest
import json
import time
import boto3
from unittest.mock import patch, MagicMock
from moto import mock_dynamodb, mock_s3, mock_secretsmanager, mock_ssm, mock_events


@pytest.mark.e2e
class TestCompleteCheckinWorkflow:
    """Test complete check-in workflow from validation to completion"""
    
    def test_complete_checkin_flow(self, test_environment, mock_aws_services, lambda_context):
        """Test complete check-in workflow with client-specific configuration"""
        client = test_environment.config["client"]
        
        # Set up environment variables
        env_vars = {
            "APP_TABLE": f"{client['name']}-test-main",
            "STORAGE_BUCKET": f"{client['name']}-test-storage",
            "CLIENT_NAME": client["name"],
            "CLIENT_DISPLAY_NAME": client["displayName"],
            "CLIENT_DOMAIN_PRIMARY": client["domains"]["primary"],
            "CLIENT_EMAIL_NOREPLY": client["email"]["noreply"],
            "CHECKIN_ENABLED": "true",
            "CHECKIN_DEADLINE_HOURS": str(client.get("features", {}).get("checkin", {}).get("deadlineHours", 25)),
            "QR_CODE_ENABLED": str(client.get("features", {}).get("checkin", {}).get("qrCodeEnabled", True)).lower()
        }
        
        # Create test table
        table = mock_aws_services["dynamodb"].create_table(
            TableName=env_vars["APP_TABLE"],
            KeySchema=[
                {"AttributeName": "pk", "KeyType": "HASH"},
                {"AttributeName": "sk", "KeyType": "RANGE"}
            ],
            AttributeDefinitions=[
                {"AttributeName": "pk", "AttributeType": "S"},
                {"AttributeName": "sk", "AttributeType": "S"}
            ],
            BillingMode="PAY_PER_REQUEST"
        )
        
        # Create test S3 bucket
        s3_client = mock_aws_services["s3"]
        s3_client.create_bucket(Bucket=env_vars["STORAGE_BUCKET"])
        
        # Add test reservation data
        future_checkin = int(time.time() * 1000) + (48 * 60 * 60 * 1000)  # 48 hours from now
        table.put_item(Item={
            "pk": "RESERVATION#TEST001",
            "sk": "METADATA",
            "reservationId": "TEST001",
            "reservationCode": "ABC123",
            "guestName": "John",
            "guestLastName": "Doe",
            "status": 1,
            "checkInDateWithTime": future_checkin,
            "checkOutDateWithTime": future_checkin + (2 * 24 * 60 * 60 * 1000),
            "listingId": "LISTING001"
        })
        
        # Add listing data
        table.put_item(Item={
            "pk": "LISTING#LISTING001",
            "sk": "METADATA",
            "listingId": "LISTING001",
            "title": "Test Property",
            "address": "123 Test Street"
        })
        
        with patch.dict("os.environ", env_vars):
            from functions.checkin.handler import handler
            
            # Step 1: Validate reservation
            validate_event = {
                "httpMethod": "POST",
                "path": "/checkin",
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({
                    "operation": "validate",
                    "reservationCode": "ABC123",
                    "guestFirstName": "John"
                })
            }
            
            response = handler(validate_event, lambda_context)
            assert response["statusCode"] == 200
            
            validate_body = json.loads(response["body"])
            assert validate_body["success"] is True
            assert validate_body["data"]["reservationId"] == "TEST001"
            
            # Step 2: Submit check-in information
            submit_event = {
                "httpMethod": "POST",
                "path": "/checkin",
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({
                    "operation": "submit",
                    "reservationId": "TEST001",
                    "guestName": "John",
                    "guestLastName": "Doe",
                    "guestEmail": "john.doe@example.com",
                    "guestPhone": "+1234567890",
                    "estimatedArrival": "14:00",
                    "specialRequests": "Late check-in please"
                })
            }
            
            response = handler(submit_event, lambda_context)
            assert response["statusCode"] == 200
            
            submit_body = json.loads(response["body"])
            assert submit_body["success"] is True
            assert "checkinId" in submit_body["data"]
            
            # Step 3: Get check-in status
            get_event = {
                "httpMethod": "GET",
                "path": "/checkin",
                "headers": {},
                "queryStringParameters": {"reservationId": "TEST001"}
            }
            
            response = handler(get_event, lambda_context)
            assert response["statusCode"] == 200
            
            get_body = json.loads(response["body"])
            assert get_body["success"] is True
            assert get_body["data"]["status"] == "completed"
            assert get_body["data"]["guestEmail"] == "john.doe@example.com"
            
            # Step 4: Update check-in information (should work before deadline)
            update_event = {
                "httpMethod": "PUT",
                "path": "/checkin",
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({
                    "reservationId": "TEST001",
                    "guestPhone": "+1987654321",  # Update phone number
                    "specialRequests": "Updated: Early check-in if possible"
                })
            }
            
            response = handler(update_event, lambda_context)
            assert response["statusCode"] == 200
            
            update_body = json.loads(response["body"])
            assert update_body["success"] is True
            
            # Verify update was applied
            response = handler(get_event, lambda_context)
            get_body = json.loads(response["body"])
            assert get_body["data"]["guestPhone"] == "+1987654321"
            assert "Updated: Early check-in" in get_body["data"]["specialRequests"]
    
    def test_checkin_with_qr_code_generation(self, test_environment, mock_aws_services, lambda_context):
        """Test check-in workflow with QR code generation"""
        client = test_environment.config["client"]
        
        # Only test if QR codes are enabled
        qr_enabled = client.get("features", {}).get("checkin", {}).get("qrCodeEnabled", True)
        if not qr_enabled:
            pytest.skip("QR code generation is disabled for this client")
        
        env_vars = {
            "APP_TABLE": f"{client['name']}-test-main",
            "CLIENT_NAME": client["name"],
            "QR_CODE_ENABLED": "true"
        }
        
        # Create test table
        table = mock_aws_services["dynamodb"].create_table(
            TableName=env_vars["APP_TABLE"],
            KeySchema=[
                {"AttributeName": "pk", "KeyType": "HASH"},
                {"AttributeName": "sk", "KeyType": "RANGE"}
            ],
            AttributeDefinitions=[
                {"AttributeName": "pk", "AttributeType": "S"},
                {"AttributeName": "sk", "AttributeType": "S"}
            ],
            BillingMode="PAY_PER_REQUEST"
        )
        
        # Add test data
        future_checkin = int(time.time() * 1000) + (24 * 60 * 60 * 1000)
        table.put_item(Item={
            "pk": "RESERVATION#TEST002",
            "sk": "METADATA",
            "reservationId": "TEST002",
            "reservationCode": "XYZ789",
            "guestName": "Jane",
            "guestLastName": "Smith",
            "status": 1,
            "checkInDateWithTime": future_checkin
        })
        
        with patch.dict("os.environ", env_vars):
            from functions.checkin.handler import handler
            
            # Submit check-in with QR code request
            submit_event = {
                "httpMethod": "POST",
                "path": "/checkin",
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({
                    "operation": "submit",
                    "reservationId": "TEST002",
                    "guestName": "Jane",
                    "guestLastName": "Smith",
                    "guestEmail": "jane.smith@example.com",
                    "generateQRCode": True
                })
            }
            
            # Mock QR code generation
            with patch('functions.checkin.handler._generate_qr_code') as mock_qr:
                mock_qr.return_value = "mock-qr-code-data"
                
                response = handler(submit_event, lambda_context)
                assert response["statusCode"] == 200
                
                body = json.loads(response["body"])
                assert body["success"] is True
                
                # QR code should be generated for enabled clients
                mock_qr.assert_called_once()


@pytest.mark.e2e
class TestListingsSyncWorkflow:
    """Test listings synchronization workflow"""
    
    def test_listings_sync_and_public_api(self, test_environment, mock_aws_services):
        """Test complete listings sync and public API workflow"""
        client = test_environment.config["client"]
        
        # Check if listings sync is enabled
        listings_enabled = client.get("features", {}).get("listings", {}).get("syncEnabled", True)
        if not listings_enabled:
            pytest.skip("Listings sync is disabled for this client")
        
        env_vars = {
            "APP_TABLE": f"{client['name']}-test-main",
            "CLIENT_NAME": client["name"],
            "LISTINGS_SYNC_ENABLED": "true",
            "PUBLIC_LISTINGS_ENABLED": str(client.get("features", {}).get("listings", {}).get("publicListings", False)).lower()
        }
        
        # Create test table
        table = mock_aws_services["dynamodb"].create_table(
            TableName=env_vars["APP_TABLE"],
            KeySchema=[
                {"AttributeName": "pk", "KeyType": "HASH"},
                {"AttributeName": "sk", "KeyType": "RANGE"}
            ],
            AttributeDefinitions=[
                {"AttributeName": "pk", "AttributeType": "S"},
                {"AttributeName": "sk", "AttributeType": "S"}
            ],
            BillingMode="PAY_PER_REQUEST"
        )
        
        with patch.dict("os.environ", env_vars):
            # Step 1: Simulate listings sync
            from functions.listings.handler import handler as listings_handler
            
            # Mock G4H API response
            mock_listings_data = [
                {
                    "id": "LISTING001",
                    "title": "Beautiful Apartment",
                    "address": "123 Main St",
                    "rooms": 2,
                    "maxGuests": 4
                },
                {
                    "id": "LISTING002", 
                    "title": "Cozy Studio",
                    "address": "456 Oak Ave",
                    "rooms": 1,
                    "maxGuests": 2
                }
            ]
            
            with patch('common.g4h.get_client') as mock_g4h:
                mock_client = MagicMock()
                mock_client.get_listings.return_value = mock_listings_data
                mock_g4h.return_value = mock_client
                
                # Trigger listings sync
                sync_event = {"source": "aws.events"}
                response = listings_handler(sync_event, {})
                
                # Verify sync completed
                assert response["statusCode"] == 200
            
            # Step 2: Test public listings API
            from functions.listings.public_api_handler import handler as public_handler
            
            # Add listings metadata to table
            table.put_item(Item={
                "pk": "LISTINGS",
                "sk": "METADATA",
                "totalGroups": 2,
                "totalRooms": 3,
                "success": True,
                "updatedAt": "2024-01-01T00:00:00Z"
            })
            
            # Test public listings endpoint
            public_event = {
                "httpMethod": "GET",
                "path": "/public/listings",
                "headers": {},
                "queryStringParameters": None
            }
            
            response = public_handler(public_event, {})
            assert response["statusCode"] == 200
            
            body = json.loads(response["body"])
            assert body["client"] == client["name"]
            assert body["dataSource"] == f"{client['name']}_api"
            assert body["totalGroups"] == 2
            assert body["totalRooms"] == 3


@pytest.mark.e2e
class TestReservationsSyncWorkflow:
    """Test reservations synchronization workflow"""
    
    def test_reservations_sync_with_custom_interval(self, test_environment, mock_aws_services):
        """Test reservations sync with client-specific interval"""
        client = test_environment.config["client"]
        
        # Check if reservations sync is enabled
        reservations_enabled = client.get("features", {}).get("reservations", {}).get("syncEnabled", True)
        if not reservations_enabled:
            pytest.skip("Reservations sync is disabled for this client")
        
        sync_interval = client.get("features", {}).get("reservations", {}).get("syncIntervalMinutes", 30)
        
        env_vars = {
            "APP_TABLE": f"{client['name']}-test-main",
            "CLIENT_NAME": client["name"],
            "RESERVATIONS_SYNC_ENABLED": "true",
            "RESERVATIONS_SYNC_INTERVAL": str(sync_interval)
        }
        
        # Create test table
        table = mock_aws_services["dynamodb"].create_table(
            TableName=env_vars["APP_TABLE"],
            KeySchema=[
                {"AttributeName": "pk", "KeyType": "HASH"},
                {"AttributeName": "sk", "KeyType": "RANGE"}
            ],
            AttributeDefinitions=[
                {"AttributeName": "pk", "AttributeType": "S"},
                {"AttributeName": "sk", "AttributeType": "S"}
            ],
            BillingMode="PAY_PER_REQUEST"
        )
        
        with patch.dict("os.environ", env_vars):
            from functions.reservations.handler import handler as reservations_handler
            
            # Mock G4H API response
            mock_reservations_data = [
                {
                    "id": "RES001",
                    "confirmationCode": "ABC123",
                    "guestName": "John Doe",
                    "checkInDate": "2024-01-15",
                    "checkOutDate": "2024-01-17",
                    "status": 1,
                    "listingId": "LISTING001"
                }
            ]
            
            with patch('common.g4h.get_client') as mock_g4h:
                mock_client = MagicMock()
                mock_client.get_reservations.return_value = mock_reservations_data
                mock_g4h.return_value = mock_client
                
                # Trigger reservations sync
                sync_event = {"source": "aws.events"}
                response = reservations_handler(sync_event, {})
                
                # Verify sync completed
                assert response["statusCode"] == 200
                
                # Verify reservation was stored with client-specific data
                stored_reservation = table.get_item(
                    Key={"pk": "RESERVATION#RES001", "sk": "METADATA"}
                )
                
                assert "Item" in stored_reservation
                assert stored_reservation["Item"]["reservationId"] == "RES001"
                assert stored_reservation["Item"]["reservationCode"] == "ABC123"


@pytest.mark.e2e
class TestMultiClientIsolation:
    """Test that multiple clients operate independently"""
    
    def test_client_data_isolation(self, test_environments, mock_aws_services):
        """Test that different clients don't interfere with each other"""
        if len(test_environments) < 2:
            pytest.skip("Need at least 2 test environments for isolation testing")
        
        # Take first two environments
        env1, env2 = test_environments[:2]
        
        # Create separate tables for each client
        table1_name = f"{env1.client_name}-{env1.env_name}-main"
        table2_name = f"{env2.client_name}-{env2.env_name}-main"
        
        table1 = mock_aws_services["dynamodb"].create_table(
            TableName=table1_name,
            KeySchema=[
                {"AttributeName": "pk", "KeyType": "HASH"},
                {"AttributeName": "sk", "KeyType": "RANGE"}
            ],
            AttributeDefinitions=[
                {"AttributeName": "pk", "AttributeType": "S"},
                {"AttributeName": "sk", "AttributeType": "S"}
            ],
            BillingMode="PAY_PER_REQUEST"
        )
        
        table2 = mock_aws_services["dynamodb"].create_table(
            TableName=table2_name,
            KeySchema=[
                {"AttributeName": "pk", "KeyType": "HASH"},
                {"AttributeName": "sk", "KeyType": "RANGE"}
            ],
            AttributeDefinitions=[
                {"AttributeName": "pk", "AttributeType": "S"},
                {"AttributeName": "sk", "AttributeType": "S"}
            ],
            BillingMode="PAY_PER_REQUEST"
        )
        
        # Add data to each table
        table1.put_item(Item={
            "pk": "RESERVATION#CLIENT1_RES001",
            "sk": "METADATA",
            "reservationId": "CLIENT1_RES001",
            "clientName": env1.client_name
        })
        
        table2.put_item(Item={
            "pk": "RESERVATION#CLIENT2_RES001", 
            "sk": "METADATA",
            "reservationId": "CLIENT2_RES001",
            "clientName": env2.client_name
        })
        
        # Verify data isolation
        # Client 1 should only see its own data
        client1_data = table1.scan()["Items"]
        assert len(client1_data) == 1
        assert client1_data[0]["clientName"] == env1.client_name
        
        # Client 2 should only see its own data
        client2_data = table2.scan()["Items"]
        assert len(client2_data) == 1
        assert client2_data[0]["clientName"] == env2.client_name
        
        # Verify no cross-contamination
        assert client1_data[0]["reservationId"] != client2_data[0]["reservationId"]
