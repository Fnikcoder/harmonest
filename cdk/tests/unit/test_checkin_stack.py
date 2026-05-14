"""
Unit tests for CheckinStack
"""
import aws_cdk as core
import aws_cdk.assertions as assertions
import pytest
from unittest.mock import patch, MagicMock
from cdk.checkin_stack import CheckinStack


class TestCheckinStack:
    """Test cases for CheckinStack"""
    
    def setup_method(self):
        """Setup test environment"""
        self.app = core.App()
        self.env_name = "test"
        
        # Mock SSM parameter lookups
        with patch('aws_cdk.aws_ssm.StringParameter.value_for_string_parameter') as mock_ssm:
            mock_ssm.side_effect = self._mock_ssm_lookup
            
            self.stack = CheckinStack(
                self.app, 
                f"TestCheckinStack-{self.env_name}", 
                env_name=self.env_name
            )
        
        self.template = assertions.Template.from_stack(self.stack)
    
    def _mock_ssm_lookup(self, scope, parameter_name):
        """Mock SSM parameter lookups"""
        if "table/name" in parameter_name:
            return f"harmonest-{self.env_name}-main"
        elif "layers/commonArn" in parameter_name:
            return f"arn:aws:lambda:eu-central-1:123456789012:layer:harmonest-{self.env_name}-common:1"
        elif "s3/bucketName" in parameter_name:
            return f"harmonest-{self.env_name}-storage"
        elif "s3/bucketArn" in parameter_name:
            return f"arn:aws:s3:::harmonest-{self.env_name}-storage"
        elif "api/id" in parameter_name:
            return "test-api-id"
        elif "api/checkinResourceId" in parameter_name:
            return "test-resource-id"
        elif "secrets/credsArn" in parameter_name:
            return f"arn:aws:secretsmanager:eu-central-1:123456789012:secret:harmonest/{self.env_name}/guestyforhosts/creds"
        elif "secrets/sessionArn" in parameter_name:
            return f"arn:aws:secretsmanager:eu-central-1:123456789012:secret:harmonest/{self.env_name}/guestyforhosts/webSession"
        return "mock-value"
    
    def test_lambda_function_created(self):
        """Test that Lambda function is created with correct configuration"""
        self.template.has_resource_properties("AWS::Lambda::Function", {
            "FunctionName": f"harmonest-{self.env_name}-lambda_checkin",
            "Runtime": "python3.12",
            "Handler": "handler.handler",
            "Timeout": 60,
            "MemorySize": 512
        })
    
    def test_lambda_environment_variables(self):
        """Test that Lambda has correct environment variables"""
        self.template.has_resource_properties("AWS::Lambda::Function", {
            "Environment": {
                "Variables": {
                    "APP_TABLE": f"harmonest-{self.env_name}-main",
                    "STORAGE_BUCKET": f"harmonest-{self.env_name}-storage",
                    "G4H_ORIGIN": "https://app.guestyforhosts.com",
                    "G4H_APP_VERSION": "6.x",
                    "G4H_PLATFORM": "browser--win32",
                    "G4H_DEVICE_UUID": "ypa-uuid-lambda"
                }
            }
        })
    
    def test_lambda_permissions(self):
        """Test that Lambda has correct IAM permissions"""
        # Check DynamoDB permissions
        self.template.has_resource_properties("AWS::IAM::Policy", {
            "PolicyDocument": {
                "Statement": assertions.Match.array_with([
                    {
                        "Effect": "Allow",
                        "Action": [
                            "dynamodb:BatchGetItem",
                            "dynamodb:GetRecords",
                            "dynamodb:GetShardIterator",
                            "dynamodb:Query",
                            "dynamodb:GetItem",
                            "dynamodb:Scan",
                            "dynamodb:ConditionCheckItem",
                            "dynamodb:BatchWriteItem",
                            "dynamodb:PutItem",
                            "dynamodb:UpdateItem",
                            "dynamodb:DeleteItem",
                            "dynamodb:DescribeTable"
                        ]
                    }
                ])
            }
        })
        
        # Check GSI query permissions
        self.template.has_resource_properties("AWS::IAM::Policy", {
            "PolicyDocument": {
                "Statement": assertions.Match.array_with([
                    {
                        "Effect": "Allow",
                        "Action": ["dynamodb:Query"]
                    }
                ])
            }
        })
    
    def test_api_gateway_integration(self):
        """Test that API Gateway methods are created"""
        # This test would need more complex mocking for API Gateway resources
        # For now, we verify the Lambda permission for API Gateway
        self.template.has_resource_properties("AWS::Lambda::Permission", {
            "Action": "lambda:InvokeFunction",
            "Principal": "apigateway.amazonaws.com"
        })
    
    def test_secrets_permissions(self):
        """Test that Lambda has permissions to access secrets"""
        self.template.has_resource_properties("AWS::IAM::Policy", {
            "PolicyDocument": {
                "Statement": assertions.Match.array_with([
                    {
                        "Effect": "Allow",
                        "Action": [
                            "secretsmanager:GetSecretValue",
                            "secretsmanager:DescribeSecret"
                        ]
                    }
                ])
            }
        })
    
    def test_s3_permissions(self):
        """Test that Lambda has S3 permissions"""
        self.template.has_resource_properties("AWS::IAM::Policy", {
            "PolicyDocument": {
                "Statement": assertions.Match.array_with([
                    {
                        "Effect": "Allow",
                        "Action": [
                            "s3:GetObject*",
                            "s3:GetBucket*",
                            "s3:List*",
                            "s3:DeleteObject*",
                            "s3:PutObject",
                            "s3:PutObjectLegalHold",
                            "s3:PutObjectRetention",
                            "s3:PutObjectTagging",
                            "s3:PutObjectVersionTagging",
                            "s3:Abort*"
                        ]
                    }
                ])
            }
        })
    
    def test_eventbridge_permissions(self):
        """Test that Lambda has EventBridge permissions for QR code scheduling"""
        self.template.has_resource_properties("AWS::IAM::Policy", {
            "PolicyDocument": {
                "Statement": assertions.Match.array_with([
                    {
                        "Effect": "Allow",
                        "Action": [
                            "events:PutRule",
                            "events:PutTargets",
                            "events:DeleteRule",
                            "events:RemoveTargets",
                            "events:DescribeRule"
                        ]
                    }
                ])
            }
        })


if __name__ == "__main__":
    pytest.main([__file__])
