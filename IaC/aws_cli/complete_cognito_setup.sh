#!/bin/bash

# Complete Cognito Setup - Create IAM Roles and Admin User
# This script completes the setup for existing Cognito resources

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/aws_config.json"

# Load AWS profile from config
AWS_PROFILE=$(jq -r '.aws_profile // "harmonestadmin"' "$CONFIG_FILE")
REGION="eu-central-1"
ENV="dev"

# Current resource IDs (from previous creation)
USER_POOL_ID="eu-central-1_3nRWgJleG"
IDENTITY_POOL_ID="eu-central-1:258d2ac7-1741-4b39-8095-ae397427638b"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --profile "$AWS_PROFILE")

echo -e "${BLUE}🔧 Completing Cognito Setup${NC}"
echo "============================"
echo -e "${BLUE}User Pool ID: $USER_POOL_ID${NC}"
echo -e "${BLUE}Identity Pool ID: $IDENTITY_POOL_ID${NC}"
echo -e "${BLUE}Account ID: $ACCOUNT_ID${NC}"
echo

# Define role names
AUTH_ROLE_NAME="Cognito_harmonest_${ENV}_Auth_Role"
UNAUTH_ROLE_NAME="Cognito_harmonest_${ENV}_Unauth_Role"

# Step 1: Create IAM Roles
echo -e "${BLUE}🔄 Step 1: Creating IAM Roles...${NC}"

# Create authenticated role
echo -e "${YELLOW}Creating authenticated role...${NC}"
aws iam create-role \
  --role-name "$AUTH_ROLE_NAME" \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Federated": "cognito-identity.amazonaws.com"
        },
        "Action": "sts:AssumeRoleWithWebIdentity",
        "Condition": {
          "StringEquals": {
            "cognito-identity.amazonaws.com:aud": "'$IDENTITY_POOL_ID'"
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "authenticated"
          }
        }
      }
    ]
  }' \
  --profile "$AWS_PROFILE" \
  --region "$REGION" 2>/dev/null || echo "Role may already exist"

# Create unauthenticated role
echo -e "${YELLOW}Creating unauthenticated role...${NC}"
aws iam create-role \
  --role-name "$UNAUTH_ROLE_NAME" \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Federated": "cognito-identity.amazonaws.com"
        },
        "Action": "sts:AssumeRoleWithWebIdentity",
        "Condition": {
          "StringEquals": {
            "cognito-identity.amazonaws.com:aud": "'$IDENTITY_POOL_ID'"
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "unauthenticated"
          }
        }
      }
    ]
  }' \
  --profile "$AWS_PROFILE" \
  --region "$REGION" 2>/dev/null || echo "Role may already exist"

# Step 2: Attach policies to roles
echo -e "${BLUE}🔗 Step 2: Attaching policies to roles...${NC}"

# Attach policy to authenticated role
aws iam put-role-policy \
  --role-name "$AUTH_ROLE_NAME" \
  --policy-name "CognitoAuthenticatedPolicy" \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "mobileanalytics:PutEvents",
          "cognito-sync:*",
          "cognito-identity:*"
        ],
        "Resource": "*"
      },
      {
        "Effect": "Allow",
        "Action": [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ],
        "Resource": [
          "arn:aws:dynamodb:'$REGION':'$ACCOUNT_ID':table/harmonest-'$ENV'-*"
        ]
      },
      {
        "Effect": "Allow",
        "Action": [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ],
        "Resource": [
          "arn:aws:s3:::harmonest-'$ENV'-*/*"
        ]
      },
      {
        "Effect": "Allow",
        "Action": [
          "s3:ListBucket"
        ],
        "Resource": [
          "arn:aws:s3:::harmonest-'$ENV'-*"
        ]
      },
      {
        "Effect": "Allow",
        "Action": [
          "cognito-idp:ListUsers",
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminUpdateUserAttributes",
          "cognito-idp:AdminDeleteUser",
          "cognito-idp:AdminEnableUser",
          "cognito-idp:AdminDisableUser",
          "cognito-idp:AdminSetUserPassword",
          "cognito-idp:AdminResetUserPassword",
          "cognito-idp:AdminConfirmSignUp"
        ],
        "Resource": [
          "arn:aws:cognito-idp:'$REGION':'$ACCOUNT_ID':userpool/'$USER_POOL_ID'"
        ]
      }
    ]
  }' \
  --profile "$AWS_PROFILE" \
  --region "$REGION"

