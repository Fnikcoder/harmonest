"""
Access Notification Stack
Creates Lambda function for comprehensive access notification system (QRLock + TTLock) and notification delivery
"""
from aws_cdk import (
    Stack,
    Duration,
    BundlingOptions,
    aws_lambda as _lambda,
    aws_iam as iam,
    aws_dynamodb as ddb,
    aws_events as events,
    aws_events_targets as targets,
    aws_logs as logs,
    aws_ssm as ssm,
    aws_secretsmanager as sm,
)
from constructs import Construct


class AccessNotificationStack(Stack):
    """Stack for Access Notification Lambda function (QRLock + TTLock + Email/SMS)"""

    def __init__(self, scope: Construct, construct_id: str, *, env_name: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        self.env_name = env_name

        # Get shared resources using correct parameter paths
        table_name = ssm.StringParameter.value_for_string_parameter(
            self, f"/harmonest/{env_name}/table/name"
        )
        layer_arn = ssm.StringParameter.value_for_string_parameter(
            self, f"/harmonest/{env_name}/layers/commonArn"
        )
        # Note: API Gateway integration removed to avoid circular dependencies
        # The function will be triggered by EventBridge and can be invoked directly
        # Get client configuration from context
        client_name = self.node.try_get_context("client") or "harmonest"

        # --- Resources ---
        table = ddb.Table.from_table_name(self, "AppTable", table_name)
        layer = _lambda.LayerVersion.from_layer_version_arn(self, "CommonLayer", layer_arn)

        # --- Zoho SMTP Secret ---
        zoho_smtp_arn = ssm.StringParameter.value_for_string_parameter(
            self, f"/{client_name}/{env_name}/secrets/email/zoho-smtp/arn"
        )
        zoho_smtp_secret = sm.Secret.from_secret_complete_arn(
            self, "ZohoSMTP", zoho_smtp_arn
        )

        # No secrets needed - using environment variables for simplicity

        # --- Lambda Function ---
        fn = _lambda.Function(
            self, "AccessNotificationFn",
            function_name=f"harmonest-{env_name}-lambda_access_notification",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="handler.handler",
            code=_lambda.Code.from_asset("functions/access_notification"),
            timeout=Duration.seconds(90),  # Longer timeout for multiple API calls
            memory_size=1024,  # More memory for QR image generation
            layers=[layer],
            environment={
                "APP_TABLE": table_name,
                "SNS_REGION": "eu-central-1",
                "ENVIRONMENT": env_name,
                "CLIENT_NAME": client_name,
                # G4H (Guesty for Hosts) configuration
                "G4H_CRED_SECRET": f"harmonest/{env_name}/guestyforhosts/creds",
                "G4H_SESSION_SECRET": f"harmonest/{env_name}/guestyforhosts/webSession",
                # QRLock configuration
                "QRLOCK_EMAIL": self.node.try_get_context("qrlock_email") or "",
                "QRLOCK_PASSWORD": self.node.try_get_context("qrlock_password") or "",
                # TTLock configuration
                "TTLOCK_USERNAME": self.node.try_get_context("ttlock_username") or "",
                "TTLOCK_PASSWORD": self.node.try_get_context("ttlock_password") or "",
                "TTLOCK_APP_ID": self.node.try_get_context("ttlock_app_id") or "838233ed921e44249a26f215bb0042b8",
                "TTLOCK_APP_SECRET": self.node.try_get_context("ttlock_app_secret") or "71a3ecab58a36a0c5100ce58043550b2",
                "TTLOCK_COUNTRY_ID": self.node.try_get_context("ttlock_country_id") or "67",  # Germany
                "TTLOCK_SITE_ID": self.node.try_get_context("ttlock_site_id") or "2",
                # SMS configuration
                "SMS_SENDER_ID": "Harmonest",
                "DEFAULT_COUNTRY_CODE": "49",  # Germany
            },
        )

        # EventBridge Scheduler assumes this role to invoke the Lambda target.
        scheduler_invoke_role = iam.Role(
            self, "AccessNotificationSchedulerInvokeRole",
            role_name=f"harmonest-{env_name}-scheduler-access-notification-role",
            assumed_by=iam.ServicePrincipal("scheduler.amazonaws.com"),
            description="Allows EventBridge Scheduler to invoke the access notification Lambda",
        )
        scheduler_invoke_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=["lambda:InvokeFunction"],
                resources=[fn.function_arn],
            )
        )

        fn.add_permission(
            "AllowEventBridgeAccessNotification",
            principal=iam.ServicePrincipal("events.amazonaws.com"),
            action="lambda:InvokeFunction",
            source_account=self.account,  # restrict to this account
            # no source_arn -> any EventBridge rule in this account can invoke it
        )

        # Allow API Gateway in this account to invoke for admin resend endpoint
        fn.add_permission(
            "AllowApiGatewayAccessNotificationAdmin",
            principal=iam.ServicePrincipal("apigateway.amazonaws.com"),
            action="lambda:InvokeFunction",
            source_arn=f"arn:aws:execute-api:{self.region}:{self.account}:*/*/POST/admin/resend-door-access",
        )

        # --- IAM Permissions ---
        
        # DynamoDB permissions
        table.grant_read_write_data(fn)

        # Zoho SMTP secret access (email sending via SMTP instead of SES)
        zoho_smtp_secret.grant_read(fn)

        # SSM permissions for accessing Zoho SMTP configuration
        fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "ssm:GetParameter",
                    "ssm:GetParameters"
                ],
                resources=[
                    f"arn:aws:ssm:{self.region}:{self.account}:parameter/{client_name}/{env_name}/secrets/email/zoho-smtp*"
                ]
            )
        )

        # SNS permissions for SMS sending
        fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "sns:Publish",
                ],
                resources=["*"],  # SNS SMS requires wildcard
            )
        )

        # Secrets Manager permissions for QRLock and TTLock credentials and tokens
        fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "secretsmanager:GetSecretValue",
                    "secretsmanager:CreateSecret",
                    "secretsmanager:UpdateSecret"
                ],
                resources=[
                    f"arn:aws:secretsmanager:*:*:secret:harmonest/{env_name}/qrlock/*",
                    f"arn:aws:secretsmanager:*:*:secret:harmonest/{env_name}/ttlock/*"
                ]
            )
        )

        # Note: CloudWatch Logs permissions are automatically added by CDK

        # --- Note: API Gateway integration removed to avoid circular dependencies ---
        # The function is triggered by EventBridge and can be invoked directly if needed

        # --- Note: EventBridge integration removed to avoid circular dependencies ---
        # The function can be invoked directly by other services or manually
        # EventBridge rules can be added later if needed

        # Secrets Manager permissions for accessing credentials
        fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "secretsmanager:GetSecretValue",
                    "secretsmanager:PutSecretValue",
                    "secretsmanager:CreateSecret",
                    "secretsmanager:UpdateSecret"
                ],
                resources=[
                    f"arn:aws:secretsmanager:{self.region}:{self.account}:secret:harmonest/{env_name}/*"
                ]
            )
        )

        # KMS permissions for decrypting and encrypting secrets
        fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "kms:Decrypt",
                    "kms:Encrypt",
                    "kms:GenerateDataKey",
                    "kms:DescribeKey"
                ],
                resources=["*"]  # KMS key ARNs are not predictable, so using wildcard
            )
        )

        # Note: CloudWatch Logs permissions are automatically added by CDK

        # --- Outputs ---

        # Store function ARN for other stacks (using CloudFormation output to avoid circular dependency)
        from aws_cdk import CfnOutput
        CfnOutput(
            self, "AccessNotificationFunctionArn",
            value=fn.function_arn,
            export_name=f"harmonest-{env_name}-access-notification-function-arn"
        )
        CfnOutput(
            self, "AccessNotificationSchedulerRoleArn",
            value=scheduler_invoke_role.role_arn,
            export_name=f"harmonest-{env_name}-access-notification-scheduler-role-arn"
        )

        # Export values for cross-stack references
        self.function = fn
        self.function_arn = fn.function_arn


    def add_scheduled_trigger(self, schedule_expression: str, input_data: dict = None):
        """Add a scheduled trigger for QR code generation"""
        
        scheduled_rule = events.Rule(
            self, f"ScheduledQRGeneration-{schedule_expression.replace(' ', '-')}",
            schedule=events.Schedule.expression(schedule_expression),
            description=f"Scheduled QR code generation: {schedule_expression}",
            enabled=True,
        )

        # Add Lambda target with optional input
        target = targets.LambdaFunction(
            self.function,
            event=events.RuleTargetInput.from_object(input_data) if input_data else None,
        )
        
        scheduled_rule.add_target(target)

        return scheduled_rule


    def add_custom_trigger(self, event_pattern: dict, description: str = "Custom QR code trigger"):
        """Add a custom EventBridge trigger for QR code generation"""
        
        custom_rule = events.Rule(
            self, f"CustomQRGeneration-{hash(str(event_pattern))}",
            event_pattern=event_pattern,
            description=description,
            enabled=True,
        )

        custom_rule.add_target(targets.LambdaFunction(self.function))

        return custom_rule
