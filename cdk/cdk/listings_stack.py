from aws_cdk import (
    Stack, Duration,
    aws_lambda as _lambda,
    aws_events as events,
    aws_events_targets as targets,
    aws_dynamodb as ddb,
    aws_ssm as ssm,
    aws_secretsmanager as secrets,
    aws_kms as kms,
    aws_logs as logs,
)
from constructs import Construct

from config.guesty_lambda_env import guesty_lambda_env_from_client


class ListingsStack(Stack):
    def __init__(self, scope: Construct, cid: str, *, config: dict, **kw):
        super().__init__(scope, cid, **kw)

        # Extract configuration values
        client_name = config["cdk"]["client_name"]
        env_name = config["cdk"]["env_name"]

        table_name = ssm.StringParameter.value_for_string_parameter(
            self, f"/{client_name}/{env_name}/table/name"
        )
        layer_arn = ssm.StringParameter.value_for_string_parameter(
            self, f"/{client_name}/{env_name}/layers/commonArn"
        )

        kms_key_id = config["client"]["aws"].get("kmsKeyId")
        if kms_key_id:
            secrets_key = kms.Key.from_key_arn(
                self, "SecretsKey",
                key_arn=f"arn:aws:kms:{self.region}:{self.account}:key/{kms_key_id}",
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

        # --- Table & Layer ---
        table = ddb.Table.from_table_name(self, "AppTable", table_name)
        layer = _lambda.LayerVersion.from_layer_version_arn(self, "CommonLayer", layer_arn)

        # --- Lambda Function ---
        # Get environment-specific scaling settings
        lambda_config = config.get("environment", {}).get("scaling", {}).get("lambda", {})
        memory_size = lambda_config.get("memorySize", 256)
        timeout = lambda_config.get("timeout", 60)

        # Generate Lambda environment variables from configuration
        lambda_env_vars = self._get_lambda_environment_variables(config)
        lambda_env_vars.update({
            "APP_TABLE": table_name,
            "G4H_CRED_SECRET": creds_secret.secret_arn,
            "G4H_SESSION_SECRET": sess_secret.secret_arn,
        })

        fn = _lambda.Function(
            self, "ListingsSyncFn",
            function_name=f"{client_name}-{env_name}-lambda_listings_sync_g4h",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="handler.handler",
            code=_lambda.Code.from_asset("functions/listings"),
            timeout=Duration.seconds(timeout),
            memory_size=memory_size,
            layers=[layer],
            log_retention=logs.RetentionDays.ONE_WEEK,
            environment=lambda_env_vars,
        )

        # --- Permissions ---
        table.grant_read_write_data(fn)
        creds_secret.grant_read(fn)
        sess_secret.grant_read(fn)
        sess_secret.grant_write(fn)
        if secrets_key:
            secrets_key.grant(fn, "kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*", "kms:GenerateDataKey*")

        # --- Scheduler ---
        events.Rule(
            self, "ListingsSchedule",
            schedule=events.Schedule.rate(Duration.minutes(15))
        ).add_target(targets.LambdaFunction(fn))

        # Store references for other stacks
        self.function = fn

    def _get_lambda_environment_variables(self, config: dict) -> dict:
        """Generate Lambda environment variables from configuration"""
        client = config["client"]
        env_vars = {}
        env_vars.update(guesty_lambda_env_from_client(client))

        # Feature flags
        features = client.get("features", {})
        if "listings" in features:
            listings = features["listings"]
            env_vars["LISTINGS_SYNC_ENABLED"] = str(listings.get("syncEnabled", True)).lower()
            env_vars["PUBLIC_LISTINGS_ENABLED"] = str(listings.get("publicListings", False)).lower()

        # Client identification
        env_vars["CLIENT_NAME"] = client["name"]
        env_vars["CLIENT_DISPLAY_NAME"] = client["displayName"]

        return env_vars
