"""
Cognito Identity Pool Stack
Provides direct AWS resource access based on user groups
"""
from aws_cdk import (
    Stack, Duration,
    aws_cognito as cognito,
    aws_iam as iam,
    aws_ssm as ssm,
)
from constructs import Construct


class IdentityPoolStack(Stack):
    def __init__(self, scope: Construct, cid: str, *, config: dict, 
                 user_pool_id: str, user_pool_client_id: str, 
                 table_name: str, bucket_name: str, **kw):
        super().__init__(scope, cid, **kw)
        
        # Extract configuration values
        self.client_name = config["cdk"]["client_name"]
        self.env_name = config["cdk"]["env_name"]
        self.region = config["cdk"]["region"]
        self.user_pool_id = user_pool_id
        self.user_pool_client_id = user_pool_client_id
        self.table_name = table_name
        self.bucket_name = bucket_name
        
        # Create Identity Pool
        self.create_identity_pool()
        
        # Create IAM roles for different user groups
        self.create_iam_roles()
        
        # Configure role mappings
        self.configure_role_mappings()
    
    def create_identity_pool(self):
        """Create Cognito Identity Pool"""
        
        self.identity_pool = cognito.CfnIdentityPool(
            self, f"IdentityPool-{self.env_name}",
            identity_pool_name=f"harmonest-{self.env_name}-identity-pool",
            allow_unauthenticated_identities=False,
            cognito_identity_providers=[
                cognito.CfnIdentityPool.CognitoIdentityProviderProperty(
                    client_id=self.user_pool_client_id,
                    provider_name=f"cognito-idp.{self.region}.amazonaws.com/{self.user_pool_id}",
                    server_side_token_check=True
                )
            ]
        )
    
    def create_iam_roles(self):
        """Create IAM roles for different user groups"""
        
        # Owner/Super Admin Role - Full Access
        self.owner_role = iam.Role(
            self, f"OwnerRole-{self.env_name}",
            role_name=f"harmonest-{self.env_name}-owner-role",
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
            inline_policies={
                "DynamoDBFullAccess": iam.PolicyDocument(
                    statements=[
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
                                "dynamodb:BatchWriteItem"
                            ],
                            resources=[
                                f"arn:aws:dynamodb:{self.region}:{self.account}:table/{self.table_name}",
                                f"arn:aws:dynamodb:{self.region}:{self.account}:table/{self.table_name}/index/*"
                            ]
                        )
                    ]
                ),
                "S3FullAccess": iam.PolicyDocument(
                    statements=[
                        iam.PolicyStatement(
                            effect=iam.Effect.ALLOW,
                            actions=[
                                "s3:GetObject",
                                "s3:PutObject",
                                "s3:DeleteObject",
                                "s3:ListBucket",
                                "s3:GetObjectVersion"
                            ],
                            resources=[
                                f"arn:aws:s3:::{self.bucket_name}",
                                f"arn:aws:s3:::{self.bucket_name}/*"
                            ]
                        )
                    ]
                )
            }
        )
        
        # Admin Role - DynamoDB Read/Write, S3 Read + Limited Write
        self.admin_role = iam.Role(
            self, f"AdminRole-{self.env_name}",
            role_name=f"harmonest-{self.env_name}-admin-role",
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
            inline_policies={
                "DynamoDBReadWrite": iam.PolicyDocument(
                    statements=[
                        iam.PolicyStatement(
                            effect=iam.Effect.ALLOW,
                            actions=[
                                "dynamodb:GetItem",
                                "dynamodb:PutItem",
                                "dynamodb:UpdateItem", 
                                "dynamodb:Query",
                                "dynamodb:Scan",
                                "dynamodb:BatchGetItem",
                                "dynamodb:BatchWriteItem"
                            ],
                            resources=[
                                f"arn:aws:dynamodb:{self.region}:{self.account}:table/{self.table_name}",
                                f"arn:aws:dynamodb:{self.region}:{self.account}:table/{self.table_name}/index/*"
                            ],
                            conditions={
                                "ForAllValues:StringLike": {
                                    "dynamodb:LeadingKeys": [
                                        "LISTING#*",
                                        "GROUP#*", 
                                        "RESERVATION#*",
                                        "CHECKIN#*"
                                    ]
                                }
                            }
                        )
                    ]
                ),
                "S3LimitedAccess": iam.PolicyDocument(
                    statements=[
                        iam.PolicyStatement(
                            effect=iam.Effect.ALLOW,
                            actions=["s3:GetObject", "s3:ListBucket"],
                            resources=[
                                f"arn:aws:s3:::{self.bucket_name}",
                                f"arn:aws:s3:::{self.bucket_name}/public/*",
                                f"arn:aws:s3:::{self.bucket_name}/protected/*"
                            ]
                        ),
                        iam.PolicyStatement(
                            effect=iam.Effect.ALLOW,
                            actions=["s3:PutObject"],
                            resources=[
                                f"arn:aws:s3:::{self.bucket_name}/protected/*"
                            ]
                        )
                    ]
                )
            }
        )
        
        # Support Role - Read Only
        self.support_role = iam.Role(
            self, f"SupportRole-{self.env_name}",
            role_name=f"harmonest-{self.env_name}-support-role",
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
            inline_policies={
                "DynamoDBReadOnly": iam.PolicyDocument(
                    statements=[
                        iam.PolicyStatement(
                            effect=iam.Effect.ALLOW,
                            actions=[
                                "dynamodb:GetItem",
                                "dynamodb:Query",
                                "dynamodb:Scan",
                                "dynamodb:BatchGetItem"
                            ],
                            resources=[
                                f"arn:aws:dynamodb:{self.region}:{self.account}:table/{self.table_name}",
                                f"arn:aws:dynamodb:{self.region}:{self.account}:table/{self.table_name}/index/*"
                            ],
                            conditions={
                                "ForAllValues:StringLike": {
                                    "dynamodb:LeadingKeys": [
                                        "LISTING#*",
                                        "GROUP#*",
                                        "RESERVATION#*"
                                    ]
                                }
                            }
                        )
                    ]
                ),
                "S3ReadOnly": iam.PolicyDocument(
                    statements=[
                        iam.PolicyStatement(
                            effect=iam.Effect.ALLOW,
                            actions=["s3:GetObject", "s3:ListBucket"],
                            resources=[
                                f"arn:aws:s3:::{self.bucket_name}",
                                f"arn:aws:s3:::{self.bucket_name}/public/*"
                            ]
                        )
                    ]
                )
            }
        )
        
        # Guest Role - Own Data Only
        self.guest_role = iam.Role(
            self, f"GuestRole-{self.env_name}",
            role_name=f"harmonest-{self.env_name}-guest-role",
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
            inline_policies={
                "OwnDataAccess": iam.PolicyDocument(
                    statements=[
                        iam.PolicyStatement(
                            effect=iam.Effect.ALLOW,
                            actions=[
                                "dynamodb:GetItem",
                                "dynamodb:PutItem",
                                "dynamodb:UpdateItem",
                                "dynamodb:Query"
                            ],
                            resources=[
                                f"arn:aws:dynamodb:{self.region}:{self.account}:table/{self.table_name}"
                            ],
                            conditions={
                                "ForAllValues:StringLike": {
                                    "dynamodb:LeadingKeys": ["USER#${cognito-identity.amazonaws.com:sub}"]
                                }
                            }
                        )
                    ]
                ),
                "OwnS3Access": iam.PolicyDocument(
                    statements=[
                        iam.PolicyStatement(
                            effect=iam.Effect.ALLOW,
                            actions=["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
                            resources=[
                                f"arn:aws:s3:::{self.bucket_name}/private/${{cognito-identity.amazonaws.com:sub}}/*"
                            ]
                        ),
                        iam.PolicyStatement(
                            effect=iam.Effect.ALLOW,
                            actions=["s3:ListBucket"],
                            resources=[f"arn:aws:s3:::{self.bucket_name}"],
                            conditions={
                                "StringLike": {
                                    "s3:prefix": ["private/${cognito-identity.amazonaws.com:sub}/*"]
                                }
                            }
                        )
                    ]
                )
            }
        )
    
    def configure_role_mappings(self):
        """Configure role mappings based on Cognito groups"""
        
        # Create role attachment
        self.role_attachment = cognito.CfnIdentityPoolRoleAttachment(
            self, f"IdentityPoolRoleAttachment-{self.env_name}",
            identity_pool_id=self.identity_pool.ref,
            roles={
                "authenticated": self.guest_role.role_arn  # Default role
            },
            role_mappings={
                f"cognito-idp.{self.region}.amazonaws.com/{self.user_pool_id}:{self.user_pool_client_id}": 
                cognito.CfnIdentityPoolRoleAttachment.RoleMappingProperty(
                    type="Rules",
                    ambiguous_role_resolution="AuthenticatedRole",
                    rules_configuration=cognito.CfnIdentityPoolRoleAttachment.RulesConfigurationTypeProperty(
                        rules=[
                            cognito.CfnIdentityPoolRoleAttachment.MappingRuleProperty(
                                claim="cognito:groups",
                                match_type="Equals",
                                value="owner",
                                role_arn=self.owner_role.role_arn
                            ),
                            cognito.CfnIdentityPoolRoleAttachment.MappingRuleProperty(
                                claim="cognito:groups",
                                match_type="Equals", 
                                value="super_admin",
                                role_arn=self.owner_role.role_arn
                            ),
                            cognito.CfnIdentityPoolRoleAttachment.MappingRuleProperty(
                                claim="cognito:groups",
                                match_type="Equals",
                                value="admin", 
                                role_arn=self.admin_role.role_arn
                            ),
                            cognito.CfnIdentityPoolRoleAttachment.MappingRuleProperty(
                                claim="cognito:groups",
                                match_type="Equals",
                                value="support",
                                role_arn=self.support_role.role_arn
                            )
                        ]
                    )
                )
            }
        )
        
        # Export Identity Pool ID
        ssm.StringParameter(
            self, "IdentityPoolId",
            parameter_name=f"/{self.client_name}/{self.env_name}/cognito/identity-pool-id",
            string_value=self.identity_pool.ref,
        )
    
    @property
    def identity_pool_id(self):
        """Get the Identity Pool ID"""
        return self.identity_pool.ref
