"""
Public Listings Stack - Lambda function for public listings API
"""
from aws_cdk import (
    Stack,
    aws_lambda as lambda_,
    aws_apigateway as apigateway,
    aws_iam as iam,
    aws_ssm as ssm,
    Duration,
)
from constructs import Construct


class PublicListingsStack(Stack):
    """Stack for public listings API Lambda function"""
    
    def __init__(self, scope: Construct, construct_id: str, env_name: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)
        
        self.env_name = env_name
        
        # Get references from existing infrastructure
        self.table_name = ssm.StringParameter.value_for_string_parameter(
            self, f"/harmonest/{env_name}/table/name"
        )
        self.layer_arn = ssm.StringParameter.value_for_string_parameter(
            self, f"/harmonest/{env_name}/layers/commonArn"
        )
        self.api_id = ssm.StringParameter.value_for_string_parameter(
            self, f"/harmonest/{env_name}/api/id"
        )
        self.public_listings_resource_id = ssm.StringParameter.value_for_string_parameter(
            self, f"/harmonest/{env_name}/api/publicListingsResourceId"
        )
        self.public_listing_resource_id = ssm.StringParameter.value_for_string_parameter(
            self, f"/harmonest/{env_name}/api/publicListingResourceId"
        )
        self.public_listings_search_resource_id = ssm.StringParameter.value_for_string_parameter(
            self, f"/harmonest/{env_name}/api/publicListingsSearchResourceId"
        )
        
        # Create Lambda function
        self.create_lambda_function()
        
        # Create API Gateway integrations
        self.create_api_integrations()
    
    def create_lambda_function(self):
        """Create the public listings Lambda function"""
        
        self.function = lambda_.Function(
            self, f"PublicListingsFunction-{self.env_name}",
            function_name=f"harmonest-{self.env_name}-lambda_public_listings",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="public_api_handler.handler",
            code=lambda_.Code.from_asset("functions/listings"),
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={
                "APP_TABLE": self.table_name,
                "ENV_NAME": self.env_name,
            },
            layers=[
                lambda_.LayerVersion.from_layer_version_arn(
                    self, "CommonLayer", self.layer_arn
                )
            ],
            description="Public listings API with optional authentication"
        )
        
        # Grant DynamoDB permissions
        self.function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "dynamodb:GetItem",
                    "dynamodb:Query",
                    "dynamodb:Scan",
                    "dynamodb:BatchGetItem",
                ],
                resources=[
                    f"arn:aws:dynamodb:{self.region}:{self.account}:table/{self.table_name}",
                    f"arn:aws:dynamodb:{self.region}:{self.account}:table/{self.table_name}/index/*"
                ]
            )
        )
        
        # Grant CloudWatch Logs permissions
        self.function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents"
                ],
                resources=[
                    f"arn:aws:logs:{self.region}:{self.account}:log-group:/aws/lambda/harmonest-{self.env_name}-lambda_public_listings*"
                ]
            )
        )
    
    def create_api_integrations(self):
        """Create API Gateway integrations"""
        
        # Get API Gateway reference
        api = apigateway.RestApi.from_rest_api_id(
            self, "ExistingApi", self.api_id
        )
        
        # Create Lambda integration
        integration = apigateway.LambdaIntegration(
            self.function,
            proxy=True,
            allow_test_invoke=True
        )
        
        # Get resource references
        public_listings_resource = apigateway.Resource.from_resource_attributes(
            self, "PublicListingsResource",
            resource_id=self.public_listings_resource_id,
            rest_api=api,
            path="/public/listings"
        )

        public_listing_resource = apigateway.Resource.from_resource_attributes(
            self, "PublicListingResource",
            resource_id=self.public_listing_resource_id,
            rest_api=api,
            path="/public/listings/{listingId}"
        )

        public_listings_search_resource = apigateway.Resource.from_resource_attributes(
            self, "PublicListingsSearchResource",
            resource_id=self.public_listings_search_resource_id,
            rest_api=api,
            path="/public/listings/search"
        )
        
        # Add methods to resources
        # GET /public/listings - List all listings
        public_listings_resource.add_method("GET", integration)
        
        # GET /public/listings/{listingId} - Get specific listing
        public_listing_resource.add_method("GET", integration)
        
        # POST /public/listings/search - Search listings
        public_listings_search_resource.add_method("POST", integration)
        
        # Grant API Gateway permission to invoke Lambda
        self.function.add_permission(
            "ApiGatewayInvokePermission",
            principal=iam.ServicePrincipal("apigateway.amazonaws.com"),
            action="lambda:InvokeFunction",
            source_arn=f"arn:aws:execute-api:{self.region}:{self.account}:{self.api_id}/*/*"
        )
        
        # Store function ARN in SSM for potential future use
        ssm.StringParameter(
            self, "PublicListingsFunctionArn",
            parameter_name=f"/harmonest/{self.env_name}/lambda/publicListingsArn",
            string_value=self.function.function_arn
        )
