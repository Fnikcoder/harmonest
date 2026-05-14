"""
Unit tests for Check-in Lambda handler
"""
import json
import pytest
import os
from unittest.mock import patch, MagicMock
import sys

# Add the functions and layer directories to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../functions/checkin'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../layer-src/python'))

from handler import handler, validate_reservation, submit_checkin, get_status


class TestCheckinHandler:
    """Test cases for check-in Lambda handler"""
    
    def setup_method(self):
        """Setup test environment"""
        # Set environment variables
        os.environ["APP_TABLE"] = "harmonest-test-main"
        os.environ["STORAGE_BUCKET"] = "harmonest-test-storage"
        os.environ["G4H_CRED_SECRET"] = "arn:aws:secretsmanager:eu-central-1:123456789012:secret:test-creds"
        os.environ["G4H_SESSION_SECRET"] = "arn:aws:secretsmanager:eu-central-1:123456789012:secret:test-session"
    
    @pytest.mark.unit
    def test_handler_cors_preflight(self, lambda_context):
        """Test CORS preflight handling"""
        event = {
            "httpMethod": "OPTIONS",
            "path": "/checkin"
        }
        
        response = handler(event, lambda_context)
        
        assert response["statusCode"] == 200
        assert "Access-Control-Allow-Origin" in response["headers"]
        assert response["body"] == ""
    
    @pytest.mark.unit
    def test_handler_validate_operation(self, lambda_context, mock_dynamodb_table, mock_g4h_api):
        """Test validate operation routing"""
        event = {
            "httpMethod": "POST",
            "path": "/checkin",
            "body": json.dumps({
                "operation": "validate",
                "reservationCode": "TEST123456",
                "firstName": "Test"
            })
        }
        
        with patch('common.ddb.TABLE', mock_dynamodb_table):
            response = handler(event, lambda_context)
        
        assert response["statusCode"] in [200, 404]  # Depends on mock data
        body = json.loads(response["body"])
        assert "success" in body
        assert "message" in body
    
    @pytest.mark.unit
    def test_handler_submit_operation(self, lambda_context, mock_dynamodb_table, mock_s3_bucket, mock_g4h_api):
        """Test submit operation routing"""
        event = {
            "httpMethod": "POST",
            "path": "/checkin",
            "body": json.dumps({
                "operation": "submit",
                "reservationCode": "TEST123456",
                "firstName": "Test",
                "lastName": "User",
                "email": "test@example.com",
                "phone": "+49123456789",
                "idCardFile": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
            })
        }
        
        with patch('common.ddb.TABLE', mock_dynamodb_table), \
             patch('boto3.client') as mock_boto3:
            
            # Mock S3 client
            mock_s3 = MagicMock()
            mock_boto3.return_value = mock_s3
            
            response = handler(event, lambda_context)
        
        assert response["statusCode"] in [200, 400, 404]
        body = json.loads(response["body"])
        assert "success" in body
        assert "message" in body
    
    @pytest.mark.unit
    def test_handler_get_status(self, lambda_context, mock_dynamodb_table):
        """Test GET status operation"""
        event = {
            "httpMethod": "GET",
            "path": "/checkin",
            "queryStringParameters": {
                "reservationCode": "TEST123456"
            }
        }
        
        with patch('common.ddb.TABLE', mock_dynamodb_table):
            response = handler(event, lambda_context)
        
        assert response["statusCode"] in [200, 404]
        body = json.loads(response["body"])
        assert "success" in body
        assert "message" in body
    
    @pytest.mark.unit
    def test_handler_invalid_operation(self, lambda_context):
        """Test invalid operation handling"""
        event = {
            "httpMethod": "POST",
            "path": "/checkin",
            "body": json.dumps({
                "operation": "invalid-operation"
            })
        }
        
        response = handler(event, lambda_context)
        
        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert body["success"] is False
        assert "operation" in body["message"].lower()
    
    @pytest.mark.unit
    def test_handler_method_not_allowed(self, lambda_context):
        """Test unsupported HTTP method"""
        event = {
            "httpMethod": "PUT",
            "path": "/checkin"
        }
        
        response = handler(event, lambda_context)
        
        assert response["statusCode"] == 405
        body = json.loads(response["body"])
        assert body["success"] is False
        assert "method" in body["message"].lower()
    
    @pytest.mark.unit
    def test_validate_reservation_missing_fields(self, lambda_context):
        """Test validation with missing required fields"""
        event = {
            "httpMethod": "POST",
            "body": json.dumps({
                "operation": "validate"
                # Missing reservationCode and firstName
            })
        }
        
        response = validate_reservation(event)
        
        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert body["success"] is False
        assert "required" in body["message"].lower()
        assert body.get("errorCode") == "MISSING_REQUIRED_FIELDS"
    
    @pytest.mark.unit
    def test_validate_reservation_invalid_code(self, lambda_context, mock_dynamodb_table):
        """Test validation with non-existent reservation code"""
        event = {
            "httpMethod": "POST",
            "body": json.dumps({
                "operation": "validate",
                "reservationCode": "NONEXISTENT",
                "firstName": "Test"
            })
        }
        
        with patch('common.ddb.TABLE', mock_dynamodb_table):
            response = validate_reservation(event)
        
        assert response["statusCode"] == 404
        body = json.loads(response["body"])
        assert body["success"] is False
        assert body.get("errorCode") == "RESERVATION_NOT_FOUND"
    
    @pytest.mark.unit
    def test_submit_checkin_missing_fields(self, lambda_context):
        """Test submit with missing required fields"""
        event = {
            "httpMethod": "POST",
            "body": json.dumps({
                "operation": "submit",
                "reservationCode": "TEST123456"
                # Missing other required fields
            })
        }
        
        response = submit_checkin(event)
        
        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert body["success"] is False
        assert "required" in body["message"].lower()
    
    @pytest.mark.unit
    def test_submit_checkin_invalid_email(self, lambda_context):
        """Test submit with invalid email format"""
        event = {
            "httpMethod": "POST",
            "body": json.dumps({
                "operation": "submit",
                "reservationCode": "TEST123456",
                "firstName": "Test",
                "lastName": "User",
                "email": "invalid-email",
                "phone": "+49123456789",
                "idCardFile": "test-file-data"
            })
        }
        
        response = submit_checkin(event)
        
        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert body["success"] is False
        assert "email" in body["message"].lower()
    
    @pytest.mark.unit
    def test_get_status_missing_reservation_code(self, lambda_context):
        """Test status check without reservation code"""
        event = {
            "httpMethod": "GET",
            "queryStringParameters": None
        }
        
        response = get_status(event)
        
        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert body["success"] is False
        assert "reservation" in body["message"].lower()
    
    @pytest.mark.unit
    def test_response_structure(self, lambda_context):
        """Test that all responses have correct structure"""
        event = {
            "httpMethod": "POST",
            "body": json.dumps({
                "operation": "validate"
                # Missing fields to trigger error
            })
        }
        
        response = validate_reservation(event)
        body = json.loads(response["body"])
        
        # Check required fields
        assert "success" in body
        assert "message" in body
        assert isinstance(body["success"], bool)
        assert isinstance(body["message"], str)
        
        # Check CORS headers
        assert "Access-Control-Allow-Origin" in response["headers"]
        assert response["headers"]["Content-Type"] == "application/json"
    
    @pytest.mark.unit
    def test_error_handling(self, lambda_context):
        """Test error handling for malformed JSON"""
        event = {
            "httpMethod": "POST",
            "body": "invalid-json"
        }
        
        response = handler(event, lambda_context)
        
        assert response["statusCode"] == 500
        body = json.loads(response["body"])
        assert body["success"] is False
        assert "error" in body["message"].lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