# Attach policy to unauthenticated role
aws iam put-role-policy \
  --role-name "$UNAUTH_ROLE_NAME" \
  --policy-name "CognitoUnauthenticatedPolicy" \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "mobileanalytics:PutEvents",
          "cognito-sync:*"
        ],
        "Resource": "*"
      }
    ]
  }' \
  --profile "$AWS_PROFILE" \
  --region "$REGION"

# Get role ARNs
AUTH_ROLE_ARN=$(aws iam get-role --role-name "$AUTH_ROLE_NAME" --profile "$AWS_PROFILE" --region "$REGION" --query 'Role.Arn' --output text)
UNAUTH_ROLE_ARN=$(aws iam get-role --role-name "$UNAUTH_ROLE_NAME" --profile "$AWS_PROFILE" --region "$REGION" --query 'Role.Arn' --output text)

echo -e "${GREEN}✅ IAM Roles created and configured${NC}"

# Step 3: Attach roles to Identity Pool
echo -e "${BLUE}🔗 Step 3: Attaching roles to Identity Pool...${NC}"

aws cognito-identity set-identity-pool-roles \
  --identity-pool-id "$IDENTITY_POOL_ID" \
  --roles authenticated="$AUTH_ROLE_ARN",unauthenticated="$UNAUTH_ROLE_ARN" \
  --profile "$AWS_PROFILE" \
  --region "$REGION"

echo -e "${GREEN}✅ Roles attached to Identity Pool${NC}"

# Step 4: Create Super Admin User
echo -e "${BLUE}👤 Step 4: Creating Super Admin User...${NC}"

# Get User Pool Client ID
USER_POOL_CLIENT_ID=$(aws cognito-idp list-user-pool-clients --user-pool-id "$USER_POOL_ID" --profile "$AWS_PROFILE" --region "$REGION" --query 'UserPoolClients[0].ClientId' --output text)

# Create super admin user
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "admin@harmonest.com" \
  --user-attributes Name=email,Value="admin@harmonest.com" Name=given_name,Value="Admin" Name=family_name,Value="User" Name=custom:role,Value=super_admin Name=custom:status,Value=active Name=email_verified,Value=true \
  --temporary-password "AdminPass123!" \
  --message-action SUPPRESS \
  --profile "$AWS_PROFILE" \
  --region "$REGION" 2>/dev/null || echo "User may already exist"

echo -e "${GREEN}✅ Super admin user created: admin@harmonest.com${NC}"

# Step 5: Save configuration
echo -e "${BLUE}💾 Step 5: Saving configuration...${NC}"

CONFIG_OUTPUT_FILE="$SCRIPT_DIR/cognito_config_${ENV}.json"

cat > "$CONFIG_OUTPUT_FILE" << EOF
{
  "environment": "$ENV",
  "region": "$REGION",
  "userPoolId": "$USER_POOL_ID",
  "userPoolWebClientId": "$USER_POOL_CLIENT_ID",
  "identityPoolId": "$IDENTITY_POOL_ID",
  "authRoleArn": "$AUTH_ROLE_ARN",
  "unauthRoleArn": "$UNAUTH_ROLE_ARN",
  "oauth": {
    "domain": "",
    "scope": ["openid", "email", "profile"],
    "redirectSignIn": "http://localhost:4200/auth/callback",
    "redirectSignOut": "http://localhost:4200/auth/logout",
    "responseType": "code"
  },
  "adminUser": {
    "email": "admin@harmonest.com",
    "role": "super_admin"
  }
}
EOF

echo -e "${GREEN}✅ Configuration saved to: $CONFIG_OUTPUT_FILE${NC}"

echo
echo -e "${GREEN}🎉 Cognito Setup Complete!${NC}"
echo
echo -e "${BLUE}📋 Summary:${NC}"
echo "  • User Pool ID: $USER_POOL_ID"
echo "  • Client ID: $USER_POOL_CLIENT_ID"
echo "  • Identity Pool ID: $IDENTITY_POOL_ID"
echo "  • Super Admin: admin@harmonest.com"
echo "  • Password: AdminPass123!"
echo
echo -e "${YELLOW}⚠️  Next Steps:${NC}"
echo "1. Update your Angular environment files with the new configuration"
echo "2. Test authentication with the super admin user"
echo "3. The super admin will need to change their password on first login"
echo "4. Run ./create_iam_user_roles.sh to create role-based policies"
