from aws_cdk import (
    Stack, Duration, RemovalPolicy,
    aws_s3 as s3,
    aws_ssm as ssm,
)
from constructs import Construct


class S3Stack(Stack):
    def __init__(self, scope: Construct, cid: str, *, config: dict, **kw):
        super().__init__(scope, cid, **kw)

        # Extract configuration values
        client_name = config["cdk"]["client_name"]
        env_name = config["cdk"]["env_name"]

        # Generate bucket name using client configuration
        if env_name == "prod":
            bucket_name = f"{client_name}-storage"
        else:
            bucket_name = f"{client_name}-{env_name}-storage"

        # Create S3 bucket for document storage
        bucket = s3.Bucket(
            self, "StorageBucket",
            bucket_name=bucket_name,
            # Enable versioning for better data protection
            versioned=True,
            # Block all public access by default
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            # Retain bucket on stack deletion (contains user data)
            removal_policy=RemovalPolicy.RETAIN,
            # Enable server-side encryption
            encryption=s3.BucketEncryption.S3_MANAGED,
            # CORS configuration for potential frontend uploads
            cors=[
                s3.CorsRule(
                    allowed_methods=[s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
                    allowed_origins=self._get_cors_origins(config),
                    allowed_headers=["*"],
                    max_age=3000,
                )
            ],
        )

        # Lifecycle rule for reservation documents (2-month deletion)
        bucket.add_lifecycle_rule(
            id="ReservationDocumentsCleanup",
            prefix="private/reservations/",
            expiration=Duration.days(60),  # 2 months
            enabled=True,
        )

        # Lifecycle rule for temporary uploads (1-day cleanup)
        bucket.add_lifecycle_rule(
            id="TempUploadsCleanup", 
            prefix="temp/",
            expiration=Duration.days(1),
            enabled=True,
        )

        # Lifecycle rule for incomplete multipart uploads
        bucket.add_lifecycle_rule(
            id="IncompleteMultipartUploads",
            abort_incomplete_multipart_upload_after=Duration.days(1),
            enabled=True,
        )

        # Publish bucket information for other stacks
        ssm.StringParameter(
            self, "StorageBucketName",
            parameter_name=f"/{client_name}/{env_name}/s3/bucketName",
            string_value=bucket.bucket_name,
        )

        ssm.StringParameter(
            self, "StorageBucketArn",
            parameter_name=f"/{client_name}/{env_name}/s3/bucketArn",
            string_value=bucket.bucket_arn,
        )

        # Store bucket reference for other stacks to use
        self.bucket = bucket

    def _get_cors_origins(self, config: dict) -> list:
        """Generate CORS origins from client configuration"""
        domains = config["client"]["domains"]
        origins = []

        # Add primary domains
        if "primary" in domains:
            origins.extend([
                f"https://{domains['primary']}",
                f"https://www.{domains['primary']}"
            ])

        # Add www domain if specified
        if "www" in domains:
            origins.append(f"https://{domains['www']}")

        # Add dev domain if specified
        if "dev" in domains:
            origins.extend([
                f"https://{domains['dev']}",
                f"https://www.{domains['dev']}"
            ])

        # Add staging domain if specified
        if "staging" in domains:
            origins.append(f"https://{domains['staging']}")

        # Add additional domains
        if "additional" in domains:
            for domain in domains["additional"]:
                origins.append(f"https://{domain}")

        # Add localhost for development
        origins.extend([
            "http://localhost:4200",
            "http://localhost:3000",
            "http://localhost:8080"
        ])

        return list(set(origins))  # Remove duplicates
