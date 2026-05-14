#!/bin/bash

# Complete Cognito Infrastructure Setup for Harmonest
# Creates User Pool, Identity Pool, IAM Roles, and Admin User
# Supports both dev and prod environments

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
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}❌ AWS config file not found: $CONFIG_FILE${NC}"
    exit 1
fi

AWS_PROFILE=$(jq -r '.aws_profile // "harmonestadmin"' "$CONFIG_FILE")
REGION=$(jq -r '.region // "eu-central-1"' "$CONFIG_FILE")

echo -e "${BLUE}🚀 Harmonest Cognito Infrastructure Setup${NC}"
echo "=========================================="
echo

# Prompt for environment
echo "Select environment:"
echo "1) dev"
echo "2) prod"
read -p "Enter choice (1-2): " env_choice

case $env_choice in
    1)
        ENV="dev"
        ;;
    2)
        ENV="prod"
        ;;
    *)
        echo -e "${RED}❌ Invalid choice. Exiting.${NC}"
        exit 1
        ;;
esac

echo -e "${BLUE}📋 Setting up Cognito for environment: ${ENV}${NC}"
echo

# Step 1: Create User Pool
echo -e "${BLUE}🔐 Step 1: Creating Cognito User Pool...${NC}"

USER_POOL_NAME="harmonest-${ENV}-user-pool"

# Create User Pool with comprehensive configuration
USER_POOL_ID=$(aws cognito-idp create-user-pool \
  --pool-name "$USER_POOL_NAME" \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 8,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": false,
      "TemporaryPasswordValidityDays": 7
    }
  }' \
  --auto-verified-attributes email \
  --username-attributes email \
  --verification-message-template '{
    "DefaultEmailOption": "CONFIRM_WITH_CODE",
    "EmailMessage": "Welcome to Harmonest! Your verification code is {####}",
    "EmailSubject": "Harmonest - Verify your email"
  }' \
  --mfa-configuration OFF \
  --device-configuration '{
    "ChallengeRequiredOnNewDevice": false,
    "DeviceOnlyRememberedOnUserPrompt": false
  }' \
  --email-configuration '{
    "EmailSendingAccount": "COGNITO_DEFAULT"
  }' \
  --admin-create-user-config '{
    "AllowAdminCreateUserOnly": false,
    "InviteMessageTemplate": {
      "EmailMessage": "Welcome to Harmonest! Your username is {username} and temporary password is {####}",
      "EmailSubject": "Harmonest - Your temporary password"
    }
  }' \
  --schema '[
    {
      "Name": "email",
      "AttributeDataType": "String",
      "Required": true,
      "Mutable": true
    },
    {
      "Name": "given_name",
      "AttributeDataType": "String",
      "Required": false,
      "Mutable": true
    },
    {
      "Name": "family_name",
      "AttributeDataType": "String",
      "Required": false,
      "Mutable": true
    },
    {
      "Name": "phone_number",
      "AttributeDataType": "String",
      "Required": false,
      "Mutable": true
    },
    {
      "Name": "role",
      "AttributeDataType": "String",
      "Required": false,
      "Mutable": true,
      "DeveloperOnlyAttribute": false
    },
    {
      "Name": "status",
      "AttributeDataType": "String",
      "Required": false,
      "Mutable": true,
      "DeveloperOnlyAttribute": false
    }
  ]' \
  --profile "$AWS_PROFILE" \
  --region "$REGION" \
  --query 'UserPool.Id' \
  --output text)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ User Pool created: $USER_POOL_ID${NC}"
else
    echo -e "${RED}❌ Failed to create User Pool${NC}"
    exit 1
fi

# Step 2: Create User Pool Client
echo -e "${BLUE}🔑 Step 2: Creating User Pool Client...${NC}"

CLIENT_NAME="harmonest-${ENV}-web-client"

