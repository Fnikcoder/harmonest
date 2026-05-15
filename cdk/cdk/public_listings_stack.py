"""
Public Listings Stack - Lambda only.

API Gateway routes (GET/POST on /public/listings*) are wired in ApiStack so methods
and resources stay in one stack (same pattern as admin resend-door-access).
"""
from aws_cdk import (
    Stack,
    aws_lambda as lambda_,
    aws_iam as iam,
    aws_ssm as ssm,
    aws_logs as logs,
    Duration,
)
from constructs import Construct


class PublicListingsStack(Stack):
    """Lambda for public listings API; ApiStack attaches API Gateway methods."""

    def __init__(self, scope: Construct, construct_id: str, *, config: dict, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        self._client_name = config["cdk"]["client_name"]
        self._env_name = config["cdk"]["env_name"]
        self.env_name = self._env_name

        self.table_name = ssm.StringParameter.value_for_string_parameter(
            self, f"/{self._client_name}/{self._env_name}/table/name"
        )
        self.layer_arn = ssm.StringParameter.value_for_string_parameter(
            self, f"/{self._client_name}/{self._env_name}/layers/commonArn"
        )

        client = config["client"]
        listings_feat = client.get("features", {}).get("listings", {})
        self._public_listings_enabled = str(listings_feat.get("publicListings", False)).lower()

        self.function = lambda_.Function(
            self,
            f"PublicListingsFunction-{self.env_name}",
            function_name=f"{self._client_name}-{self._env_name}-lambda_public_listings",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="public_api_handler.handler",
            code=lambda_.Code.from_asset("functions/listings"),
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={
                "APP_TABLE": self.table_name,
                "ENV_NAME": self.env_name,
                "CLIENT_NAME": client.get("name", self._client_name),
                "CLIENT_DISPLAY_NAME": client.get("displayName", self._client_name),
                "PUBLIC_LISTINGS_ENABLED": self._public_listings_enabled,
            },
            layers=[
                lambda_.LayerVersion.from_layer_version_arn(self, "CommonLayer", self.layer_arn)
            ],
            description="Public listings API (reads DynamoDB; optional feature flag)",
            log_retention=logs.RetentionDays.ONE_WEEK,
        )

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
                    f"arn:aws:dynamodb:{self.region}:{self.account}:table/{self.table_name}/index/*",
                ],
            )
        )
