from aws_cdk import (
    Stack,
    Duration,
    aws_apigateway as apigw,
    aws_ssm as ssm,
    aws_logs as logs,
    aws_lambda as _lambda,
)
from constructs import Construct


class ApiStack(Stack):
    def __init__(self, scope: Construct, cid: str, *, config: dict, **kw):
        super().__init__(scope, cid, **kw)

        # Extract configuration values
        client_name = config["cdk"]["client_name"]
        env_name = config["cdk"]["env_name"]
        display_name = config["client"]["displayName"]

        # Create REST API Gateway
        api = apigw.RestApi(
            self, f"{client_name.title()}Api",
            rest_api_name=f"{client_name}-{env_name}-api",
            description=f"{display_name} API Gateway for {env_name} environment",
            # Enable CORS for all origins (can be restricted later)
            default_cors_preflight_options=apigw.CorsOptions(
                allow_origins=self._get_cors_origins(config),
                allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                allow_headers=[
                    "Content-Type",
                    "X-Amz-Date",
                    "Authorization",
                    "X-Api-Key",
                    "X-Amz-Security-Token",
                    "X-Amz-User-Agent"
                ],
                max_age=Duration.minutes(10),
            ),
            # Enable CloudWatch logging
            cloud_watch_role=True,
            deploy_options=apigw.StageOptions(
                stage_name=env_name,
                # Enable access logging
                access_log_destination=apigw.LogGroupLogDestination(
                    logs.LogGroup(
                        self, "ApiAccessLogs",
                        log_group_name=f"/aws/apigateway/{client_name}-{env_name}-api",
                        retention=logs.RetentionDays.ONE_WEEK,
                    )
                ),
                access_log_format=apigw.AccessLogFormat.json_with_standard_fields(
                    caller=True,
                    http_method=True,
                    ip=True,
                    protocol=True,
                    request_time=True,
                    resource_path=True,
                    response_length=True,
                    status=True,
                    user=True,
                ),
                # Enable detailed CloudWatch metrics
                metrics_enabled=True,
                logging_level=apigw.MethodLoggingLevel.INFO,
                data_trace_enabled=True,
                # Throttling settings
                throttling_rate_limit=1000,
                throttling_burst_limit=2000,
            ),
        )

        # Create /checkin resource for check-in functionality
        checkin_resource = api.root.add_resource("checkin")

        # Create /admin resource for authenticated management operations
        admin_resource = api.root.add_resource("admin")
        resend_door_access_resource = admin_resource.add_resource("resend-door-access")

        # Create /public resource for public endpoints
        public_resource = api.root.add_resource("public")

        # Create /public/listings resource for public listings access
        public_listings_resource = public_resource.add_resource("listings")
        public_listing_resource = public_listings_resource.add_resource("{listingId}")
        public_listings_search_resource = public_listings_resource.add_resource("search")

        # Publish API information for other stacks
        ssm.StringParameter(
            self, "ApiGatewayId",
            parameter_name=f"/{client_name}/{env_name}/api/id",
            string_value=api.rest_api_id,
        )

        ssm.StringParameter(
            self, "ApiGatewayRootResourceId",
            parameter_name=f"/{client_name}/{env_name}/api/rootResourceId",
            string_value=api.rest_api_root_resource_id,
        )

        ssm.StringParameter(
            self, "ApiGatewayUrl",
            parameter_name=f"/{client_name}/{env_name}/api/url",
            string_value=api.url,
        )

        ssm.StringParameter(
            self, "CheckinResourceId",
            parameter_name=f"/{client_name}/{env_name}/api/checkinResourceId",
            string_value=checkin_resource.resource_id,
        )

        ssm.StringParameter(
            self, "PublicListingsResourceId",
            parameter_name=f"/{client_name}/{env_name}/api/publicListingsResourceId",
            string_value=public_listings_resource.resource_id,
        )

        ssm.StringParameter(
            self, "PublicListingResourceId",
            parameter_name=f"/{client_name}/{env_name}/api/publicListingResourceId",
            string_value=public_listing_resource.resource_id,
        )

        ssm.StringParameter(
            self, "PublicListingsSearchResourceId",
            parameter_name=f"/{client_name}/{env_name}/api/publicListingsSearchResourceId",
            string_value=public_listings_search_resource.resource_id,
        )

        # Public listings Lambda (deploy PublicListings stack first; stable function name)
        public_listings_fn_arn = (
            f"arn:aws:lambda:{self.region}:{self.account}:function:"
            f"{client_name}-{env_name}-lambda_public_listings"
        )
        public_listings_fn = _lambda.Function.from_function_arn(
            self,
            "PublicListingsLambda",
            public_listings_fn_arn,
        )
        public_listings_integration = apigw.LambdaIntegration(
            public_listings_fn,
            proxy=True,
        )
        public_listings_resource.add_method("GET", public_listings_integration)
        public_listing_resource.add_method("GET", public_listings_integration)
        public_listings_search_resource.add_method("POST", public_listings_integration)

        # Wire admin resend-door-access endpoint to access notification Lambda
        access_fn_arn = f"arn:aws:lambda:{self.region}:{self.account}:function:harmonest-{env_name}-lambda_access_notification"
        access_fn = _lambda.Function.from_function_arn(
            self,
            "AccessNotificationLambdaForAdmin",
            access_fn_arn,
        )

        resend_integration = apigw.LambdaIntegration(
            access_fn,
            proxy=True,
        )

        resend_door_access_resource.add_method(
            "POST",
            resend_integration,
        )

        # Store references for other stacks
        self.api = api
        self.checkin_resource = checkin_resource
        self.public_resource = public_resource
        self.public_listings_resource = public_listings_resource
        self.public_listing_resource = public_listing_resource
        self.public_listings_search_resource = public_listings_search_resource

    def _get_cors_origins(self, config: dict) -> list:
        """Generate CORS origins from client configuration"""
        domains = config["client"]["domains"]
        origins = []

        # Add primary domains
        if "primary" in domains:
            primary = domains["primary"]
            origins.extend([
                f"https://{primary}",
                f"https://www.{primary}",
                f"https://checkin.{primary}",
                f"https://www.checkin.{primary}",
            ])

        # Add www domain if specified
        if "www" in domains:
            origins.append(f"https://{domains['www']}")

        # Add dev domain if specified
        if "dev" in domains:
            dev = domains["dev"]
            origins.extend([
                f"https://{dev}",
                f"https://www.{dev}",
                f"https://checkin.{dev}",
                f"https://www.checkin.{dev}",
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
