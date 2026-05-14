"""
Access Notification Stack
Creates Lambda function for comprehensive access notification system (QRLock + TTLock) and notification delivery
"""
from typing import Any, Dict

from aws_cdk import (
    Stack,
    Duration,
    aws_lambda as _lambda,
    aws_iam as iam,
    aws_dynamodb as ddb,
    aws_events as events,
    aws_events_targets as targets,
    aws_ssm as ssm,
    aws_secretsmanager as sm,
    aws_kms as kms,
)
from constructs import Construct

from config.guesty_lambda_env import guesty_lambda_env_from_client

# Optional CDK context overrides for integrations.g4h (merged on top of client JSON).
_G4H_CONTEXT_KEYS = (
    ("g4hAuthMode", "authMode"),
    ("g4hOrigin", "origin"),
    ("g4hAppBase", "appBase"),
    ("g4hAppVersion", "appVersion"),
    ("g4hPlatform", "platform"),
    ("g4hDeviceUuid", "deviceUuid"),
    ("g4hListingsV2Fields", "listingsV2Fields"),
    ("g4hListingsV2Limit", "listingsV2Limit"),
    ("g4hResReportsColumns", "reservationsReportsColumns"),
    ("g4hResReportsFilters", "reservationsReportsFilters"),
    ("g4hResReportsTimezone", "reservationsReportsTimezone"),
    ("g4hResReportsLimit", "reservationsReportsLimit"),
    ("g4hOktaIssuer", "oktaIssuer"),
    ("g4hOktaClientId", "oktaClientId"),
    ("g4hOktaAuthorizeScopes", "oktaAuthorizeScopes"),
    ("g4hOktaRedirectUri", "oktaRedirectUri"),
    ("g4hOktaAuthnUrl", "oktaAuthnUrl"),
    ("g4hOktaTokenExchange", "oktaTokenExchange"),
)


