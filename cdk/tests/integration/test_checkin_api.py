"""
Integration tests for Check-in API
"""
import json
import pytest
import requests
import time
import base64
from typing import Dict, Any


class TestCheckinAPI:
    """Integration tests for the check-in API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test environment"""
        # Use your actual API endpoint or mock
        self.base_url = "https://179a2g0pgk.execute-api.eu-central-1.amazonaws.com/prod"
        self.test_email = "test@harmonest.de"
        self.test_reservation_code = "TEST123456"
        
        # Headers for API requests
        self.headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    
    def create_test_image_file(self) -> str:
        """Create a small test image file as base64"""
        # Create a minimal PNG file (1x1 pixel)
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\nIDATx\x9cc\xf8\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82'
        return base64.b64encode(png_data).decode('utf-8')
    
    def test_cors_preflight(self):
        """Test CORS preflight request"""
        response = requests.options(
            f"{self.base_url}/checkin",
            headers={
                "Origin": "https://harmonest.de",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type"
            }
        )
        
        assert response.status_code == 200
        assert "Access-Control-Allow-Origin" in response.headers
        assert "Access-Control-Allow-Methods" in response.headers
    
    def test_validate_reservation_missing_fields(self):
        """Test validation with missing required fields"""
        payload = {
            "operation": "validate"
            # Missing reservationCode and firstName
        }
        
        response = requests.post(
            f"{self.base_url}/checkin",
            json=payload,
            headers=self.headers
        )
        
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert "required" in data["message"].lower()
        assert data.get("errorCode") == "MISSING_REQUIRED_FIELDS"
    
    def test_validate_reservation_invalid_code(self):
        """Test validation with invalid reservation code"""
        payload = {
            "operation": "validate",
            "reservationCode": "INVALID123",
            "firstName": "Test"
        }
        
        response = requests.post(
            f"{self.base_url}/checkin",
            json=payload,
            headers=self.headers
        )
        
        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data.get("errorCode") == "RESERVATION_NOT_FOUND"
    
    def test_submit_checkin_missing_fields(self):
        """Test check-in submission with missing fields"""
        payload = {
            "operation": "submit",
            "reservationCode": self.test_reservation_code,
            "firstName": "Test",
            # Missing other required fields
        }
        
        response = requests.post(
            f"{self.base_url}/checkin",
            json=payload,
            headers=self.headers
        )
        
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert "required" in data["message"].lower()
    
    def test_submit_checkin_invalid_email(self):
        """Test check-in submission with invalid email"""
        payload = {
            "operation": "submit",
            "reservationCode": self.test_reservation_code,
            "firstName": "Test",
            "lastName": "User",
            "email": "invalid-email",
            "phone": "+49123456789",
            "idCardFile": self.create_test_image_file()
        }
        
        response = requests.post(
            f"{self.base_url}/checkin",
            json=payload,
            headers=self.headers
        )
        
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert "email" in data["message"].lower()
    
    def test_submit_checkin_invalid_phone(self):
        """Test check-in submission with invalid phone"""
        payload = {
            "operation": "submit",
            "reservationCode": self.test_reservation_code,
            "firstName": "Test",
            "lastName": "User",
            "email": self.test_email,
            "phone": "invalid-phone",
            "idCardFile": self.create_test_image_file()
        }
        
        response = requests.post(
            f"{self.base_url}/checkin",
            json=payload,
            headers=self.headers
        )
        
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert "phone" in data["message"].lower()
    
    def test_submit_checkin_invalid_file(self):
        """Test check-in submission with invalid file"""
        payload = {
            "operation": "submit",
            "reservationCode": self.test_reservation_code,
            "firstName": "Test",
            "lastName": "User",
            "email": self.test_email,
            "phone": "+49123456789",
            "idCardFile": "invalid-base64-data"
        }
        
        response = requests.post(
            f"{self.base_url}/checkin",
            json=payload,
            headers=self.headers
        )
        
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert "file" in data["message"].lower()
    
    def test_get_status_missing_reservation_code(self):
        """Test status check without reservation code"""
        response = requests.get(
            f"{self.base_url}/checkin",
            headers=self.headers
        )
        
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert "reservation" in data["message"].lower()
    
    def test_get_status_invalid_reservation_code(self):
        """Test status check with invalid reservation code"""
        response = requests.get(
            f"{self.base_url}/checkin?reservationCode=INVALID123",
            headers=self.headers
        )
        
        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False
        assert data.get("errorCode") == "CHECKIN_NOT_FOUND"
    
    def test_invalid_operation(self):
        """Test invalid operation"""
        payload = {
            "operation": "invalid-operation",
            "reservationCode": self.test_reservation_code
        }
        
        response = requests.post(
            f"{self.base_url}/checkin",
            json=payload,
            headers=self.headers
        )
        
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
        assert "operation" in data["message"].lower()
    
    def test_method_not_allowed(self):
        """Test unsupported HTTP method"""
        response = requests.put(
            f"{self.base_url}/checkin",
            json={"test": "data"},
            headers=self.headers
        )
        
        assert response.status_code == 405
        data = response.json()
        assert data["success"] is False
        assert "method" in data["message"].lower()
    
    def test_api_response_structure(self):
        """Test that API responses have correct structure"""
        payload = {
            "operation": "validate"
            # Missing fields to trigger error
        }
        
        response = requests.post(
            f"{self.base_url}/checkin",
            json=payload,
            headers=self.headers
        )
        
        data = response.json()
        
        # Check required fields
        assert "success" in data
        assert "message" in data
        assert isinstance(data["success"], bool)
        assert isinstance(data["message"], str)
        
        # Check optional fields
        if "data" in data:
            assert isinstance(data["data"], (dict, list))
        
        if "errorCode" in data:
            assert isinstance(data["errorCode"], str)
    
    @pytest.mark.slow
    def test_api_performance(self):
        """Test API response time"""
        payload = {
            "operation": "validate"
        }
        
        start_time = time.time()
        response = requests.post(
            f"{self.base_url}/checkin",
            json=payload,
            headers=self.headers,
            timeout=10
        )
        end_time = time.time()
        
        # API should respond within 5 seconds
        assert (end_time - start_time) < 5.0
        assert response.status_code in [200, 400, 404, 500]  # Valid HTTP status


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
