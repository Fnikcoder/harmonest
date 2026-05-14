"""
Pytest configuration and shared fixtures for dynamic multi-tenant testing
"""
import pytest
import os
import sys
import boto3
from pathlib import Path
from moto import mock_dynamodb, mock_s3, mock_secretsmanager, mock_ssm
from unittest.mock import patch

# Add project root and config to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "config"))

from tests.framework.dynamic_test_framework import DynamicTestFramework, TestEnvironment


# Dynamic testing framework fixtures
@pytest.fixture(scope="session")
def test_framework():
    """Create a test framework instance for the session"""
    return DynamicTestFramework()


@pytest.fixture(scope="session")
def test_environments(test_framework):
    """Discover all test environments"""
    return test_framework.discover_test_environments()


@pytest.fixture(params=[], scope="session")
def test_environment(request):
    """Parametrized fixture for individual test environments"""
    return request.param


@pytest.fixture(scope="session")
def aws_credentials():
    """Mock AWS Credentials for moto"""
    os.environ["AWS_ACCESS_KEY_ID"] = "testing"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
    os.environ["AWS_SECURITY_TOKEN"] = "testing"
    os.environ["AWS_SESSION_TOKEN"] = "testing"
    os.environ["AWS_DEFAULT_REGION"] = "eu-central-1"


@pytest.fixture(scope="function")
def mock_aws_services(aws_credentials):
    """Mock AWS services for testing"""
    with mock_dynamodb(), mock_s3(), mock_secretsmanager(), mock_ssm():
        yield


@pytest.fixture
def mock_dynamodb_table(mock_aws_services):
    """Create a mock DynamoDB table for testing"""
    dynamodb = boto3.resource("dynamodb", region_name="eu-central-1")
    
    # Create table
    table = dynamodb.create_table(
        TableName="harmonest-test-main",
        KeySchema=[
            {"AttributeName": "PK", "KeyType": "HASH"},
            {"AttributeName": "SK", "KeyType": "RANGE"}
        ],
        AttributeDefinitions=[
            {"AttributeName": "PK", "AttributeType": "S"},
            {"AttributeName": "SK", "AttributeType": "S"},
            {"AttributeName": "reservationCode", "AttributeType": "S"}
        ],
        BillingMode="PAY_PER_REQUEST",
        GlobalSecondaryIndexes=[
            {
                "IndexName": "ReservationCodeIndex",
                "KeySchema": [
                    {"AttributeName": "reservationCode", "KeyType": "HASH"}
                ],
                "Projection": {"ProjectionType": "ALL"}
            }
        ]
    )
    
    # Add test data
    table.put_item(Item={
        "PK": "RESERVATION#test-reservation-id",
        "SK": "META",
        "reservationCode": "TEST123456",
        "guestFirstName": "Test",
        "guestLastName": "User",
        "checkInDate": "2024-12-01",
        "checkOutDate": "2024-12-05",
        "status": 1,
        "propertyId": "test-property-id"
    })
    
    return table


@pytest.fixture
def mock_s3_bucket(mock_aws_services):
    """Create a mock S3 bucket for testing"""
    s3 = boto3.client("s3", region_name="eu-central-1")
    bucket_name = "harmonest-test-storage"
    
    s3.create_bucket(
        Bucket=bucket_name,
        CreateBucketConfiguration={"LocationConstraint": "eu-central-1"}
    )
    
    return bucket_name


@pytest.fixture
def mock_secrets(mock_aws_services):
    """Create mock secrets for testing"""
    secrets_client = boto3.client("secretsmanager", region_name="eu-central-1")
    
    # Create G4H credentials secret
    creds_secret = secrets_client.create_secret(
        Name="harmonest/test/guestyforhosts/creds",
        SecretString='{"email": "test@example.com", "password": "testpass"}'
    )
    
    # Create G4H session secret
    session_secret = secrets_client.create_secret(
        Name="harmonest/test/guestyforhosts/webSession",
        SecretString='{"cookies": {}, "utoken": "test-token", "stoken": "test-session", "exp": 9999999999}'
    )
    
    return {
        "creds_arn": creds_secret["ARN"],
        "session_arn": session_secret["ARN"]
    }


