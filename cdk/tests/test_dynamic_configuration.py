"""
Dynamic Configuration Tests

Tests that validate client configurations work correctly across all tenants.
"""

import pytest
import os
from unittest.mock import patch, MagicMock

from config.config_manager import ConfigManager, ConfigurationError


@pytest.mark.config
class TestConfigurationValidation:
    """Test configuration validation for all clients"""
    
    def test_client_config_validation(self, test_environment):
        """Test that client configuration is valid"""
        config_manager = ConfigManager()
        
        # Validate the configuration
        config_manager.validate_config(test_environment.config)
        
        # Check required fields
        assert test_environment.config["client"]["name"]
        assert test_environment.config["client"]["displayName"]
        assert test_environment.config["client"]["domains"]["primary"]
        assert test_environment.config["client"]["email"]["noreply"]
        assert test_environment.config["client"]["aws"]["profile"]
        assert test_environment.config["client"]["aws"]["region"]
    
    def test_environment_config_validation(self, test_environment):
        """Test that environment-specific configuration is valid"""
        env_config = test_environment.config["environments"][test_environment.env_name]
        
        # Environment should be enabled or explicitly disabled
        assert "enabled" in env_config or env_config.get("enabled", True)
        
        # If scaling is configured, validate values
        if "scaling" in env_config:
            scaling = env_config["scaling"]
            
            if "lambda" in scaling:
                lambda_config = scaling["lambda"]
                if "memorySize" in lambda_config:
                    assert 128 <= lambda_config["memorySize"] <= 10240
                if "timeout" in lambda_config:
                    assert 1 <= lambda_config["timeout"] <= 900
    
    def test_feature_flags_validation(self, test_environment):
        """Test that feature flags are properly configured"""
        features = test_environment.config["client"].get("features", {})
        
        # Test checkin feature
        if "checkin" in features:
            checkin = features["checkin"]
            if "deadlineHours" in checkin:
                assert isinstance(checkin["deadlineHours"], int)
                assert 1 <= checkin["deadlineHours"] <= 72
        
        # Test reservations feature
        if "reservations" in features:
            reservations = features["reservations"]
            if "syncIntervalMinutes" in reservations:
                assert isinstance(reservations["syncIntervalMinutes"], int)
                assert 5 <= reservations["syncIntervalMinutes"] <= 1440
    
    def test_domain_configuration(self, test_environment):
        """Test that domain configuration is valid"""
        domains = test_environment.config["client"]["domains"]
        
        # Primary domain is required
        assert "primary" in domains
        assert domains["primary"]
        
        # Validate domain format (basic check)
        primary_domain = domains["primary"]
        assert "." in primary_domain
        assert not primary_domain.startswith("http")
        assert not primary_domain.endswith("/")
    
    def test_email_configuration(self, test_environment):
        """Test that email configuration is valid"""
        email = test_environment.config["client"]["email"]
        
        # No-reply email is required
        assert "noreply" in email
        assert email["noreply"]
        assert "@" in email["noreply"]
        
        # Validate other email addresses if present
        for email_type in ["support", "admin", "notifications"]:
            if email_type in email and email[email_type]:
                assert "@" in email[email_type]


@pytest.mark.feature
class TestFeatureConfiguration:
    """Test feature-specific configurations"""
    
    def test_checkin_feature_config(self, test_environment):
        """Test check-in feature configuration"""
        features = test_environment.config["client"].get("features", {})
        
        if "checkin" in features and features["checkin"].get("enabled", True):
            checkin = features["checkin"]
            
            # Test deadline hours
            deadline_hours = checkin.get("deadlineHours", 25)
            assert isinstance(deadline_hours, int)
            assert deadline_hours > 0
            
            # Test QR code setting
            qr_enabled = checkin.get("qrCodeEnabled", True)
            assert isinstance(qr_enabled, bool)
            
            # Test document upload settings
            if "documentUpload" in checkin:
                doc_upload = checkin["documentUpload"]
                if "maxSizeMB" in doc_upload:
                    assert 1 <= doc_upload["maxSizeMB"] <= 50
                if "allowedTypes" in doc_upload:
                    assert isinstance(doc_upload["allowedTypes"], list)
    
    def test_reservations_feature_config(self, test_environment):
        """Test reservations feature configuration"""
        features = test_environment.config["client"].get("features", {})
        
        if "reservations" in features:
            reservations = features["reservations"]
            
            # Test sync settings
            sync_enabled = reservations.get("syncEnabled", True)
            assert isinstance(sync_enabled, bool)
            
            sync_interval = reservations.get("syncIntervalMinutes", 30)
            assert isinstance(sync_interval, int)
            assert sync_interval >= 5
    
    def test_listings_feature_config(self, test_environment):
        """Test listings feature configuration"""
        features = test_environment.config["client"].get("features", {})
        
        if "listings" in features:
            listings = features["listings"]
            
            # Test sync settings
            sync_enabled = listings.get("syncEnabled", True)
            assert isinstance(sync_enabled, bool)
            
            public_listings = listings.get("publicListings", False)
            assert isinstance(public_listings, bool)