USER_POOL_CLIENT_ID=$(aws cognito-idp create-user-pool-client \
  --user-pool-id "$USER_POOL_ID" \
  --client-name "$CLIENT_NAME" \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_PASSWORD_AUTH \
  --supported-identity-providers COGNITO \
  --callback-urls "http://localhost:4200/auth/callback" "https://harmonest.com/auth/callback" \
  --logout-urls "http://localhost:4200/auth/logout" "https://harmonest.com/auth/logout" \
  --allowed-o-auth-flows code implicit \
  --allowed-o-auth-scopes openid email profile \
  --allowed-o-auth-flows-user-pool-client \
  --prevent-user-existence-errors ENABLED \
  --enable-token-revocation \
  --profile "$AWS_PROFILE" \
  --region "$REGION" \
  --query 'UserPoolClient.ClientId' \
  --output text)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ User Pool Client created: $USER_POOL_CLIENT_ID${NC}"
else
    echo -e "${RED}❌ Failed to create User Pool Client${NC}"
    exit 1
fi

# Step 3: Create Identity Pool
echo -e "${BLUE}🆔 Step 3: Creating Identity Pool...${NC}"

IDENTITY_POOL_NAME="harmonest_${ENV}_identity_pool"

IDENTITY_POOL_ID=$(aws cognito-identity create-identity-pool \
  --identity-pool-name "$IDENTITY_POOL_NAME" \
  --allow-unauthenticated-identities \
  --cognito-identity-providers ProviderName="cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}",ClientId="$USER_POOL_CLIENT_ID",ServerSideTokenCheck=false \
  --profile "$AWS_PROFILE" \
  --region "$REGION" \
  --query 'IdentityPoolId' \
  --output text)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Identity Pool created: $IDENTITY_POOL_ID${NC}"
else
    echo -e "${RED}❌ Failed to create Identity Pool${NC}"
    exit 1
fi

echo -e "${BLUE}🔄 Step 4: Creating IAM Roles...${NC}"

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --profile "$AWS_PROFILE")

# Define role names
AUTH_ROLE_NAME="Cognito_harmonest_${ENV}_Auth_Role"
UNAUTH_ROLE_NAME="Cognito_harmonest_${ENV}_Unauth_Role"

# Define trust policy for authenticated role
AUTH_TRUST_POLICY='{
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
}'

# Define trust policy for unauthenticated role
UNAUTH_TRUST_POLICY='{
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
}'

# Create permissions policy for authenticated users
cat > "$TEMP_DIR/cognito-auth-permissions.json" << EOF
{
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
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/harmonest-${ENV}-*"
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
        "arn:aws:s3:::harmonest-${ENV}-*/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::harmonest-${ENV}-*"
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
        "cognito-idp:AdminConfirmSignUp",
        "cognito-idp:AdminAddUserToGroup",
        "cognito-idp:AdminRemoveUserFromGroup",
        "cognito-idp:AdminListGroupsForUser",
        "cognito-idp:ListUsersInGroup"
      ],
      "Resource": [
        "arn:aws:cognito-idp:${REGION}:${ACCOUNT_ID}:userpool/${USER_POOL_ID}"
      ]
    }
  ]
}
EOF

# Create permissions policy for unauthenticated users
cat > "$TEMP_DIR/cognito-unauth-permissions.json" << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "mobileanalytics:PutEvents",
        "cognito-sync:*"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/harmonest-${ENV}-bookings",
        "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/harmonest-${ENV}-properties"
      ],
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:Attributes": ["bookingId", "propertyId", "status", "checkInDate", "checkOutDate"]
        }
      }
    }
  ]
}
EOF

# Create authenticated role
echo -e "${YELLOW}Creating authenticated role...${NC}"
aws iam create-role \
  --role-name "$AUTH_ROLE_NAME" \
  --assume-role-policy-document "$AUTH_TRUST_POLICY" \
  --profile "$AWS_PROFILE" \
  --region "$REGION" || echo "Role may already exist"

# Create unauthenticated role
echo -e "${YELLOW}Creating unauthenticated role...${NC}"
aws iam create-role \
  --role-name "$UNAUTH_ROLE_NAME" \
  --assume-role-policy-document "$UNAUTH_TRUST_POLICY" \
  --profile "$AWS_PROFILE" \
  --region "$REGION" || echo "Role may already exist"

# Attach policies to roles
echo -e "${YELLOW}Attaching policies to roles...${NC}"
aws iam put-role-policy \
  --role-name "$AUTH_ROLE_NAME" \
  --policy-name "CognitoAuthenticatedPolicy" \
  --policy-document "file://$TEMP_DIR/cognito-auth-permissions.json" \
  --profile "$AWS_PROFILE" \
  --region "$REGION"

