"""
Data Access Stack
Provides role-based API endpoints for DynamoDB and S3 access
"""
from aws_cdk import (
    Stack, Duration,
    aws_lambda as lambda_,
    aws_apigateway as apigateway,
    aws_iam as iam,
    aws_ssm as ssm,
)
from constructs import Construct


class DataAccessStack(Stack):
    def __init__(self, scope: Construct, cid: str, *, config: dict, layer_arn: str, 
                 authorizer_function_arn: str, table_name: str, bucket_name: str, **kw):
        super().__init__(scope, cid, **kw)
        
        # Extract configuration values
        self.client_name = config["cdk"]["client_name"]
        self.env_name = config["cdk"]["env_name"]
        self.region = config["cdk"]["region"]
        self.layer_arn = layer_arn
        self.authorizer_function_arn = authorizer_function_arn
        self.table_name = table_name
        self.bucket_name = bucket_name
        
        # Create Lambda functions
        self.create_lambda_functions()
        
        # Create API Gateway
        self.create_api_gateway()
    
    def create_lambda_functions(self):
        """Create Lambda functions for data access"""
        
        # DynamoDB Handler Function
        self.dynamodb_function = lambda_.Function(
            self, f"DynamoDBFunction-{self.env_name}",
            function_name=f"harmonest-{self.env_name}-lambda_dynamodb_handler",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="dynamodb_handler.handler",
            code=lambda_.Code.from_asset("functions/data"),
            timeout=Duration.seconds(30),
            memory_size=512,
            environment={
                "APP_TABLE": self.table_name,
                "ENV_NAME": self.env_name,
            },
            layers=[
                lambda_.LayerVersion.from_layer_version_arn(
                    self, "DynamoDBCommonLayer", self.layer_arn
                )
            ],
            description="Role-based DynamoDB access handler"
        )
        
        # S3 Handler Function
        self.s3_function = lambda_.Function(
            self, f"S3Function-{self.env_name}",
            function_name=f"harmonest-{self.env_name}-lambda_s3_handler",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="s3_handler.handler",
            code=lambda_.Code.from_asset("functions/data"),
            timeout=Duration.seconds(30),
            memory_size=512,
            environment={
                "S3_BUCKET": self.bucket_name,
                "ENV_NAME": self.env_name,
            },
            layers=[
                lambda_.LayerVersion.from_layer_version_arn(
                    self, "S3CommonLayer", self.layer_arn
                )
            ],
            description="Role-based S3 access handler"
        )
        
        # Grant DynamoDB permissions
        self.dynamodb_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "dynamodb:GetItem",
                    "dynamodb:PutItem",
                    "dynamodb:UpdateItem",
                    "dynamodb:DeleteItem",
                    "dynamodb:Query",
                    "dynamodb:Scan",
                    "dynamodb:BatchGetItem",
                    "dynamodb:BatchWriteItem",
                ],
                resources=[
                    f"arn:aws:dynamodb:{self.region}:{self.account}:table/{self.table_name}",
                    f"arn:aws:dynamodb:{self.region}:{self.account}:table/{self.table_name}/index/*"
                ]
            )
        )
        
        # Grant S3 permissions
        self.s3_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "s3:GetObject",
                    "s3:PutObject",
                    "s3:DeleteObject",
                    "s3:ListBucket",
                    "s3:GetObjectVersion",
                    "s3:PutObjectAcl",
                ],
                resources=[
                    f"arn:aws:s3:::{self.bucket_name}",
                    f"arn:aws:s3:::{self.bucket_name}/*"
                ]
            )
        )
    
    def create_api_gateway(self):
        """Create API Gateway with data access endpoints"""
        
        # Create API Gateway
        self.api = apigateway.RestApi(
            self, f"DataAccessApi-{self.env_name}",
            rest_api_name=f"harmonest-data-access-{self.env_name}",
            description="Role-based data access API for DynamoDB and S3",
            default_cors_preflight_options=apigateway.CorsOptions(
                allow_origins=apigateway.Cors.ALL_ORIGINS,
                allow_methods=apigateway.Cors.ALL_METHODS,
                allow_headers=["Content-Type", "Authorization"]
            )
        )
        
        # Import the authorizer function
        authorizer_function = lambda_.Function.from_function_arn(
            self, f"ImportedAuthorizer-{self.env_name}",
            self.authorizer_function_arn
        )
        
        # Create Lambda authorizer
        self.authorizer = apigateway.TokenAuthorizer(
            self, f"DataApiAuthorizer-{self.env_name}",
            handler=authorizer_function,
            identity_source="method.request.header.Authorization",
            results_cache_ttl=Duration.minutes(5)
        )
        
        # Create DynamoDB endpoints
        self.create_dynamodb_endpoints()
        
        # Create S3 endpoints
        self.create_s3_endpoints()
        
        # Export API URL
        ssm.StringParameter(
            self, "DataAccessApiUrl",
            parameter_name=f"/{self.client_name}/{self.env_name}/api/data-access-url",
            string_value=self.api.url,
        )
    
    def create_dynamodb_endpoints(self):
        """Create DynamoDB API endpoints"""
        
        # DynamoDB integration
        dynamodb_integration = apigateway.LambdaIntegration(
            self.dynamodb_function,
            proxy=True
        )
        
        # Create DynamoDB resource
        dynamodb_resource = self.api.root.add_resource("dynamodb")
        
        # DynamoDB endpoints
        endpoints = [
            ("get", "POST"),      # POST /dynamodb/get
            ("query", "POST"),    # POST /dynamodb/query
            ("put", "POST"),      # POST /dynamodb/put
            ("update", "POST"),   # POST /dynamodb/update
            ("delete", "POST"),   # POST /dynamodb/delete
        ]
        
        for endpoint, method in endpoints:
            resource = dynamodb_resource.add_resource(endpoint)
            resource.add_method(
                method,
                dynamodb_integration,
                authorizer=self.authorizer,
                authorization_type=apigateway.AuthorizationType.CUSTOM
            )
        
        # Grant API Gateway permission to invoke DynamoDB function
        self.dynamodb_function.add_permission(
            "DynamoDBApiGatewayInvokePermission",
            principal=iam.ServicePrincipal("apigateway.amazonaws.com"),
            action="lambda:InvokeFunction",
            source_arn=f"arn:aws:execute-api:{self.region}:{self.account}:{self.api.rest_api_id}/*/*"
        )
    
    def create_s3_endpoints(self):
        """Create S3 API endpoints"""
        
        # S3 integration
        s3_integration = apigateway.LambdaIntegration(
            self.s3_function,
            proxy=True
        )
        
        # Create S3 resource
        s3_resource = self.api.root.add_resource("s3")
        
        # S3 endpoints
        endpoints = [
            ("download", "POST"),     # POST /s3/download (get presigned URL)
            ("upload-url", "POST"),   # POST /s3/upload-url (get upload URL)
            ("upload", "POST"),       # POST /s3/upload (direct upload)
            ("list", "GET"),          # GET /s3/list
            ("delete", "POST"),       # POST /s3/delete
        ]
        
        for endpoint, method in endpoints:
            resource = s3_resource.add_resource(endpoint)
            resource.add_method(
                method,
                s3_integration,
                authorizer=self.authorizer,
                authorization_type=apigateway.AuthorizationType.CUSTOM
            )
        
        # Grant API Gateway permission to invoke S3 function
        self.s3_function.add_permission(
            "S3ApiGatewayInvokePermission",
            principal=iam.ServicePrincipal("apigateway.amazonaws.com"),
            action="lambda:InvokeFunction",
            source_arn=f"arn:aws:execute-api:{self.region}:{self.account}:{self.api.rest_api_id}/*/*"
        )
    
    @property
    def api_url(self):
        """Get the API Gateway URL"""
        return self.api.url
    
    @property
    def api_id(self):
        """Get the API Gateway ID"""
        return self.api.rest_api_id
