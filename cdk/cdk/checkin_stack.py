from aws_cdk import (
    Stack, Duration,
    aws_lambda as _lambda,
    aws_apigateway as apigw,
    aws_dynamodb as ddb,
    aws_s3 as s3,
    aws_ssm as ssm,
    aws_secretsmanager as secrets,
    aws_kms as kms,
    aws_logs as logs,
    aws_iam as iam,
)
from constructs import Construct

from config.guesty_lambda_env import guesty_lambda_env_from_client


class CheckinStack(Stack):
    def __init__(self, scope: Construct, cid: str, *, config: dict, **kw):
        super().__init__(scope, cid, **kw)

        # Extract configuration values
        client_name = config["cdk"]["client_name"]
        env_name = config["cdk"]["env_name"]

        # Get references from other stacks
        table_name = ssm.StringParameter.value_for_string_parameter(
            self, f"/{client_name}/{env_name}/table/name"
        )
        layer_arn = ssm.StringParameter.value_for_string_parameter(
            self, f"/{client_name}/{env_name}/layers/commonArn"
        )
        bucket_name = ssm.StringParameter.value_for_string_parameter(
            self, f"/{client_name}/{env_name}/s3/bucketName"
        )
        bucket_arn = ssm.StringParameter.value_for_string_parameter(
            self, f"/{client_name}/{env_name}/s3/bucketArn"
        )
        api_id = ssm.StringParameter.value_for_string_parameter(
            self, f"/{client_name}/{env_name}/api/id"
        )
        checkin_resource_id = ssm.StringParameter.value_for_string_parameter(
            self, f"/{client_name}/{env_name}/api/checkinResourceId"
        )

        # --- KMS Key for Secrets ---
        kms_key_id = config["client"]["aws"].get("kmsKeyId")
        if kms_key_id:
            secrets_key = kms.Key.from_key_arn(
                self, "SecretsKey",
                key_arn=f"arn:aws:kms:{self.region}:{self.account}:key/{kms_key_id}"
            )
        else:
            secrets_key = None

        # --- Credentials Secret ---
        creds_arn = ssm.StringParameter.value_for_string_parameter(
            self, f"/{client_name}/{env_name}/secrets/guestyforhosts/creds/arn"
        )
        creds_secret = secrets.Secret.from_secret_complete_arn(
            self, "G4HCreds", creds_arn
        )

        # --- Session Secret ---
        sess_arn = ssm.StringParameter.value_for_string_parameter(
            self, f"/{client_name}/{env_name}/secrets/guestyforhosts/webSession/arn"
        )
        sess_secret = secrets.Secret.from_secret_complete_arn(
            self, "G4HSess", sess_arn
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
        bucket = s3.Bucket.from_bucket_arn(self, "StorageBucket", bucket_arn)
        api = apigw.RestApi.from_rest_api_id(self, "HarmonestApi", api_id)

        # --- Lambda Function ---
        # Get environment-specific scaling settings
        lambda_config = config.get("environment", {}).get("scaling", {}).get("lambda", {})
        memory_size = lambda_config.get("memorySize", 512)
        timeout = lambda_config.get("timeout", 60)

        # Generate Lambda environment variables from configuration
        lambda_env_vars = self._get_lambda_environment_variables(config)
        lambda_env_vars.update({
            "APP_TABLE": table_name,
            "STORAGE_BUCKET": bucket_name,
            "G4H_CRED_SECRET": creds_secret.secret_arn,
            "G4H_SESSION_SECRET": sess_secret.secret_arn,
        })

        fn = _lambda.Function(
            self, "CheckinFn",
            function_name=f"{client_name}-{env_name}-lambda_checkin",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="handler.handler",
            code=_lambda.Code.from_asset("functions/checkin"),
            timeout=Duration.seconds(timeout),
            memory_size=memory_size,
            layers=[layer],
            log_retention=logs.RetentionDays.ONE_WEEK,
            environment=lambda_env_vars,
        )

        # --- Permissions ---
        # DynamoDB permissions
        table.grant_read_write_data(fn)

        # Additional permission for GSI queries
        fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "dynamodb:Query"
                ],
                resources=[
                    f"{table.table_arn}/index/*"  # All GSIs
                ]
            )
        )
        
        # S3 permissions for file uploads
        bucket.grant_put(fn, "private/reservations/*")
        bucket.grant_read(fn, "private/reservations/*")
        
        # Secrets permissions
        creds_secret.grant_read(fn)
        sess_secret.grant_read(fn)
        sess_secret.grant_write(fn)
        zoho_smtp_secret.grant_read(fn)
        
        # KMS permissions for secret encryption/decryption (if KMS key is configured)
        if secrets_key:
            secrets_key.grant(fn, "kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*", "kms:GenerateDataKey*")
        
        # EventBridge permissions for QR code scheduling and test access notifications
        fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "events:PutRule",
                    "events:PutTargets",
                    "events:DeleteRule",
                    "events:RemoveTargets",
                    "events:DescribeRule"
                ],
                resources=[
                    f"arn:aws:events:{self.region}:{self.account}:rule/qr-code-*",
                    f"arn:aws:events:{self.region}:{self.account}:rule/test-access-*",
                    f"arn:aws:events:{self.region}:{self.account}:rule/access-notification-*",
                ]
            )
        )

        # EventBridge Scheduler permissions for one-schedule-per-reservation delivery.
        fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "scheduler:CreateSchedule",
                    "scheduler:DeleteSchedule",
                    "scheduler:GetSchedule",
                    "scheduler:UpdateSchedule"
                ],
                resources=[
                    f"arn:aws:scheduler:{self.region}:{self.account}:schedule/default/access-notification-*"
                ]
            )
        )
        fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "iam:PassRole",
                ],
                resources=[
                    f"arn:aws:iam::{self.account}:role/harmonest-{env_name}-scheduler-access-notification-role"
                ]
            )
        )

        # Lambda invoke permissions for triggering access notification function
        fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "lambda:InvokeFunction",
                ],
                resources=[f"arn:aws:lambda:{self.region}:{self.account}:function:harmonest-{env_name}-lambda_access_notification"]
            )
        )

        # CloudFormation permissions for getting exports
        fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cloudformation:ListExports"
                ],
                resources=["*"]
            )
        )

        # STS permissions for getting account ID
        fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "sts:GetCallerIdentity"
                ],
                resources=["*"]
            )
        )

        # SSM parameter permissions for accessing secret ARNs and door access function ARN
        fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "ssm:GetParameter",
                    "ssm:GetParameters"
                ],
                resources=[
                    f"arn:aws:ssm:{self.region}:{self.account}:parameter/{client_name}/{env_name}/secrets/email/zoho-smtp/arn",
                    f"arn:aws:ssm:{self.region}:{self.account}:parameter/harmonest/{env_name}/door-access/function-arn"
                ]
            )
        )

        # --- API Gateway Integration ---
        # Get the checkin resource
        checkin_resource = apigw.Resource.from_resource_attributes(
            self, "CheckinResource",
            resource_id=checkin_resource_id,
            rest_api=api,
            path="/checkin"
        )

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

        # Add POST method for check-in operations
        checkin_resource.add_method(
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

        # Add GET method for status checking
        checkin_resource.add_method(
            "GET",
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

        # Grant API Gateway permission to invoke Lambda
        fn.add_permission(
            "ApiGatewayInvoke",
            principal=iam.ServicePrincipal("apigateway.amazonaws.com"),
            action="lambda:InvokeFunction",
            source_arn=f"arn:aws:execute-api:{self.region}:{self.account}:{api_id}/*/*"
        )

    def _get_lambda_environment_variables(self, config: dict) -> dict:
        """Generate Lambda environment variables from configuration"""
        client = config["client"]
        env_vars = {}
        env_vars.update(guesty_lambda_env_from_client(client))

        # Feature flags
        features = client.get("features", {})
        if "checkin" in features:
            checkin = features["checkin"]
            env_vars["CHECKIN_ENABLED"] = str(checkin.get("enabled", True)).lower()
            env_vars["CHECKIN_DEADLINE_HOURS"] = str(checkin.get("deadlineHours", 25))
            env_vars["QR_CODE_ENABLED"] = str(checkin.get("qrCodeEnabled", True)).lower()

        # Client identification
        env_vars["CLIENT_NAME"] = client["name"]
        env_vars["CLIENT_DISPLAY_NAME"] = client["displayName"]

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

        # Branding configuration
        if "branding" in client:
            branding = client["branding"]
            if "primaryColor" in branding:
                env_vars["CLIENT_BRANDING_PRIMARY_COLOR"] = branding["primaryColor"]
            if "secondaryColor" in branding:
                env_vars["CLIENT_BRANDING_SECONDARY_COLOR"] = branding["secondaryColor"]

        return env_vars