@pytest.fixture
def mock_ssm_parameters(mock_aws_services):
    """Create mock SSM parameters for testing"""
    ssm_client = boto3.client("ssm", region_name="eu-central-1")
    
    parameters = {
        "/harmonest/test/table/name": "harmonest-test-main",
        "/harmonest/test/layers/commonArn": "arn:aws:lambda:eu-central-1:123456789012:layer:harmonest-test-common:1",
        "/harmonest/test/s3/bucketName": "harmonest-test-storage",
        "/harmonest/test/s3/bucketArn": "arn:aws:s3:::harmonest-test-storage",
        "/harmonest/test/api/id": "test-api-id",
        "/harmonest/test/api/checkinResourceId": "test-resource-id"
    }
    
    for name, value in parameters.items():
        ssm_client.put_parameter(
            Name=name,
            Value=value,
            Type="String"
        )
    
    return parameters


@pytest.fixture
def lambda_context():
    """Mock Lambda context for testing"""
    class MockContext:
        def __init__(self):
            self.function_name = "test-function"
            self.function_version = "$LATEST"
            self.invoked_function_arn = "arn:aws:lambda:eu-central-1:123456789012:function:test-function"
            self.memory_limit_in_mb = 128
            self.remaining_time_in_millis = lambda: 30000
            self.aws_request_id = "test-request-id"
            self.log_group_name = "/aws/lambda/test-function"
            self.log_stream_name = "test-stream"
    
    return MockContext()


@pytest.fixture
def api_gateway_event():
    """Mock API Gateway event for testing"""
    return {
        "httpMethod": "POST",
        "path": "/checkin",
        "headers": {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        "queryStringParameters": None,
        "pathParameters": None,
        "body": '{"operation": "validate", "reservationCode": "TEST123456", "firstName": "Test"}',
        "requestContext": {
            "requestId": "test-request-id",
            "stage": "test",
            "httpMethod": "POST",
            "path": "/checkin"
        }
    }


@pytest.fixture
def mock_g4h_api():
    """Mock Guesty for Hosts API responses"""
    with patch('requests.Session.post') as mock_post, \
         patch('requests.Session.get') as mock_get:
        
        # Mock login response
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {
            "success": True,
            "userToken": "test-user-token",
            "sessionToken": "test-session-token"
        }
        
        # Mock reservation detail response
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            "success": True,
            "data": {
                "reservation": {
                    "_id": "test-reservation-id",
                    "confirmationCode": "TEST123456",
                    "guest": {
                        "firstName": "Test",
                        "lastName": "User"
                    },
                    "checkInDateWithTime": "2024-12-01T15:00:00.000Z",
                    "checkOutDateWithTime": "2024-12-05T11:00:00.000Z",
                    "status": "confirmed"
                }
            }
        }
        
        yield {
            "post": mock_post,
            "get": mock_get
        }


def pytest_generate_tests(metafunc):
    """Generate tests for each environment dynamically"""
    if "test_environment" in metafunc.fixturenames:
        framework = DynamicTestFramework()
        environments = framework.discover_test_environments()

        # Filter environments based on pytest markers or command line options
        client_filter = metafunc.config.getoption("--client", default=None)
        env_filter = metafunc.config.getoption("--env", default=None)
        deployed_only = metafunc.config.getoption("--deployed-only", default=False)

        if client_filter:
            environments = [env for env in environments if env.client_name == client_filter]

        if env_filter:
            environments = [env for env in environments if env.env_name == env_filter]

        if deployed_only:
            # Check deployment status for filtering
            for env in environments:
                framework.check_deployment_status(env)
            environments = [env for env in environments if env.deployed]

        # Create test IDs for better test output
        test_ids = [f"{env.client_name}-{env.env_name}" for env in environments]

        metafunc.parametrize("test_environment", environments, ids=test_ids)


def pytest_addoption(parser):
    """Add custom command line options"""
    parser.addoption(
        "--client",
        action="store",
        default=None,
        help="Run tests for specific client only"
    )
    parser.addoption(
        "--env",
        action="store",
        default=None,
        help="Run tests for specific environment only"
    )
    parser.addoption(
        "--deployed-only",
        action="store_true",
        default=False,
        help="Run tests only for deployed environments"
    )


# Pytest markers
def pytest_configure(config):
    """Configure pytest markers"""
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests"
    )
    config.addinivalue_line(
        "markers", "unit: marks tests as unit tests"
    )
    config.addinivalue_line(
        "markers", "config: Configuration validation tests"
    )
    config.addinivalue_line(
        "markers", "feature: Feature-specific tests"
    )
    config.addinivalue_line(
        "markers", "api: API endpoint tests"
    )
    config.addinivalue_line(
        "markers", "lambda: Lambda function tests"
    )
    config.addinivalue_line(
        "markers", "database: Database tests"
    )
    config.addinivalue_line(
        "markers", "e2e: End-to-end tests"
    )
