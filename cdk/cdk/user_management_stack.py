"""
User Management Stack - AWS Cognito with Role-Based Access Control
Aligned with existing Harmonest infrastructure
"""
from aws_cdk import (
    Stack,
    aws_cognito as cognito,
    aws_iam as iam,
    aws_lambda as lambda_,
    aws_apigateway as apigateway,
    aws_ssm as ssm,
    aws_logs as logs,
    custom_resources as cr,
    Duration,
    RemovalPolicy,
)
from constructs import Construct
import os


class UserManagementStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, env_name: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        self.env_name = env_name

        # Get references from existing infrastructure
        self.table_name = ssm.StringParameter.value_for_string_parameter(
            self, f"/harmonest/{env_name}/table/name"
        )
        self.layer_arn = ssm.StringParameter.value_for_string_parameter(
            self, f"/harmonest/{env_name}/layers/commonArn"
        )
        
        # Create Cognito User Pool
        self.user_pool = cognito.UserPool(
            self, f"HarmonestUserPool-{env_name}",
            user_pool_name=f"harmonest-users-{env_name}",
            
            # Sign-in configuration
            sign_in_aliases=cognito.SignInAliases(
                email=True,
                username=False,
                phone=False
            ),
            
            # Self sign-up configuration
            self_sign_up_enabled=True,  # Allow guest registration
            
            # Email verification
            user_verification=cognito.UserVerificationConfig(
                email_subject="Harmonest - Verify your email",
                email_body="Welcome to Harmonest! Your verification code is {####}",
                email_style=cognito.VerificationEmailStyle.CODE,
            ),
            
            # Password policy
            password_policy=cognito.PasswordPolicy(
                min_length=8,
                require_lowercase=True,
                require_uppercase=True,
                require_digits=True,
                require_symbols=True,
            ),
            
            # Account recovery
            account_recovery=cognito.AccountRecovery.EMAIL_ONLY,
            
            # Advanced security
            advanced_security_mode=cognito.AdvancedSecurityMode.ENFORCED,
            
            # Removal policy
            removal_policy=RemovalPolicy.RETAIN if env_name == "prod" else RemovalPolicy.DESTROY,
        )
        
        # Create User Groups for Role-Based Access Control
        self.create_user_groups()
        
        # Create User Pool Client for web applications
        self.user_pool_client = cognito.UserPoolClient(
            self, f"HarmonestUserPoolClient-{env_name}",
            user_pool=self.user_pool,
            user_pool_client_name=f"harmonest-web-client-{env_name}",
            
            # Authentication flows
            auth_flows=cognito.AuthFlow(
                user_password=True,
                user_srp=True,
                admin_user_password=True,  # For admin operations
            ),
            
            # Token validity
            access_token_validity=Duration.hours(1),
            id_token_validity=Duration.hours(1),
            refresh_token_validity=Duration.days(30),
            
            # OAuth settings
            o_auth=cognito.OAuthSettings(
                flows=cognito.OAuthFlows(
                    authorization_code_grant=True,
                    implicit_code_grant=False,
                ),
                scopes=[
                    cognito.OAuthScope.EMAIL,
                    cognito.OAuthScope.OPENID,
                    cognito.OAuthScope.PROFILE,
                ],
                callback_urls=[
                    "https://harmonest.de/auth/callback",
                    "https://www.harmonest.de/auth/callback",
                    "https://checkin.harmonest.de/auth/callback",
                    "https://www.checkin.harmonest.de/auth/callback",
                    "https://dev.harmonest.de/auth/callback",
                    "http://localhost:4200/auth/callback",  # Development
                ],
                logout_urls=[
                    "https://harmonest.de/auth/logout",
                    "https://www.harmonest.de/auth/logout",
                    "https://checkin.harmonest.de/auth/logout",
                    "https://www.checkin.harmonest.de/auth/logout",
                    "https://dev.harmonest.de/auth/logout",
                    "http://localhost:4200/auth/logout",
                ],
            ),
            
            # Prevent user existence errors
            prevent_user_existence_errors=True,
        )
        
        # Create Identity Pool for AWS resource access
        self.identity_pool = cognito.CfnIdentityPool(
            self, f"HarmonestIdentityPool-{env_name}",
            identity_pool_name=f"harmonest_identity_pool_{env_name}",
            allow_unauthenticated_identities=False,
            cognito_identity_providers=[
                cognito.CfnIdentityPool.CognitoIdentityProviderProperty(
                    client_id=self.user_pool_client.user_pool_client_id,
                    provider_name=self.user_pool.user_pool_provider_name,
                )
            ],
        )
        
        # Create IAM roles for different user types
        self.create_iam_roles()
        
        # Create Lambda Authorizer for fine-grained permissions
        self.create_lambda_authorizer()

        # Create admin user initialization function and run it
        self.create_admin_user_initialization()
    
    def create_user_groups(self):
        """Create Cognito User Groups for role-based access"""
        
        # Owner Group - Full system access
        self.owner_group = cognito.CfnUserPoolGroup(
            self, "OwnerGroup",
            user_pool_id=self.user_pool.user_pool_id,
            group_name="owner",
            description="System owners with full access",
            precedence=1,  # Highest precedence
        )
        
        # Super Admin Group - Administrative access to AWS resources
        self.super_admin_group = cognito.CfnUserPoolGroup(
            self, "SuperAdminGroup", 
            user_pool_id=self.user_pool.user_pool_id,
            group_name="super_admin",
            description="Super administrators with AWS resource access",
            precedence=2,
        )
        
        # Admin Group - User management and configuration
        self.admin_group = cognito.CfnUserPoolGroup(
            self, "AdminGroup",
            user_pool_id=self.user_pool.user_pool_id,
            group_name="admin", 
            description="Administrators with user management access",
            precedence=3,
        )
        
        # Support Group - Read-only access for customer support
        self.support_group = cognito.CfnUserPoolGroup(
            self, "SupportGroup",
            user_pool_id=self.user_pool.user_pool_id,
            group_name="support",
            description="Support staff with read-only access",
            precedence=4,
        )
        
        # Guest Group - Basic user access
        self.guest_group = cognito.CfnUserPoolGroup(
            self, "GuestGroup",
            user_pool_id=self.user_pool.user_pool_id,
            group_name="guest",
            description="Regular guests with basic access",
            precedence=5,  # Lowest precedence
        )
    
    def create_iam_roles(self):
        """Create IAM roles for different access levels"""
        
        # Owner Role - Full access
        self.owner_role = iam.Role(
            self, "OwnerRole",
            assumed_by=iam.FederatedPrincipal(
                "cognito-identity.amazonaws.com",
                conditions={
                    "StringEquals": {
                        "cognito-identity.amazonaws.com:aud": self.identity_pool.ref
                    },
                    "ForAnyValue:StringLike": {
                        "cognito-identity.amazonaws.com:amr": "authenticated"
                    }
                },
                assume_role_action="sts:AssumeRoleWithWebIdentity"
            ),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name("PowerUserAccess")
            ]
        )
        
        # Super Admin Role - DynamoDB and S3 access
        self.super_admin_role = iam.Role(
            self, "SuperAdminRole",
            assumed_by=iam.FederatedPrincipal(
                "cognito-identity.amazonaws.com",
                conditions={
                    "StringEquals": {
                        "cognito-identity.amazonaws.com:aud": self.identity_pool.ref
                    }
                },
                assume_role_action="sts:AssumeRoleWithWebIdentity"
            ),
            inline_policies={
                "SuperAdminPolicy": iam.PolicyDocument(
                    statements=[
                        # DynamoDB access
                        iam.PolicyStatement(
                            effect=iam.Effect.ALLOW,
                            actions=[
                                "dynamodb:GetItem",
                                "dynamodb:PutItem", 
                                "dynamodb:UpdateItem",
                                "dynamodb:DeleteItem",
                                "dynamodb:Query",
                                "dynamodb:Scan",
                                "dynamodb:BatchGetItem",
                                "dynamodb:BatchWriteItem",
                            ],
                            resources=[
                                f"arn:aws:dynamodb:{self.region}:{self.account}:table/{self.table_name}",
                                f"arn:aws:dynamodb:{self.region}:{self.account}:table/{self.table_name}/index/*"
                            ]
                        ),
                        # S3 access
                        iam.PolicyStatement(
                            effect=iam.Effect.ALLOW,
                            actions=[
                                "s3:GetObject",
                                "s3:PutObject",
                                "s3:DeleteObject",
                                "s3:ListBucket",
                            ],
                            resources=[
                                f"arn:aws:s3:::harmonest-*",
                                f"arn:aws:s3:::harmonest-*/*"
                            ]
                        ),
                        # CloudWatch Logs
                        iam.PolicyStatement(
                            effect=iam.Effect.ALLOW,
                            actions=[
                                "logs:DescribeLogGroups",
                                "logs:DescribeLogStreams",
                                "logs:GetLogEvents",
                            ],
                            resources=["*"]
                        ),
                    ]
                )
            }
        )
        
        # Admin Role - User management
        self.admin_role = iam.Role(
            self, "AdminRole",
            assumed_by=iam.FederatedPrincipal(
                "cognito-identity.amazonaws.com",
                conditions={
                    "StringEquals": {
                        "cognito-identity.amazonaws.com:aud": self.identity_pool.ref
                    }
                },
                assume_role_action="sts:AssumeRoleWithWebIdentity"
            ),
            inline_policies={
                "AdminPolicy": iam.PolicyDocument(
                    statements=[
                        # Cognito user management
                        iam.PolicyStatement(
                            effect=iam.Effect.ALLOW,
                            actions=[
                                "cognito-idp:AdminGetUser",
                                "cognito-idp:AdminUpdateUserAttributes",
                                "cognito-idp:AdminAddUserToGroup",
                                "cognito-idp:AdminRemoveUserFromGroup",
                                "cognito-idp:ListUsers",
                                "cognito-idp:ListUsersInGroup",
                            ],
                            resources=[self.user_pool.user_pool_arn]
                        ),
                        # Limited DynamoDB access
                        iam.PolicyStatement(
                            effect=iam.Effect.ALLOW,
                            actions=[
                                "dynamodb:GetItem",
                                "dynamodb:Query",
                                "dynamodb:Scan",
                            ],
                            resources=[
                                f"arn:aws:dynamodb:{self.region}:{self.account}:table/{self.table_name}",
                                f"arn:aws:dynamodb:{self.region}:{self.account}:table/{self.table_name}/index/*"
                            ]
                        ),
                    ]
                )
            }
        )
        
        # Support Role - Read-only access
        self.support_role = iam.Role(
            self, "SupportRole",
            assumed_by=iam.FederatedPrincipal(
                "cognito-identity.amazonaws.com",
                conditions={
                    "StringEquals": {
                        "cognito-identity.amazonaws.com:aud": self.identity_pool.ref
                    }
                },
                assume_role_action="sts:AssumeRoleWithWebIdentity"
            ),
            inline_policies={
                "SupportPolicy": iam.PolicyDocument(
                    statements=[
                        # Read-only DynamoDB access
                        iam.PolicyStatement(
                            effect=iam.Effect.ALLOW,
                            actions=[
                                "dynamodb:GetItem",
                                "dynamodb:Query",
                                "dynamodb:Scan",
                            ],
                            resources=[
                                f"arn:aws:dynamodb:{self.region}:{self.account}:table/{self.table_name}",
                                f"arn:aws:dynamodb:{self.region}:{self.account}:table/{self.table_name}/index/*"
                            ]
                        ),
                        # Read-only S3 access
                        iam.PolicyStatement(
                            effect=iam.Effect.ALLOW,
                            actions=[
                                "s3:GetObject",
                                "s3:ListBucket",
                            ],
                            resources=[
                                "arn:aws:s3:::harmonest-*",
                                "arn:aws:s3:::harmonest-*/*"
                            ]
                        ),
                    ]
                )
            }
        )
        
        # Guest Role - Minimal access
        self.guest_role = iam.Role(
            self, "GuestRole",
            assumed_by=iam.FederatedPrincipal(
                "cognito-identity.amazonaws.com",
                conditions={
                    "StringEquals": {
                        "cognito-identity.amazonaws.com:aud": self.identity_pool.ref
                    }
                },
                assume_role_action="sts:AssumeRoleWithWebIdentity"
            ),
            inline_policies={
                "GuestPolicy": iam.PolicyDocument(
                    statements=[
                        # Very limited DynamoDB access (own data only)
                        iam.PolicyStatement(
                            effect=iam.Effect.ALLOW,
                            actions=[
                                "dynamodb:GetItem",
                                "dynamodb:Query",
                            ],
                            resources=[
                                f"arn:aws:dynamodb:{self.region}:{self.account}:table/{self.table_name}",
                                f"arn:aws:dynamodb:{self.region}:{self.account}:table/{self.table_name}/index/*"
                            ],
                            conditions={
                                "ForAllValues:StringEquals": {
                                    "dynamodb:LeadingKeys": ["${cognito-identity.amazonaws.com:sub}"]
                                }
                            }
                        ),
                    ]
                )
            }
        )

        # Configure role mappings for Identity Pool
        self.configure_identity_pool_roles()

    def configure_identity_pool_roles(self):
        """Configure role mappings for Identity Pool based on Cognito groups"""

        # Create role attachment for Identity Pool
        self.role_attachment = cognito.CfnIdentityPoolRoleAttachment(
            self, "IdentityPoolRoleAttachment",
            identity_pool_id=self.identity_pool.ref,
            roles={
                "authenticated": self.guest_role.role_arn  # Default role for authenticated users
            },
            # Note: Role mappings will be configured manually after deployment
            # due to CDK token resolution issues with dynamic keys
        )

        # Export Identity Pool ID for frontend use
        ssm.StringParameter(
            self, "IdentityPoolId",
            parameter_name=f"/harmonest/{self.env_name}/cognito/identity-pool-id",
            string_value=self.identity_pool.ref,
        )

    def create_lambda_authorizer(self):
        """Create Lambda authorizer for fine-grained permissions"""

        # Lambda Authorizer Function
        self.authorizer_function = lambda_.Function(
            self, f"AuthorizerFunction-{self.env_name}",
            function_name=f"harmonest-{self.env_name}-lambda_authorizer",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="simple_authorizer.handler",
            code=lambda_.Code.from_asset("functions/auth"),
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={
                "USER_POOL_ID": self.user_pool.user_pool_id,
                "USER_POOL_CLIENT_ID": self.user_pool_client.user_pool_client_id,
                "COGNITO_REGION": self.region,
            },
            layers=[
                lambda_.LayerVersion.from_layer_version_arn(
                    self, "AuthCommonLayer", self.layer_arn
                )
            ],
            description="JWT token authorizer with role-based permissions"
        )

        # User Management Function
        self.user_management_function = lambda_.Function(
            self, f"UserManagementFunction-{self.env_name}",
            function_name=f"harmonest-{self.env_name}-lambda_user_management",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="simple_user_management.handler",
            code=lambda_.Code.from_asset("functions/auth"),
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={
                "USER_POOL_ID": self.user_pool.user_pool_id,
                "APP_TABLE": self.table_name,
            },
            layers=[
                lambda_.LayerVersion.from_layer_version_arn(
                    self, "UserMgmtCommonLayer", self.layer_arn
                )
            ],
            description="User management operations"
        )

        # Grant permissions to user management function
        self.user_management_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-idp:AdminGetUser",
                    "cognito-idp:AdminCreateUser",
                    "cognito-idp:AdminUpdateUserAttributes",
                    "cognito-idp:AdminEnableUser",
                    "cognito-idp:AdminDisableUser",
                    "cognito-idp:AdminAddUserToGroup",
                    "cognito-idp:AdminRemoveUserFromGroup",
                    "cognito-idp:AdminListGroupsForUser",
                    "cognito-idp:ListUsers",
                    "cognito-idp:ListUsersInGroup",
                ],
                resources=[self.user_pool.user_pool_arn]
            )
        )

        # Create API Gateway with authorizer
        self.create_api_gateway()

        # Export authorizer function for use in other stacks
        self.authorizer_function_arn = self.authorizer_function.function_arn

        # Export values for other stacks
        self.export_values()

    def create_api_gateway(self):
        """Create API Gateway with Lambda authorizer"""

        # Create API Gateway
        self.api = apigateway.RestApi(
            self, f"UserManagementApi-{self.env_name}",
            rest_api_name=f"harmonest-user-management-{self.env_name}",
            description="User management API with role-based access control",
            default_cors_preflight_options=apigateway.CorsOptions(
                allow_origins=apigateway.Cors.ALL_ORIGINS,
                allow_methods=apigateway.Cors.ALL_METHODS,
                allow_headers=["Content-Type", "Authorization"]
            )
        )

        # Create Lambda authorizer
        self.authorizer = apigateway.TokenAuthorizer(
            self, f"ApiAuthorizer-{self.env_name}",
            handler=self.authorizer_function,
            identity_source="method.request.header.Authorization",
            results_cache_ttl=Duration.minutes(5)
        )

        # Create API resources
        users_resource = self.api.root.add_resource("users")
        user_resource = users_resource.add_resource("{userId}")
        user_groups_resource = user_resource.add_resource("groups")
        user_status_resource = user_resource.add_resource("status")

        # User management integration
        user_management_integration = apigateway.LambdaIntegration(
            self.user_management_function,
            proxy=True
        )

        # Add methods with authorizer
        users_resource.add_method("GET", user_management_integration, authorizer=self.authorizer)
        users_resource.add_method("POST", user_management_integration, authorizer=self.authorizer)
        user_resource.add_method("GET", user_management_integration, authorizer=self.authorizer)
        user_groups_resource.add_method("PUT", user_management_integration, authorizer=self.authorizer)
        user_status_resource.add_method("PUT", user_management_integration, authorizer=self.authorizer)

    def create_admin_user_initialization(self):
        """Create Lambda function to initialize admin users and run it during deployment"""

        # Create the initialization Lambda function
        init_function = lambda_.Function(
            self, f"AdminUserInitFunction-{self.env_name}",
            function_name=f"harmonest-{self.env_name}-admin-user-init",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="init_admin_users.handler",
            code=lambda_.Code.from_asset("functions/auth"),
            timeout=Duration.minutes(5),
            memory_size=256,
            environment={
                "USER_POOL_ID": self.user_pool.user_pool_id,
            },
            description="Initialize admin users in Cognito User Pool"
        )

        # Grant permissions to the initialization function
        init_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-idp:AdminGetUser",
                    "cognito-idp:AdminCreateUser",
                    "cognito-idp:AdminSetUserPassword",
                    "cognito-idp:AdminAddUserToGroup",
                    "cognito-idp:AdminUpdateUserAttributes",
                ],
                resources=[self.user_pool.user_pool_arn]
            )
        )

        # Create custom resource that will trigger the initialization
        custom_resource = cr.AwsCustomResource(
            self, f"AdminUserInitResource-{self.env_name}",
            on_create=cr.AwsSdkCall(
                service="Lambda",
                action="invoke",
                parameters={
                    "FunctionName": init_function.function_name,
                    "Payload": '{"RequestType": "Create"}'
                },
                physical_resource_id=cr.PhysicalResourceId.of(f"admin-user-init-{self.env_name}")
            ),
            policy=cr.AwsCustomResourcePolicy.from_statements([
                iam.PolicyStatement(
                    effect=iam.Effect.ALLOW,
                    actions=["lambda:InvokeFunction"],
                    resources=[init_function.function_arn]
                )
            ])
        )

        # Ensure the custom resource runs after user pool and groups are created
        custom_resource.node.add_dependency(self.user_pool)
        custom_resource.node.add_dependency(self.owner_group)
        custom_resource.node.add_dependency(self.super_admin_group)
        custom_resource.node.add_dependency(self.admin_group)
        custom_resource.node.add_dependency(self.support_group)
        custom_resource.node.add_dependency(self.guest_group)

        return custom_resource

    def export_values(self):
        """Export values for other stacks to use"""

        # Export User Pool information
        ssm.StringParameter(
            self, "UserPoolId",
            parameter_name=f"/harmonest/{self.env_name}/cognito/user-pool-id",
            string_value=self.user_pool.user_pool_id,
        )

        ssm.StringParameter(
            self, "UserPoolClientId",
            parameter_name=f"/harmonest/{self.env_name}/cognito/user-pool-client-id",
            string_value=self.user_pool_client.user_pool_client_id,
        )

        ssm.StringParameter(
            self, "UserPoolArn",
            parameter_name=f"/harmonest/{self.env_name}/cognito/user-pool-arn",
            string_value=self.user_pool.user_pool_arn,
        )

        # Note: Cognito domain will be created separately if needed
        # ssm.StringParameter(
        #     self, "CognitoDomain",
        #     parameter_name=f"/harmonest/{self.env_name}/cognito/domain",
        #     string_value=f"harmonest-{self.env_name}.auth.{self.region}.amazoncognito.com",
        # )