aws iam put-role-policy \
  --role-name "$UNAUTH_ROLE_NAME" \
  --policy-name "CognitoUnauthenticatedPolicy" \
  --policy-document "file://$TEMP_DIR/cognito-unauth-permissions.json" \
  --profile "$AWS_PROFILE" \
  --region "$REGION"

# Get role ARNs
AUTH_ROLE_ARN=$(aws iam get-role --role-name "$AUTH_ROLE_NAME" --profile "$AWS_PROFILE" --region "$REGION" --query 'Role.Arn' --output text)
UNAUTH_ROLE_ARN=$(aws iam get-role --role-name "$UNAUTH_ROLE_NAME" --profile "$AWS_PROFILE" --region "$REGION" --query 'Role.Arn' --output text)

echo -e "${GREEN}✅ IAM Roles created successfully${NC}"

# Step 5: Attach roles to Identity Pool
echo -e "${BLUE}🔗 Step 5: Attaching roles to Identity Pool...${NC}"

aws cognito-identity set-identity-pool-roles \
  --identity-pool-id "$IDENTITY_POOL_ID" \
  --roles authenticated="$AUTH_ROLE_ARN",unauthenticated="$UNAUTH_ROLE_ARN" \
  --profile "$AWS_PROFILE" \
  --region "$REGION"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Roles attached to Identity Pool${NC}"
else
    echo -e "${RED}❌ Failed to attach roles to Identity Pool${NC}"
    exit 1
fi

# Step 6: Create Super Admin User
echo -e "${BLUE}👤 Step 6: Creating Super Admin User...${NC}"
echo

# Prompt for admin user details
read -p "Enter super admin email: " ADMIN_EMAIL
read -p "Enter super admin first name: " ADMIN_FIRST_NAME
read -p "Enter super admin last name: " ADMIN_LAST_NAME
read -s -p "Enter temporary password (min 8 chars): " TEMP_PASSWORD
echo

# Create super admin user
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "$ADMIN_EMAIL" \
  --user-attributes Name=email,Value="$ADMIN_EMAIL" Name=given_name,Value="$ADMIN_FIRST_NAME" Name=family_name,Value="$ADMIN_LAST_NAME" Name=custom:role,Value=super_admin Name=custom:status,Value=active Name=email_verified,Value=true \
  --temporary-password "$TEMP_PASSWORD" \
  --message-action SUPPRESS \
  --profile "$AWS_PROFILE" \
  --region "$REGION"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Super admin user created: $ADMIN_EMAIL${NC}"
else
    echo -e "${RED}❌ Failed to create super admin user${NC}"
    exit 1
fi

# Step 7: Save configuration
echo -e "${BLUE}💾 Step 7: Saving configuration...${NC}"

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
    "email": "$ADMIN_EMAIL",
    "role": "super_admin"
  }
}
EOF

echo -e "${GREEN}✅ Configuration saved to: $CONFIG_OUTPUT_FILE${NC}"

# Clean up temporary files
rm -rf "$TEMP_DIR"

echo
echo -e "${GREEN}🎉 Cognito Infrastructure Setup Complete!${NC}"
echo
echo -e "${BLUE}📋 Summary:${NC}"
echo "  • Environment: $ENV"
echo "  • User Pool ID: $USER_POOL_ID"
echo "  • Client ID: $USER_POOL_CLIENT_ID"
echo "  • Identity Pool ID: $IDENTITY_POOL_ID"
echo "  • Super Admin: $ADMIN_EMAIL"
echo
echo -e "${YELLOW}⚠️  Next Steps:${NC}"
echo "1. Run ./create_iam_user_roles.sh to create role-based IAM policies"
echo "2. Update your Angular environment files with the new configuration"
echo "3. Test authentication with the super admin user"
echo "4. The super admin will need to change their password on first login"
echo
echo -e "${BLUE}📄 Configuration file: $CONFIG_OUTPUT_FILE${NC}"
echo
echo -e "${GREEN}🔧 To create role-based IAM policies, run:${NC}"
echo -e "${BLUE}   ./create_iam_user_roles.sh${NC}"