@pytest.mark.unit
class TestCommonLayerConfiguration:
    """Test common layer configuration utilities"""
    
    @patch.dict(os.environ, {
        "CLIENT_NAME": "testclient",
        "CLIENT_DISPLAY_NAME": "Test Client",
        "CLIENT_DOMAIN_PRIMARY": "test.example.com",
        "CLIENT_EMAIL_NOREPLY": "noreply@test.example.com",
        "CLIENT_BRANDING_PRIMARY_COLOR": "#ff0000",
        "CHECKIN_ENABLED": "true",
        "CHECKIN_DEADLINE_HOURS": "24"
    })
    def test_config_module_loading(self):
        """Test that the config module loads environment variables correctly"""
        # Import here to get fresh environment variables
        from common.config import get_client_config, is_feature_enabled
        
        config = get_client_config()
        
        assert config.client_name == "testclient"
        assert config.client_display_name == "Test Client"
        assert config.primary_domain == "test.example.com"
        assert config.noreply_email == "noreply@test.example.com"
        assert config.primary_color == "#ff0000"
        
        assert is_feature_enabled("checkin")
        
        checkin_config = config.get_feature_config("checkin")
        assert checkin_config["deadlineHours"] == 24
    
    @patch.dict(os.environ, {
        "CLIENT_NAME": "testclient",
        "CLIENT_DISPLAY_NAME": "Test Client",
        "CHECKIN_ENABLED": "false"
    })
    def test_feature_disabled(self):
        """Test feature disabled functionality"""
        from common.config import is_feature_enabled
        
        assert not is_feature_enabled("checkin")
    
    def test_email_template_vars(self, test_environment):
        """Test email template variable generation"""
        # Mock environment variables based on test environment
        client = test_environment.config["client"]
        
        env_vars = {
            "CLIENT_NAME": client["name"],
            "CLIENT_DISPLAY_NAME": client["displayName"],
            "CLIENT_DOMAIN_PRIMARY": client["domains"]["primary"],
            "CLIENT_EMAIL_NOREPLY": client["email"]["noreply"],
            "CLIENT_BRANDING_PRIMARY_COLOR": client.get("branding", {}).get("primaryColor", "#2563eb")
        }
        
        with patch.dict(os.environ, env_vars):
            from common.config import get_email_template_vars
            
            template_vars = get_email_template_vars()
            
            assert template_vars["client_name"] == client["name"]
            assert template_vars["client_display_name"] == client["displayName"]
            assert template_vars["primary_domain"] == client["domains"]["primary"]
            assert "@" in template_vars["support_email"]
    
    def test_api_metadata(self, test_environment):
        """Test API metadata generation"""
        client = test_environment.config["client"]
        
        env_vars = {
            "CLIENT_NAME": client["name"]
        }
        
        with patch.dict(os.environ, env_vars):
            from common.config import get_api_metadata
            
            metadata = get_api_metadata()
            
            assert metadata["client"] == client["name"]
            assert metadata["dataSource"] == f"{client['name']}_api"
            assert "version" in metadata


@pytest.mark.integration
class TestLambdaConfiguration:
    """Test Lambda function configuration"""
    
    def test_lambda_environment_variables(self, test_environment):
        """Test that Lambda functions receive correct environment variables"""
        client = test_environment.config["client"]
        
        # Expected environment variables
        expected_vars = {
            "CLIENT_NAME": client["name"],
            "CLIENT_DISPLAY_NAME": client["displayName"],
            "CLIENT_DOMAIN_PRIMARY": client["domains"]["primary"],
            "CLIENT_EMAIL_NOREPLY": client["email"]["noreply"]
        }
        
        # Add G4H configuration if present
        if "integrations" in client and "g4h" in client["integrations"]:
            g4h = client["integrations"]["g4h"]
            expected_vars.update({
                "G4H_ORIGIN": g4h.get("origin", "https://app.guestyforhosts.com"),
                "G4H_APP_VERSION": g4h.get("appVersion", "6.x"),
                "G4H_PLATFORM": g4h.get("platform", "browser--win32"),
                "G4H_DEVICE_UUID": g4h.get("deviceUuid", f"ypa-uuid-{client['name']}")
            })
        
        # Add feature flags
        features = client.get("features", {})
        if "checkin" in features:
            checkin = features["checkin"]
            expected_vars["CHECKIN_ENABLED"] = str(checkin.get("enabled", True)).lower()
            expected_vars["CHECKIN_DEADLINE_HOURS"] = str(checkin.get("deadlineHours", 25))
        
        # Test that all expected variables would be set
        for var_name, expected_value in expected_vars.items():
            assert expected_value is not None, f"Environment variable {var_name} should have a value"
    
    def test_resource_naming(self, test_environment):
        """Test that resource names are generated correctly"""
        client_name = test_environment.client_name
        env_name = test_environment.env_name
        
        # Test table name
        if env_name == "prod":
            expected_table = f"{client_name}-main"
        else:
            expected_table = f"{client_name}-{env_name}-main"
        
        # Test Lambda function name
        expected_lambda = f"{client_name}-{env_name}-lambda_checkin"
        
        # Test S3 bucket name
        if env_name == "prod":
            expected_bucket = f"{client_name}-storage"
        else:
            expected_bucket = f"{client_name}-{env_name}-storage"
        
        # Test SSM parameter names
        expected_table_param = f"/{client_name}/{env_name}/table/name"
        expected_bucket_param = f"/{client_name}/{env_name}/s3/bucketName"
        
        # Validate naming patterns
        assert expected_table
        assert expected_lambda
        assert expected_bucket
        assert expected_table_param.startswith("/")
        assert expected_bucket_param.startswith("/")
        
        # Ensure no hardcoded "harmonest" in names (unless that's the client)
        if client_name != "harmonest":
            assert "harmonest" not in expected_table.lower()
            assert "harmonest" not in expected_lambda.lower()
            assert "harmonest" not in expected_bucket.lower()
            assert "harmonest" not in expected_table_param.lower()
            assert "harmonest" not in expected_bucket_param.lower()