class AccessNotificationStack(Stack):
    """Stack for Access Notification Lambda function (QRLock + TTLock + Email/SMS)"""

    def __init__(self, scope: Construct, construct_id: str, *, config: dict, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        client_name = config["cdk"]["client_name"]
        env_name = config["cdk"]["env_name"]
        self.env_name = env_name

        table_name = ssm.StringParameter.value_for_string_parameter(
            self, f"/{client_name}/{env_name}/table/name"
        )
        layer_arn = ssm.StringParameter.value_for_string_parameter(
            self, f"/{client_name}/{env_name}/layers/commonArn"
        )

        kms_key_id = config.get("client", {}).get("aws", {}).get("kmsKeyId")
        if kms_key_id:
            secrets_key = kms.Key.from_key_arn(
                self,
                "SecretsKey",
                key_arn=f"arn:aws:kms:{self.region}:{self.account}:key/{kms_key_id}",
            )
        else:
            secrets_key = None

        creds_arn = ssm.StringParameter.value_for_string_parameter(
            self, f"/{client_name}/{env_name}/secrets/guestyforhosts/creds/arn"
        )
        creds_secret = sm.Secret.from_secret_complete_arn(self, "G4HCreds", creds_arn)

        sess_arn = ssm.StringParameter.value_for_string_parameter(
            self, f"/{client_name}/{env_name}/secrets/guestyforhosts/webSession/arn"
        )
        sess_secret = sm.Secret.from_secret_complete_arn(self, "G4HSess", sess_arn)

        table = ddb.Table.from_table_name(self, "AppTable", table_name)
        layer = _lambda.LayerVersion.from_layer_version_arn(self, "CommonLayer", layer_arn)

        zoho_smtp_arn = ssm.StringParameter.value_for_string_parameter(
            self, f"/{client_name}/{env_name}/secrets/email/zoho-smtp/arn"
        )
        zoho_smtp_secret = sm.Secret.from_secret_complete_arn(self, "ZohoSMTP", zoho_smtp_arn)

        guesty_env = guesty_lambda_env_from_client(self._merge_g4h_context_overrides(config["client"]))

        lambda_env: Dict[str, str] = {
            "APP_TABLE": table_name,
            "SNS_REGION": "eu-central-1",
            "ENVIRONMENT": env_name,
            "CLIENT_NAME": client_name,
            "G4H_CRED_SECRET": creds_secret.secret_arn,
            "G4H_SESSION_SECRET": sess_secret.secret_arn,
            "QRLOCK_EMAIL": self.node.try_get_context("qrlock_email") or "",
            "QRLOCK_PASSWORD": self.node.try_get_context("qrlock_password") or "",
            "TTLOCK_USERNAME": self.node.try_get_context("ttlock_username") or "",
            "TTLOCK_PASSWORD": self.node.try_get_context("ttlock_password") or "",
            "TTLOCK_APP_ID": self.node.try_get_context("ttlock_app_id") or "838233ed921e44249a26f215bb0042b8",
            "TTLOCK_APP_SECRET": self.node.try_get_context("ttlock_app_secret") or "71a3ecab58a36a0c5100ce58043550b2",
            "TTLOCK_COUNTRY_ID": self.node.try_get_context("ttlock_country_id") or "67",
            "TTLOCK_SITE_ID": self.node.try_get_context("ttlock_site_id") or "2",
            "SMS_SENDER_ID": "Harmonest",
            "DEFAULT_COUNTRY_CODE": "49",
        }
        lambda_env.update(guesty_env)

        fn = _lambda.Function(
            self,
            "AccessNotificationFn",
            function_name=f"{client_name}-{env_name}-lambda_access_notification",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="handler.handler",
            code=_lambda.Code.from_asset("functions/access_notification"),
            timeout=Duration.seconds(90),
            memory_size=1024,
            layers=[layer],
            environment=lambda_env,
        )

        scheduler_invoke_role = iam.Role(
            self,
            "AccessNotificationSchedulerInvokeRole",
            role_name=f"{client_name}-{env_name}-scheduler-access-notification-role",
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
            source_account=self.account,
        )

        fn.add_permission(
            "AllowApiGatewayAccessNotificationAdmin",
            principal=iam.ServicePrincipal("apigateway.amazonaws.com"),
            action="lambda:InvokeFunction",
            source_arn=f"arn:aws:execute-api:{self.region}:{self.account}:*/*/POST/admin/resend-door-access",
        )

        table.grant_read_write_data(fn)
        zoho_smtp_secret.grant_read(fn)
        creds_secret.grant_read(fn)
        sess_secret.grant_read(fn)
        sess_secret.grant_write(fn)
        if secrets_key:
            secrets_key.grant(fn, "kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*", "kms:GenerateDataKey*")

        fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=["ssm:GetParameter", "ssm:GetParameters"],
                resources=[
                    f"arn:aws:ssm:{self.region}:{self.account}:parameter/{client_name}/{env_name}/secrets/email/zoho-smtp*"
                ],
            )
        )

        fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=["sns:Publish"],
                resources=["*"],
            )
        )

        sm_prefix = f"arn:aws:secretsmanager:{self.region}:{self.account}:secret:{client_name}/{env_name}"
        fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "secretsmanager:GetSecretValue",
                    "secretsmanager:CreateSecret",
                    "secretsmanager:UpdateSecret",
                ],
                resources=[
                    f"{sm_prefix}/qrlock/*",
                    f"{sm_prefix}/ttlock/*",
                ],
            )
        )

        fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "secretsmanager:GetSecretValue",
                    "secretsmanager:PutSecretValue",
                    "secretsmanager:CreateSecret",
                    "secretsmanager:UpdateSecret",
                ],
                resources=[f"{sm_prefix}/*"],
            )
        )

        fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "kms:Decrypt",
                    "kms:Encrypt",
                    "kms:GenerateDataKey",
                    "kms:DescribeKey",
                ],
                resources=["*"],
            )
        )

        from aws_cdk import CfnOutput

        CfnOutput(
            self,
            "AccessNotificationFunctionArn",
            value=fn.function_arn,
            export_name=f"{client_name}-{env_name}-access-notification-function-arn",
        )
        CfnOutput(
            self,
            "AccessNotificationSchedulerRoleArn",
            value=scheduler_invoke_role.role_arn,
            export_name=f"{client_name}-{env_name}-access-notification-scheduler-role-arn",
        )

        self.function = fn
        self.function_arn = fn.function_arn

    def _merge_g4h_context_overrides(self, client: Dict[str, Any]) -> Dict[str, Any]:
        merged_g4h: Dict[str, Any] = dict((client.get("integrations") or {}).get("g4h") or {})
        for ctx_key, g4h_key in _G4H_CONTEXT_KEYS:
            val = self.node.try_get_context(ctx_key)
            if val not in (None, ""):
                merged_g4h[g4h_key] = str(val)
        integrations = dict(client.get("integrations") or {})
        integrations["g4h"] = merged_g4h
        return {**client, "integrations": integrations}

    def add_scheduled_trigger(self, schedule_expression: str, input_data: dict = None):
        """Add a scheduled trigger for QR code generation"""

        scheduled_rule = events.Rule(
            self,
            f"ScheduledQRGeneration-{schedule_expression.replace(' ', '-')}",
            schedule=events.Schedule.expression(schedule_expression),
            description=f"Scheduled QR code generation: {schedule_expression}",
            enabled=True,
        )

        target = targets.LambdaFunction(
            self.function,
            event=events.RuleTargetInput.from_object(input_data) if input_data else None,
        )

        scheduled_rule.add_target(target)

        return scheduled_rule

    def add_custom_trigger(self, event_pattern: dict, description: str = "Custom QR code trigger"):
        """Add a custom EventBridge trigger for QR code generation"""

        custom_rule = events.Rule(
            self,
            f"CustomQRGeneration-{hash(str(event_pattern))}",
            event_pattern=event_pattern,
            description=description,
            enabled=True,
        )

        custom_rule.add_target(targets.LambdaFunction(self.function))

        return custom_rule
