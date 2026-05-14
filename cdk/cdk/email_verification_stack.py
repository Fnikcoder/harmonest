from aws_cdk import (
    Stack, Duration,
    aws_lambda as _lambda,
    aws_apigateway as apigw,
    aws_dynamodb as ddb,
    aws_ssm as ssm,
    aws_logs as logs,
    aws_iam as iam,
    aws_secretsmanager as secrets,
)
from constructs import Construct


class EmailVerificationStack(Stack):
    def __init__(self, scope: Construct, cid: str, *, config: dict, **kw):
        super().__init__(scope, cid, **kw)

        # Extract client and environment info from config
        client_name = config["cdk"]["client_name"]
        env_name = config["cdk"]["env_name"]

        # Get references from other stacks
        table_name = ssm.StringParameter.value_for_string_parameter(
            self, f"/{client_name}/{env_name}/table/name"
        )
        layer_arn = ssm.StringParameter.value_for_string_parameter(
            self, f"/{client_name}/{env_name}/layers/commonArn"
        )
        api_id = ssm.StringParameter.value_for_string_parameter(
            self, f"/{client_name}/{env_name}/api/id"
        )
        root_resource_id = ssm.StringParameter.value_for_string_parameter(
            self, f"/{client_name}/{env_name}/api/rootResourceId"
        )

        # --- Zoho SMTP Secret ---
        zoho_smtp_arn = ssm.StringParameter.value_for_string_parameter(
            self, f"/{client_name}/{env_name}/secrets/email/zoho-smtp/arn"
        )
        zoho_smtp_secret = secrets.Secret.from_secret_complete_arn(
            self, "ZohoSMTP", zoho_smtp_arn
        )

        # --- Resources ---
        table = ddb.Table.from_table_name(self, "AppTable", table_name)
        layer = _lambda.LayerVersion.from_layer_version_arn(self, "CommonLayer", layer_arn)
        api = apigw.RestApi.from_rest_api_id(self, "HarmonestApi", api_id)

        # --- Lambda Function ---
        # Generate Lambda environment variables from configuration
        lambda_env_vars = self._get_lambda_environment_variables(config)
        lambda_env_vars.update({
            "APP_TABLE": table_name,
        })

        fn = _lambda.Function(
            self, "EmailVerificationFn",
            function_name=f"{client_name}-{env_name}-lambda_email_verification",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="handler.handler",
            code=_lambda.Code.from_asset("functions/email_verification"),
            timeout=Duration.seconds(30),
            memory_size=256,
            layers=[layer],
            log_retention=logs.RetentionDays.ONE_WEEK,
            environment=lambda_env_vars,
        )

        # --- Permissions ---
        # DynamoDB permissions
        table.grant_read_write_data(fn)

        # Zoho SMTP secret permissions
        zoho_smtp_secret.grant_read(fn)

        # SSM parameter permissions for accessing secret ARN
        fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "ssm:GetParameter",
                    "ssm:GetParameters"
                ],
                resources=[
                    f"arn:aws:ssm:{self.region}:{self.account}:parameter/{client_name}/{env_name}/secrets/email/zoho-smtp/arn"
                ]
            )
        )

        # KMS permissions for decrypting secrets
        fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "kms:Decrypt",
                    "kms:DescribeKey"
                ],
                resources=[
                    f"arn:aws:kms:{self.region}:{self.account}:key/*"
                ]
            )
        )

        # --- API Gateway Integration ---
        # Get the root resource and create /email-verification resource
        root_resource = apigw.Resource.from_resource_attributes(
            self, "RootResource",
            resource_id=root_resource_id,
            rest_api=api,
            path="/"
        )
        email_verification_resource = root_resource.add_resource("email-verification")

        # Create Lambda integration
        integration = apigw.LambdaIntegration(
            fn,
            proxy=True,
            integration_responses=[
                apigw.IntegrationResponse(
                    status_code="200",
                    response_parameters={
                        "method.response.header.Access-Control-Allow-Origin": "'*'"
                    }
                )
            ]
        )

        # Add POST method for email verification operations
        email_verification_resource.add_method(
            "POST",
            integration,
            method_responses=[
                apigw.MethodResponse(
                    status_code="200",
                    response_parameters={
                        "method.response.header.Access-Control-Allow-Origin": True
                    }
                )
            ]
        )

        # Add OPTIONS method for CORS
        email_verification_resource.add_method(
            "OPTIONS",
            integration,
            method_responses=[
                apigw.MethodResponse(
                    status_code="200",
                    response_parameters={
                        "method.response.header.Access-Control-Allow-Origin": True,
                        "method.response.header.Access-Control-Allow-Headers": True,
                        "method.response.header.Access-Control-Allow-Methods": True
                    }
                )
            ]
        )

        # Grant API Gateway permission to invoke Lambda
        fn.add_permission(
            "ApiGatewayInvoke",
            principal=iam.ServicePrincipal("apigateway.amazonaws.com"),
            action="lambda:InvokeFunction",
            source_arn=f"arn:aws:execute-api:{self.region}:{self.account}:{api_id}/*/*"
        )

        # Store resource ID for reference
        ssm.StringParameter(
            self, "EmailVerificationResourceId",
            parameter_name=f"/{client_name}/{env_name}/api/emailVerificationResourceId",
            string_value=email_verification_resource.resource_id,
        )

    def _get_lambda_environment_variables(self, config: dict) -> dict:
        """Generate Lambda environment variables from configuration"""
        client = config["client"]
        env_vars = {}

        # Client identification
        env_vars["CLIENT_NAME"] = client["name"]
        env_vars["CLIENT_DISPLAY_NAME"] = client["displayName"]
        env_vars["ENVIRONMENT"] = config.get("env_name", "prod")

        # Email configuration
        if "email" in client:
            email = client["email"]
            env_vars["CLIENT_EMAIL_NOREPLY"] = email.get("noreply", f"noreply@{client.get('domains', {}).get('primary', 'example.com')}")
            if "support" in email:
                env_vars["CLIENT_EMAIL_SUPPORT"] = email["support"]
            if "fromName" in email:
                env_vars["CLIENT_EMAIL_FROM_NAME"] = email["fromName"]

        # Domain configuration
        if "domains" in client:
            domains = client["domains"]
            if "primary" in domains:
                env_vars["CLIENT_DOMAIN_PRIMARY"] = domains["primary"]

        # Branding configuration - use our custom colors
        env_vars["CLIENT_BRANDING_PRIMARY_COLOR"] = "#3f7eb1"  # Harmonest blue
        env_vars["CLIENT_BRANDING_SECONDARY_COLOR"] = "#b3c37d"  # Harmonest green

        return env_vars

        # Store references for other stacks
        self.email_verification_resource = email_verification_resource
        self.fn = fn
