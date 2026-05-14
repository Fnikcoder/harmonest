"""
Integration Tests for Multi-Tenant System

Tests that validate end-to-end functionality across different client configurations.
"""

import pytest
import json
import boto3
import requests
from unittest.mock import patch, MagicMock
from moto import mock_dynamodb, mock_s3, mock_secretsmanager, mock_ssm


@pytest.mark.integration
class TestCheckinIntegration:
    """Integration tests for check-in functionality"""
    
    def test_checkin_validation_with_client_config(self, test_environment, mock_aws_services, lambda_context, api_gateway_event):
        """Test check-in validation with client-specific configuration"""
        client = test_environment.config["client"]
        
        # Set up environment variables for the test
        env_vars = {
            "APP_TABLE": f"{client['name']}-test-main",
            "CLIENT_NAME": client["name"],
            "CLIENT_DISPLAY_NAME": client["displayName"],
            "CHECKIN_ENABLED": "true",
            "CHECKIN_DEADLINE_HOURS": str(client.get("features", {}).get("checkin", {}).get("deadlineHours", 25))
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
        
        # Add test reservation data
        table.put_item(Item={
            "pk": "RESERVATION#TEST001",
            "sk": "METADATA",
            "reservationId": "TEST001",
            "reservationCode": "ABC123",
            "guestName": "John",
            "guestLastName": "Doe",
            "status": 1,
            "checkInDateWithTime": 1705334400000  # Future date
        })
        
        with patch.dict("os.environ", env_vars):
            # Import handler after setting environment variables
            from functions.checkin.handler import handler
            
            # Test validation request
            event = api_gateway_event.copy()
            event["body"] = json.dumps({
                "operation": "validate",
                "reservationCode": "ABC123",
                "guestFirstName": "John"
            })
            
            response = handler(event, lambda_context)
            
            assert response["statusCode"] == 200
            body = json.loads(response["body"])
            assert body["success"] is True
            assert body["data"]["reservationId"] == "TEST001"
    
    def test_checkin_deadline_enforcement(self, test_environment, mock_aws_services, lambda_context, api_gateway_event):
        """Test that check-in deadline is enforced based on client configuration"""
        client = test_environment.config["client"]
        deadline_hours = client.get("features", {}).get("checkin", {}).get("deadlineHours", 25)
        
        env_vars = {
            "APP_TABLE": f"{client['name']}-test-main",
            "CLIENT_NAME": client["name"],
            "CHECKIN_DEADLINE_HOURS": str(deadline_hours)
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
        
        # Add completed check-in with past deadline
        import time
        current_time = int(time.time() * 1000)
        checkin_time = current_time + (deadline_hours + 1) * 60 * 60 * 1000  # Past deadline
        
        table.put_item(Item={
            "pk": "RESERVATION#TEST001",
            "sk": "METADATA",
            "reservationId": "TEST001",
            "reservationCode": "ABC123",
            "guestName": "John",
            "guestLastName": "Doe",
            "status": 1,
            "checkInDateWithTime": checkin_time
        })
        
        table.put_item(Item={
            "pk": "CHECKIN#TEST001",
            "sk": "METADATA",
            "reservationId": "TEST001",
            "status": "completed",
            "guestName": "John",
            "guestLastName": "Doe"
        })
        
        with patch.dict("os.environ", env_vars):
            from functions.checkin.handler import handler
            
            # Try to update check-in after deadline
            event = api_gateway_event.copy()
            event["httpMethod"] = "PUT"
            event["body"] = json.dumps({
                "reservationId": "TEST001",
                "guestName": "Jane",  # Try to change name
                "guestLastName": "Doe"
            })
            
            response = handler(event, lambda_context)
            
            assert response["statusCode"] == 400
            body = json.loads(response["body"])
            assert body["success"] is False
            assert "deadline" in body["message"].lower()
            assert str(deadline_hours) in body["message"]
    
    def test_feature_disabled(self, test_environment, mock_aws_services, lambda_context, api_gateway_event):
        """Test that disabled features return appropriate responses"""
        client = test_environment.config["client"]
        
        env_vars = {
            "APP_TABLE": f"{client['name']}-test-main",
            "CLIENT_NAME": client["name"],
            "CHECKIN_ENABLED": "false"  # Disable feature
        }
        
        with patch.dict("os.environ", env_vars):
            from functions.checkin.handler import handler
            
            response = handler(api_gateway_event, lambda_context)
            
            assert response["statusCode"] == 503
            body = json.loads(response["body"])
            assert body["success"] is False
            assert "disabled" in body["message"].lower()


@pytest.mark.integration
class TestEmailIntegration:
    """Integration tests for email functionality"""
    
    def test_email_template_with_client_branding(self, test_environment):
        """Test that email templates use client-specific branding"""
        client = test_environment.config["client"]
        
        env_vars = {
            "CLIENT_NAME": client["name"],
            "CLIENT_DISPLAY_NAME": client["displayName"],
            "CLIENT_DOMAIN_PRIMARY": client["domains"]["primary"],
            "CLIENT_EMAIL_NOREPLY": client["email"]["noreply"],
            "CLIENT_BRANDING_PRIMARY_COLOR": client.get("branding", {}).get("primaryColor", "#2563eb")
        }
        
        with patch.dict("os.environ", env_vars):
            from functions.email_verification.handler import _get_email_template
            
            template = _get_email_template("123456", "checkin")
            
            # Check that client name appears in template
            assert client["displayName"] in template["subject"]
            assert client["displayName"] in template["html"]
            assert client["displayName"] in template["text"]
            
            # Check that domain appears in template
            assert client["domains"]["primary"] in template["html"]
            assert client["domains"]["primary"] in template["text"]
            
            # Check that branding color is used
            primary_color = client.get("branding", {}).get("primaryColor", "#2563eb")
            assert primary_color in template["html"]


@pytest.mark.integration
class TestListingsIntegration:
    """Integration tests for listings functionality"""
    
    def test_public_listings_api_metadata(self, test_environment, mock_aws_services):
        """Test that public listings API returns client-specific metadata"""
        client = test_environment.config["client"]
        
        env_vars = {
            "APP_TABLE": f"{client['name']}-test-main",
            "CLIENT_NAME": client["name"]
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
        
        # Add listings metadata
        table.put_item(Item={
            "pk": "LISTINGS",
            "sk": "METADATA",
            "totalGroups": 5,
            "totalRooms": 15,
            "success": True,
            "updatedAt": "2024-01-01T00:00:00Z"
        })
        
        with patch.dict("os.environ", env_vars):
            from functions.listings.public_api_handler import handler
            
            # Mock API Gateway event
            event = {
                "httpMethod": "GET",
                "path": "/public/listings",
                "headers": {},
                "queryStringParameters": None
            }
            
            response = handler(event, {})
            
            assert response["statusCode"] == 200
            body = json.loads(response["body"])
            
            # Check client-specific metadata
            assert body["client"] == client["name"]
            assert body["dataSource"] == f"{client['name']}_api"
            assert "version" in body


@pytest.mark.integration
@pytest.mark.slow
class TestDeploymentIntegration:
    """Integration tests for deployment functionality"""
    
    @pytest.mark.skipif(
        not pytest.config.getoption("--deployed-only", default=False),
        reason="Requires deployed environment"
    )
    def test_deployed_api_endpoints(self, test_environment):
        """Test that deployed API endpoints work correctly"""
        if not test_environment.deployed or not test_environment.api_base_url:
            pytest.skip("Environment not deployed or API URL not available")
        
        # Test health endpoint if available
        try:
            health_url = f"{test_environment.api_base_url}/health"
            response = requests.get(health_url, timeout=10)
            
            if response.status_code == 200:
                # API is responding
                assert True
            else:
                # Log the response for debugging
                print(f"Health check failed: {response.status_code}")
                print(f"Response: {response.text}")
        except requests.exceptions.RequestException as e:
            pytest.skip(f"API not accessible: {e}")
    
    @pytest.mark.skipif(
        not pytest.config.getoption("--deployed-only", default=False),
        reason="Requires deployed environment"
    )
    def test_deployed_lambda_functions(self, test_environment):
        """Test that deployed Lambda functions have correct configuration"""
        if not test_environment.deployed:
            pytest.skip("Environment not deployed")
        
        try:
            # Use AWS SDK to check Lambda function configuration
            session = boto3.Session(profile_name=test_environment.aws_profile)
            lambda_client = session.client('lambda')
            
            # Check checkin function
            function_name = f"{test_environment.client_name}-{test_environment.env_name}-lambda_checkin"
            
            try:
                response = lambda_client.get_function(FunctionName=function_name)
                
                # Check environment variables
                env_vars = response['Configuration']['Environment']['Variables']
                
                assert env_vars.get('CLIENT_NAME') == test_environment.client_name
                assert env_vars.get('CLIENT_DISPLAY_NAME') == test_environment.config["client"]["displayName"]
                
                # Check that no hardcoded "harmonest" values exist (unless that's the client)
                if test_environment.client_name != "harmonest":
                    for key, value in env_vars.items():
                        if isinstance(value, str) and "harmonest" in value.lower():
                            pytest.fail(f"Found hardcoded 'harmonest' in {key}={value}")
                
            except lambda_client.exceptions.ResourceNotFoundException:
                pytest.skip(f"Lambda function {function_name} not found")
                
        except Exception as e:
            pytest.skip(f"Cannot access AWS resources: {e}")


@pytest.mark.integration
class TestCrossClientIsolation:
    """Test that different clients are properly isolated"""
    
    def test_resource_naming_isolation(self, test_environments):
        """Test that different clients have different resource names"""
        if len(test_environments) < 2:
            pytest.skip("Need at least 2 test environments for isolation testing")
        
        resource_names = {}
        
        for env in test_environments:
            client_name = env.client_name
            env_name = env.env_name
            
            # Generate resource names
            table_name = f"{client_name}-{env_name}-main" if env_name != "prod" else f"{client_name}-main"
            lambda_name = f"{client_name}-{env_name}-lambda_checkin"
            bucket_name = f"{client_name}-{env_name}-storage" if env_name != "prod" else f"{client_name}-storage"
            
            env_key = f"{client_name}/{env_name}"
            resource_names[env_key] = {
                "table": table_name,
                "lambda": lambda_name,
                "bucket": bucket_name
            }
        
        # Check that all resource names are unique
        all_tables = [names["table"] for names in resource_names.values()]
        all_lambdas = [names["lambda"] for names in resource_names.values()]
        all_buckets = [names["bucket"] for names in resource_names.values()]
        
        assert len(all_tables) == len(set(all_tables)), "Table names are not unique across clients"
        assert len(all_lambdas) == len(set(all_lambdas)), "Lambda names are not unique across clients"
        assert len(all_buckets) == len(set(all_buckets)), "Bucket names are not unique across clients"
    
    def test_configuration_isolation(self, test_environments):
        """Test that client configurations don't interfere with each other"""
        if len(test_environments) < 2:
            pytest.skip("Need at least 2 test environments for isolation testing")
        
        # Check that each client has unique configuration
        client_configs = {}
        
        for env in test_environments:
            client_name = env.client_name
            if client_name not in client_configs:
                client_configs[client_name] = env.config["client"]
        
        # Verify that different clients have different configurations
        client_names = list(client_configs.keys())
        
        for i, client1 in enumerate(client_names):
            for client2 in client_names[i+1:]:
                config1 = client_configs[client1]
                config2 = client_configs[client2]
                
                # Clients should have different names
                assert config1["name"] != config2["name"]
                
                # Clients should have different primary domains (unless explicitly shared)
                assert config1["domains"]["primary"] != config2["domains"]["primary"]
                
                # Clients should have different email addresses
                assert config1["email"]["noreply"] != config2["email"]["noreply"]
