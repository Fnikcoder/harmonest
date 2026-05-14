#!/usr/bin/env python3
"""
QR Code Notification System Test Script
Tests the complete flow from check-in to QR code delivery
"""
import json
import boto3
import requests
import time
import sys
from typing import Dict, Any


class QRNotificationTester:
    """Test suite for QR Code Notification system"""
    
    def __init__(self, env_name: str = "prod", region: str = "eu-central-1"):
        self.env_name = env_name
        self.region = region
        self.dynamodb = boto3.resource('dynamodb', region_name=region)
        self.ssm = boto3.client('ssm', region_name=region)
        self.lambda_client = boto3.client('lambda', region_name=region)
        
        # Get configuration from SSM
        self.table_name = self._get_ssm_parameter(f"/harmonest/{env_name}/table/name")
        self.api_endpoint = self._get_ssm_parameter(f"/harmonest/{env_name}/door-access/endpoint")
        
        print(f"Testing environment: {env_name}")
        print(f"Table: {self.table_name}")
        print(f"API Endpoint: {self.api_endpoint}")
    
    def _get_ssm_parameter(self, name: str) -> str:
        """Get parameter from SSM"""
        try:
            response = self.ssm.get_parameter(Name=name)
            return response['Parameter']['Value']
        except Exception as e:
            print(f"Error getting SSM parameter {name}: {str(e)}")
            return ""
    
    def create_test_data(self) -> Dict[str, str]:
        """Create test reservation and check-in data"""
        test_id = f"test-{int(time.time())}"
        reservation_id = f"RES-{test_id}"
        reservation_code = f"CODE-{test_id}"
        
        # Create test reservation
        reservation_data = {
            "PK": f"RESERVATION#{reservation_id}",
            "SK": "DETAILS",
            "reservationId": reservation_id,
            "reservationCode": reservation_code,
            "roomName": "101",
            "listingName": "Test Room 101",
            "guestFirstName": "Test",
            "guestLastName": "Guest",
            "checkInDateUtc": int(time.time() * 1000) + (24 * 60 * 60 * 1000),  # Tomorrow
            "checkOutDateUtc": int(time.time() * 1000) + (48 * 60 * 60 * 1000),  # Day after tomorrow
            "status": 1,
            "createdAt": int(time.time() * 1000),
            "updatedAt": int(time.time() * 1000)
        }
        
        # Create test check-in
        checkin_data = {
            "PK": f"CHECKIN#{reservation_id}",
            "SK": "DETAILS",
            "reservationId": reservation_id,
            "reservationCode": reservation_code,
            "guestFirstName": "Test",
            "guestLastName": "Guest",
            "guestEmail": "test@example.com",
            "guestPhone": "+49123456789",
            "notificationPreference": "email",
            "status": "completed",
            "createdAt": int(time.time() * 1000),
            "updatedAt": int(time.time() * 1000)
        }
        
        # Insert test data
        table = self.dynamodb.Table(self.table_name)
        table.put_item(Item=reservation_data)
        table.put_item(Item=checkin_data)
        
        print(f"✅ Created test data:")
        print(f"   Reservation ID: {reservation_id}")
        print(f"   Reservation Code: {reservation_code}")
        print(f"   Room: 101")
        
        return {
            "reservationId": reservation_id,
            "reservationCode": reservation_code,
            "roomName": "101"
        }
    
    def create_test_room_config(self):
        """Create test room configuration"""
        room_config = {
            "PK": "ROOM_CONFIG#harmonest",
            "SK": "ROOM#101",
            "roomName": "101",
            "roomType": "standard",
            "doors": [
                {
                    "name": "Main Entrance",
                    "readerId": "12345",
                    "type": "qrlock",
                    "description": "Building main entrance"
                },
                {
                    "name": "Room 101 Door",
                    "readerId": "12347",
                    "type": "qrlock",
                    "description": "Room 101 entrance"
                }
            ],
            "createdAt": int(time.time() * 1000),
            "updatedAt": int(time.time() * 1000)
        }
        
        table = self.dynamodb.Table(self.table_name)
        table.put_item(Item=room_config)
        
        print("✅ Created test room configuration for Room 101")
    
    def test_qr_notification_api(self, reservation_id: str) -> bool:
        """Test QR notification API endpoint"""
        print("\n🧪 Testing QR Notification API...")
        
        payload = {
            "reservationId": reservation_id
        }
        
        try:
            response = requests.post(
                self.api_endpoint,
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=30
            )
            
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"   Success: {data.get('success')}")
                print(f"   Message: {data.get('message')}")
                
                if data.get('data'):
                    result_data = data['data']
                    print(f"   QR Code: {result_data.get('qrCode', 'N/A')}")
                    print(f"   Notification Type: {result_data.get('notificationType', 'N/A')}")
                    print(f"   Door Count: {result_data.get('doorCount', 'N/A')}")
                
                return data.get('success', False)
            else:
                print(f"   Error: {response.text}")
                return False
                
        except Exception as e:
            print(f"   Exception: {str(e)}")
            return False
    
    def test_lambda_direct_invoke(self, reservation_id: str) -> bool:
        """Test Lambda function direct invocation"""
        print("\n🧪 Testing Lambda Direct Invocation...")
        
        function_name = f"harmonest-{self.env_name}-lambda_door_access_notification"
        
        payload = {
            "body": json.dumps({
                "reservationId": reservation_id
            })
        }
        
        try:
            response = self.lambda_client.invoke(
                FunctionName=function_name,
                InvocationType='RequestResponse',
                Payload=json.dumps(payload)
            )
            
            result = json.loads(response['Payload'].read())
            print(f"   Status Code: {result.get('statusCode')}")
            
            if result.get('statusCode') == 200:
                body = json.loads(result.get('body', '{}'))
                print(f"   Success: {body.get('success')}")
                print(f"   Message: {body.get('message')}")
                return body.get('success', False)
            else:
                print(f"   Error: {result}")
                return False
                
        except Exception as e:
            print(f"   Exception: {str(e)}")
            return False
    
    def test_eventbridge_integration(self, reservation_id: str) -> bool:
        """Test EventBridge integration"""
        print("\n🧪 Testing EventBridge Integration...")
        
        # This would test the EventBridge rule creation from check-in
        # For now, we'll simulate the event
        
        function_name = f"harmonest-{self.env_name}-lambda_door_access_notification"
        
        # Simulate EventBridge event
        eventbridge_payload = {
            "detail": {
                "reservationId": reservation_id
            },
            "source": "harmonest.checkin",
            "detail-type": "QR Code Generation Scheduled"
        }
        
        try:
            response = self.lambda_client.invoke(
                FunctionName=function_name,
                InvocationType='RequestResponse',
                Payload=json.dumps(eventbridge_payload)
            )
            
            result = json.loads(response['Payload'].read())
            print(f"   Status Code: {result.get('statusCode')}")
            
            if result.get('statusCode') == 200:
                body = json.loads(result.get('body', '{}'))
                print(f"   Success: {body.get('success')}")
                print(f"   Message: {body.get('message')}")
                return body.get('success', False)
            else:
                print(f"   Error: {result}")
                return False
                
        except Exception as e:
            print(f"   Exception: {str(e)}")
            return False
    
    def cleanup_test_data(self, reservation_id: str):
        """Clean up test data"""
        print("\n🧹 Cleaning up test data...")
        
        table = self.dynamodb.Table(self.table_name)
        
        try:
            # Delete reservation
            table.delete_item(Key={"PK": f"RESERVATION#{reservation_id}", "SK": "DETAILS"})
            
            # Delete check-in
            table.delete_item(Key={"PK": f"CHECKIN#{reservation_id}", "SK": "DETAILS"})
            
            # Delete QR code record if exists
            table.delete_item(Key={"PK": f"QR_CODE#{reservation_id}", "SK": "DETAILS"})
            
            print("   ✅ Test data cleaned up")
            
        except Exception as e:
            print(f"   ⚠️ Error cleaning up: {str(e)}")
    
    def run_full_test(self) -> bool:
        """Run complete test suite"""
        print("🚀 Starting QR Code Notification System Test")
        print("=" * 50)
        
        # Create test data
        test_data = self.create_test_data()
        reservation_id = test_data["reservationId"]
        
        # Create room configuration
        self.create_test_room_config()
        
        try:
            # Test API endpoint
            api_success = self.test_qr_notification_api(reservation_id)
            
            # Test direct Lambda invocation
            lambda_success = self.test_lambda_direct_invoke(reservation_id)
            
            # Test EventBridge integration
            eventbridge_success = self.test_eventbridge_integration(reservation_id)
            
            # Summary
            print("\n📊 Test Results Summary:")
            print("=" * 30)
            print(f"   API Endpoint: {'✅ PASS' if api_success else '❌ FAIL'}")
            print(f"   Lambda Direct: {'✅ PASS' if lambda_success else '❌ FAIL'}")
            print(f"   EventBridge: {'✅ PASS' if eventbridge_success else '❌ FAIL'}")
            
            overall_success = api_success and lambda_success and eventbridge_success
            print(f"\n   Overall: {'✅ ALL TESTS PASSED' if overall_success else '❌ SOME TESTS FAILED'}")
            
            return overall_success
            
        finally:
            # Clean up
            self.cleanup_test_data(reservation_id)
        
        return False


def main():
    """Main function"""
    if len(sys.argv) > 1:
        env_name = sys.argv[1]
    else:
        env_name = "prod"
    
    print(f"QR Code Notification System Test")
    print(f"Environment: {env_name}")
    print()
    
    tester = QRNotificationTester(env_name)
    success = tester.run_full_test()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
