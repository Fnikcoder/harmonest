#!/usr/bin/env python3
import os
import sys
from pathlib import Path
import aws_cdk as cdk

# Add config directory to Python path
config_dir = Path(__file__).parent / "config"
sys.path.insert(0, str(config_dir))

from config.cdk_config import get_cdk_config, CDKConfigHelper
from cdk.core_stack import CoreStack
from cdk.layer_stack import LayerStack
from cdk.listings_stack import ListingsStack
from cdk.reservations_stack import ReservationsStack
from cdk.secrets_stack import SecretsStack
from cdk.s3_stack import S3Stack
from cdk.api_stack import ApiStack
from cdk.checkin_stack import CheckinStack
from cdk.public_listings_stack import PublicListingsStack
from cdk.user_management_stack import UserManagementStack
from cdk.access_notification_stack import AccessNotificationStack
from cdk.email_verification_stack import EmailVerificationStack

# from cdk.ses_stack import SESStack

app = cdk.App()

# Get client configuration
try:
    config = get_cdk_config(app)
    client_name = config["cdk"]["client_name"]
    env_name = config["cdk"]["env_name"]
    stack_prefix = config["cdk"]["stack_prefix"]

    print(f"Deploying for client: {client_name}")
    print(f"Environment: {env_name}")
    print(f"Stack prefix: {stack_prefix}")

except Exception as e:
    print(f"Error loading configuration: {e}")
    print("Usage: cdk deploy --context client=<client-name> --context env=<environment>")
    print("Available clients can be found in config/clients/")
    sys.exit(1)

# Set up CDK environment
env = cdk.Environment(
    account=config["client"]["aws"].get("accountId") or os.getenv("CDK_DEFAULT_ACCOUNT"),
    region=config["client"]["aws"]["region"],
)

# Create CDK helper for generating stack names
helper = CDKConfigHelper()

# Create stacks with dynamic names
core = CoreStack(
    app,
    helper.get_stack_name(client_name, env_name, "Core"),
    env=env,
    config=config
)

layer = LayerStack(
    app,
    helper.get_stack_name(client_name, env_name, "Layer"),
    env=env,
    config=config
)

secrets = SecretsStack(
    app,
    helper.get_stack_name(client_name, env_name, "Secrets"),
    env=env,
    config=config
)

s3 = S3Stack(
    app,
    helper.get_stack_name(client_name, env_name, "S3"),
    env=env,
    config=config
)

api = ApiStack(
    app,
    helper.get_stack_name(client_name, env_name, "Api"),
    env=env,
    config=config
)

listings = ListingsStack(
    app,
    helper.get_stack_name(client_name, env_name, "Listings"),
    env=env,
    config=config
)

reservations = ReservationsStack(
    app,
    helper.get_stack_name(client_name, env_name, "Reservations"),
    env=env,
    config=config
)

checkin = CheckinStack(
    app,
    helper.get_stack_name(client_name, env_name, "Checkin"),
    env=env,
    config=config
)

access_notification = AccessNotificationStack(
    app,
    helper.get_stack_name(client_name, env_name, "AccessNotification"),
    env=env,
    config=config,
)

public_listings = PublicListingsStack(app, f"HarmonestPublicListings-{env_name}", env=env, env_name=env_name)
user_management = UserManagementStack(app, f"HarmonestUserManagement-{env_name}", env=env, env_name=env_name)

email_verification = EmailVerificationStack(
    app,
    helper.get_stack_name(client_name, env_name, "EmailVerification"),
    env=env,
    config=config
)

# Note: Additional stacks temporarily commented out until dependencies are resolved
# ses = SESStack(app, f"HarmonestSES-{env_name}", env=env, env_name=env_name)

# Core infrastructure dependencies
s3.add_dependency(core)
api.add_dependency(core)

# Service dependencies
listings.add_dependency(core)
listings.add_dependency(layer)
listings.add_dependency(secrets)

reservations.add_dependency(core)
reservations.add_dependency(layer)
reservations.add_dependency(secrets)

checkin.add_dependency(core)
checkin.add_dependency(layer)
checkin.add_dependency(secrets)
checkin.add_dependency(s3)
checkin.add_dependency(api)

access_notification.add_dependency(core)
access_notification.add_dependency(layer)
access_notification.add_dependency(secrets)

public_listings.add_dependency(core)
public_listings.add_dependency(layer)
public_listings.add_dependency(api)

user_management.add_dependency(core)
user_management.add_dependency(layer)

email_verification.add_dependency(core)
email_verification.add_dependency(layer)
email_verification.add_dependency(secrets)
email_verification.add_dependency(api)

# Note: Additional stack dependencies commented out until stacks are implemented
# ses.add_dependency(core)

app.synth()




