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
            self, f"/harmonest/{env_name}/layers/commonArn"
        )

        # --- KMS Key for Secrets ---
        secrets_key = kms.Key.from_key_arn(
            self, "SecretsKey",
            key_arn="arn:aws:kms:eu-central-1:669597026882:key/fba5ed5b-43a6-40cf-9545-7828da6bfcdb"
        )

        # --- Credentials Secret ---
        creds_arn = ssm.StringParameter.value_for_string_parameter(
            self, f"/harmonest/{env_name}/secrets/guestyforhosts/creds/arn"
        )
        creds_secret = secrets.Secret.from_secret_complete_arn(
            self, "G4HCreds", creds_arn
        )

        # --- Session Secret ---
        sess_arn = ssm.StringParameter.value_for_string_parameter(
            self, f"/harmonest/{env_name}/secrets/guestyforhosts/webSession/arn"
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
        # Grant comprehensive KMS permissions for secret encryption/decryption
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

        # G4H integration settings
        if "integrations" in client and "g4h" in client["integrations"]:
            g4h = client["integrations"]["g4h"]
            env_vars.update({
                "G4H_ORIGIN": g4h.get("origin", "https://app.guestyforhosts.com"),
                "G4H_APP_VERSION": g4h.get("appVersion", "6.x"),
                "G4H_PLATFORM": g4h.get("platform", "browser--win32"),
                "G4H_DEVICE_UUID": g4h.get("deviceUuid", f"ypa-uuid-{client['name']}")
            })
        else:
            # Default values if not configured
            env_vars.update({
                "G4H_ORIGIN": "https://app.guestyforhosts.com",
                "G4H_APP_VERSION": "6.x",
                "G4H_PLATFORM": "browser--win32",
                "G4H_DEVICE_UUID": f"ypa-uuid-{client['name']}"
            })

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
