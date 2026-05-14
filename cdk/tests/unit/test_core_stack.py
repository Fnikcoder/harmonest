"""
Unit tests for CoreStack
"""
import aws_cdk as core
import aws_cdk.assertions as assertions
import pytest
from cdk.core_stack import CoreStack


class TestCoreStack:
    """Test cases for CoreStack"""
    
    def setup_method(self):
        """Setup test environment"""
        self.app = core.App()
        self.env_name = "test"
        self.stack = CoreStack(
            self.app, 
            f"TestCoreStack-{self.env_name}", 
            env_name=self.env_name
        )
        self.template = assertions.Template.from_stack(self.stack)
    
    def test_dynamodb_table_created(self):
        """Test that DynamoDB table is created with correct configuration"""
        # Check table exists
        self.template.has_resource_properties("AWS::DynamoDB::Table", {
            "TableName": f"harmonest-{self.env_name}-main",
            "BillingMode": "PAY_PER_REQUEST",
            "PointInTimeRecoverySpecification": {
                "PointInTimeRecoveryEnabled": True
            },
            "AttributeDefinitions": [
                {"AttributeName": "PK", "AttributeType": "S"},
                {"AttributeName": "SK", "AttributeType": "S"},
                {"AttributeName": "GSI1PK", "AttributeType": "S"},
                {"AttributeName": "GSI1SK", "AttributeType": "S"},
                {"AttributeName": "GSI2PK", "AttributeType": "S"},
                {"AttributeName": "GSI2SK", "AttributeType": "S"},
                {"AttributeName": "GSI3PK", "AttributeType": "S"},
                {"AttributeName": "GSI3SK", "AttributeType": "S"},
                {"AttributeName": "GSI4PK", "AttributeType": "S"},
                {"AttributeName": "GSI4SK", "AttributeType": "S"},
                {"AttributeName": "reservationCode", "AttributeType": "S"}
            ],
            "KeySchema": [
                {"AttributeName": "PK", "KeyType": "HASH"},
                {"AttributeName": "SK", "KeyType": "RANGE"}
            ]
        })
    
    def test_global_secondary_indexes_created(self):
        """Test that all required GSIs are created"""
        # Test GSI1
        self.template.has_resource_properties("AWS::DynamoDB::Table", {
            "GlobalSecondaryIndexes": assertions.Match.array_with([
                {
                    "IndexName": "GSI1",
                    "KeySchema": [
                        {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                        {"AttributeName": "GSI1SK", "KeyType": "RANGE"}
                    ],
                    "Projection": {"ProjectionType": "ALL"}
                }
            ])
        })
        
        # Test ReservationCodeIndex
        self.template.has_resource_properties("AWS::DynamoDB::Table", {
            "GlobalSecondaryIndexes": assertions.Match.array_with([
                {
                    "IndexName": "ReservationCodeIndex",
                    "KeySchema": [
                        {"AttributeName": "reservationCode", "KeyType": "HASH"}
                    ],
                    "Projection": {"ProjectionType": "ALL"}
                }
            ])
        })
    
    def test_ssm_parameter_created(self):
        """Test that SSM parameter for table name is created"""
        self.template.has_resource_properties("AWS::SSM::Parameter", {
            "Name": f"/harmonest/{self.env_name}/table/name",
            "Type": "String",
            "Value": {"Ref": assertions.Match.any_value()}
        })
    
    def test_prod_environment_table_name(self):
        """Test that production environment uses correct table name"""
        # Create a separate app for prod test to avoid conflicts
        prod_app = core.App()
        prod_stack = CoreStack(
            prod_app,
            "TestCoreStack-prod",
            env_name="prod"
        )
        prod_template = assertions.Template.from_stack(prod_stack)

        prod_template.has_resource_properties("AWS::DynamoDB::Table", {
            "TableName": "harmonest-main"
        })
    
    def test_retention_policy(self):
        """Test that table has RETAIN deletion policy"""
        self.template.has_resource("AWS::DynamoDB::Table", {
            "DeletionPolicy": "Retain"
        })


if __name__ == "__main__":
    pytest.main([__file__])
