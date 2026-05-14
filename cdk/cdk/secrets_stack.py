import json
from aws_cdk import (
    Stack, Duration, SecretValue,
    aws_kms as kms,
    aws_secretsmanager as secrets,
    aws_ssm as ssm,
)
from constructs import Construct
from typing import Dict, Any


class SecretsStack(Stack):
    def __init__(self, scope: Construct, cid: str, *, config: dict, **kw):
        super().__init__(scope, cid, **kw)

        # Extract configuration values
        client_name = config["cdk"]["client_name"]
        env_name = config["cdk"]["env_name"]
        kms_key_id = config.get("client", {}).get("aws", {}).get("kmsKeyId")

        # KMS key for Secrets Manager
        if kms_key_id:
            # Use existing KMS key
            self.encryption_key = kms.Key.from_key_arn(
                self, "SecretsKey", f"arn:aws:kms:eu-central-1:669597026882:key/{kms_key_id}"
            )
        else:
            # Create new KMS key
            self.encryption_key = kms.Key(
                self, "SecretsKey",
                alias=f"alias/{client_name}-{env_name}-secrets",
                enable_key_rotation=True,
                pending_window=Duration.days(7),
                description=f"KMS key for {client_name} {env_name} secrets"
            )

        # Store secret ARNs for reference
        self.secret_arns = {}

        # Create all required secrets
        self._create_guesty_secrets(client_name, env_name)
        self._create_ttlock_secrets(client_name, env_name)
        self._create_qrlock_secrets(client_name, env_name)
        self._create_database_secrets(client_name, env_name)
        self._create_email_secrets(client_name, env_name)
        self._create_zoho_smtp_secrets(client_name, env_name)
        self._create_payment_secrets(client_name, env_name)
        self._create_external_api_secrets(client_name, env_name)

    def _create_secret(self, logical_id: str, secret_name: str, description: str,
                      default_value: Dict[str, Any]) -> secrets.Secret:
        """Create a secret with standardized configuration"""
        secret = secrets.Secret(
            self, logical_id,
            secret_name=secret_name,
            description=description,
            encryption_key=self.encryption_key,
            secret_string_value=SecretValue.unsafe_plain_text(
                json.dumps(default_value)
            ),
        )

        # Store ARN for reference
        self.secret_arns[logical_id] = secret.secret_arn

        return secret

    def _create_ssm_parameter(self, param_name: str, secret_arn: str):
        """Create SSM parameter for secret ARN"""
        ssm.StringParameter(
            self, f"Param{param_name.replace('/', '').replace('-', '')}",
            parameter_name=param_name,
            string_value=secret_arn,
            description=f"ARN for secret: {param_name}"
        )

    def _create_guesty_secrets(self, client_name: str, env_name: str):
        """Create Guesty for Hosts secrets"""
        # Guesty credentials
        g4h_creds = self._create_secret(
            "G4HCreds",
            f"{client_name}/{env_name}/guestyforhosts/creds",
            "Guesty for Hosts login credentials (email/password)",
            {"email": "", "password": ""}
        )

        # Guesty session cache
        g4h_session = self._create_secret(
            "G4HSession",
            f"{client_name}/{env_name}/guestyforhosts/webSession",
            "Guesty web session cache (utoken/stoken/cookies)",
            {}
        )

        # Create SSM parameters for cross-stack reference
        self._create_ssm_parameter(
            f"/{client_name}/{env_name}/secrets/guestyforhosts/creds/arn",
            g4h_creds.secret_arn
        )
        self._create_ssm_parameter(
            f"/{client_name}/{env_name}/secrets/guestyforhosts/webSession/arn",
            g4h_session.secret_arn
        )

    def _create_ttlock_secrets(self, client_name: str, env_name: str):
        """Create TTLock secrets"""
        # TTLock API credentials (correct structure)
        ttlock_creds = self._create_secret(
            "TTLockCreds",
            f"{client_name}/{env_name}/ttlock/credentials",
            "TTLock API credentials (username/password/app_id/app_secret)",
            {
                "username": "",
                "password": "",
                "app_id": "",
                "app_secret": "",
                "country_id": "67",
                "site_id": "2"
            }
        )

        # TTLock access token storage
        ttlock_token = self._create_secret(
            "TTLockToken",
            f"{client_name}/{env_name}/ttlock/token",
            "TTLock access token storage",
            {}
        )

        # Create SSM parameters
        self._create_ssm_parameter(
            f"/{client_name}/{env_name}/secrets/ttlock/credentials/arn",
            ttlock_creds.secret_arn
        )
        self._create_ssm_parameter(
            f"/{client_name}/{env_name}/secrets/ttlock/token/arn",
            ttlock_token.secret_arn
        )

    def _create_qrlock_secrets(self, client_name: str, env_name: str):
        """Create QRLock secrets"""
        # QRLock API credentials (correct secret name)
        qrlock_creds = self._create_secret(
            "QRLockCreds",
            f"{client_name}/{env_name}/qrlock/credentials",
            "QRLock API credentials (email/password)",
            {"email": "", "password": ""}
        )

        # QRLock access token storage
        qrlock_token = self._create_secret(
            "QRLockToken",
            f"{client_name}/{env_name}/qrlock/token",
            "QRLock access token storage",
            {}
        )

        # Create SSM parameters
        self._create_ssm_parameter(
            f"/{client_name}/{env_name}/secrets/qrlock/credentials/arn",
            qrlock_creds.secret_arn
        )
        self._create_ssm_parameter(
            f"/{client_name}/{env_name}/secrets/qrlock/token/arn",
            qrlock_token.secret_arn
        )

    def _create_database_secrets(self, client_name: str, env_name: str):
        """Create database secrets"""
        db_encryption = self._create_secret(
            "DatabaseEncryption",
            f"{client_name}/{env_name}/database/encryption-key",
            "Database encryption key",
            {"key": ""}
        )

        self._create_ssm_parameter(
            f"/{client_name}/{env_name}/secrets/database/encryption-key/arn",
            db_encryption.secret_arn
        )

    def _create_email_secrets(self, client_name: str, env_name: str):
        """Create email service secrets"""
        # SMTP credentials
        smtp_creds = self._create_secret(
            "SMTPCreds",
            f"{client_name}/{env_name}/email/smtp-credentials",
            "SMTP email service credentials",
            {"host": "", "port": 587, "username": "", "password": ""}
        )

        # Email API keys
        email_apis = self._create_secret(
            "EmailAPIs",
            f"{client_name}/{env_name}/email/api-keys",
            "Email service API keys (SendGrid, SES, etc.)",
            {"sendgrid": "", "ses": ""}
        )

        # Create SSM parameters
        self._create_ssm_parameter(
            f"/{client_name}/{env_name}/secrets/email/smtp-credentials/arn",
            smtp_creds.secret_arn
        )
        self._create_ssm_parameter(
            f"/{client_name}/{env_name}/secrets/email/api-keys/arn",
            email_apis.secret_arn
        )

    def _create_zoho_smtp_secrets(self, client_name: str, env_name: str):
        """Create Zoho SMTP credentials"""
        zoho_smtp = self._create_secret(
            "ZohoSMTP",
            f"{client_name}/{env_name}/email/zoho-smtp",
            "Zoho SMTP credentials for sending emails",
            {
                "host": "smtppro.zoho.eu",
                "port": "465",
                "username": "noreplay@harmonest.de",
                "password": "1eSTQsy5KGQ9",
                "from_email": "noreplay@harmonest.de",
                "from_name": "Harmonest"
            }
        )

        # Create SSM parameter
        self._create_ssm_parameter(
            f"/{client_name}/{env_name}/secrets/email/zoho-smtp/arn",
            zoho_smtp.secret_arn
        )

    def _create_payment_secrets(self, client_name: str, env_name: str):
        """Create payment service secrets"""
        # Stripe credentials
        stripe_creds = self._create_secret(
            "StripeCreds",
            f"{client_name}/{env_name}/payment/stripe",
            "Stripe payment credentials",
            {"publishableKey": "", "secretKey": "", "webhookSecret": ""}
        )

        # PayPal credentials
        paypal_creds = self._create_secret(
            "PayPalCreds",
            f"{client_name}/{env_name}/payment/paypal",
            "PayPal payment credentials",
            {"clientId": "", "clientSecret": ""}
        )

        # Create SSM parameters
        self._create_ssm_parameter(
            f"/{client_name}/{env_name}/secrets/payment/stripe/arn",
            stripe_creds.secret_arn
        )
        self._create_ssm_parameter(
            f"/{client_name}/{env_name}/secrets/payment/paypal/arn",
            paypal_creds.secret_arn
        )

    def _create_external_api_secrets(self, client_name: str, env_name: str):
        """Create external API secrets"""
        # Google Maps API
        maps_creds = self._create_secret(
            "GoogleMapsCreds",
            f"{client_name}/{env_name}/external-apis/google-maps",
            "Google Maps API credentials",
            {"apiKey": "", "publicApiKey": ""}
        )

        # Analytics credentials
        analytics_creds = self._create_secret(
            "AnalyticsCreds",
            f"{client_name}/{env_name}/external-apis/analytics",
            "Analytics service credentials",
            {"googleAnalytics": "", "mixpanel": "", "hotjar": ""}
        )

        # SMS service credentials
        sms_creds = self._create_secret(
            "SMSCreds",
            f"{client_name}/{env_name}/external-apis/sms",
            "SMS service credentials (Twilio, etc.)",
            {"twilio": {"accountSid": "", "authToken": "", "phoneNumber": ""}}
        )

        # Create SSM parameters
        self._create_ssm_parameter(
            f"/{client_name}/{env_name}/secrets/external-apis/google-maps/arn",
            maps_creds.secret_arn
        )
        self._create_ssm_parameter(
            f"/{client_name}/{env_name}/secrets/external-apis/analytics/arn",
            analytics_creds.secret_arn
        )
        self._create_ssm_parameter(
            f"/{client_name}/{env_name}/secrets/external-apis/sms/arn",
            sms_creds.secret_arn
        )
