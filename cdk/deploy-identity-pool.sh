#!/bin/bash

# Deploy Identity Pool Stack for Direct AWS Access
# Usage: ./deploy-identity-pool.sh [env] [client]
# Example: ./deploy-identity-pool.sh prod harmonest

set -e

# Default values
ENV=${1:-prod}
CLIENT=${2:-harmonest}
PROFILE="harmonestadmin"

echo "🚀 Deploying Identity Pool Stack"
echo "Environment: $ENV"
echo "Client: $CLIENT"
echo "Profile: $PROFILE"
echo ""

# Check if user management stack exists
echo "📋 Checking prerequisites..."
USER_MANAGEMENT_STACK="HarmonestUserManagement-$ENV"
if ! aws cloudformation describe-stacks --stack-name "$USER_MANAGEMENT_STACK" --profile "$PROFILE" >/dev/null 2>&1; then
    echo "❌ User Management stack not found: $USER_MANAGEMENT_STACK"
    echo "Please deploy the user management stack first:"
    echo "cdk deploy --context client=$CLIENT --context env=$ENV $USER_MANAGEMENT_STACK --profile $PROFILE"
    exit 1
fi

# Check if core stack exists
CORE_STACK="HarmonestCore-$ENV"
if ! aws cloudformation describe-stacks --stack-name "$CORE_STACK" --profile "$PROFILE" >/dev/null 2>&1; then
    echo "❌ Core stack not found: $CORE_STACK"
    echo "Please deploy the core stack first:"
    echo "cdk deploy --context client=$CLIENT --context env=$ENV $CORE_STACK --profile $PROFILE"
    exit 1
fi

# Check if S3 stack exists
S3_STACK="HarmonestS3-$ENV"
if ! aws cloudformation describe-stacks --stack-name "$S3_STACK" --profile "$PROFILE" >/dev/null 2>&1; then
    echo "❌ S3 stack not found: $S3_STACK"
    echo "Please deploy the S3 stack first:"
    echo "cdk deploy --context client=$CLIENT --context env=$ENV $S3_STACK --profile $PROFILE"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Deploy Identity Pool stack
IDENTITY_POOL_STACK="HarmonestIdentityPool-$ENV"
echo "🔧 Deploying Identity Pool stack: $IDENTITY_POOL_STACK"

cdk deploy \
    --context client="$CLIENT" \
    --context env="$ENV" \
    "$IDENTITY_POOL_STACK" \
    --profile "$PROFILE" \
    --require-approval never

echo ""
echo "✅ Identity Pool stack deployed successfully!"
echo ""

# Get configuration values
echo "📋 Configuration values for frontend:"
echo ""

# Get Identity Pool ID
IDENTITY_POOL_ID=$(aws ssm get-parameter \
    --name "/$CLIENT/$ENV/cognito/identity-pool-id" \
    --query "Parameter.Value" \
    --output text \
    --profile "$PROFILE" 2>/dev/null || echo "Not found")

# Get User Pool ID
USER_POOL_ID=$(aws ssm get-parameter \
    --name "/harmonest/$ENV/cognito/user-pool-id" \
    --query "Parameter.Value" \
    --output text \
    --profile "$PROFILE" 2>/dev/null || echo "Not found")

# Get User Pool Client ID
USER_POOL_CLIENT_ID=$(aws ssm get-parameter \
    --name "/harmonest/$ENV/cognito/user-pool-client-id" \
    --query "Parameter.Value" \
    --output text \
    --profile "$PROFILE" 2>/dev/null || echo "Not found")

# Get Cognito Domain
COGNITO_DOMAIN=$(aws ssm get-parameter \
    --name "/harmonest/$ENV/cognito/domain" \
    --query "Parameter.Value" \
    --output text \
    --profile "$PROFILE" 2>/dev/null || echo "Not found")

# Get S3 Bucket
S3_BUCKET=$(aws ssm get-parameter \
    --name "/$CLIENT/$ENV/s3/bucketName" \
    --query "Parameter.Value" \
    --output text \
    --profile "$PROFILE" 2>/dev/null || echo "Not found")

# Get DynamoDB Table
DYNAMODB_TABLE=$(aws ssm get-parameter \
    --name "/$CLIENT/$ENV/table/name" \
    --query "Parameter.Value" \
    --output text \
    --profile "$PROFILE" 2>/dev/null || echo "Not found")

echo "# Add these to your frontend .env.local file:"
echo ""
echo "# Cognito Configuration"
echo "NEXT_PUBLIC_USER_POOL_ID=$USER_POOL_ID"
echo "NEXT_PUBLIC_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID"
echo "NEXT_PUBLIC_IDENTITY_POOL_ID=$IDENTITY_POOL_ID"
echo "NEXT_PUBLIC_COGNITO_DOMAIN=$COGNITO_DOMAIN"
echo ""
echo "# AWS Resources (for direct access)"
echo "NEXT_PUBLIC_S3_BUCKET=$S3_BUCKET"
echo "NEXT_PUBLIC_DYNAMODB_TABLE=$DYNAMODB_TABLE"
echo ""
echo "# OAuth Redirects (update with your domain)"
echo "NEXT_PUBLIC_REDIRECT_SIGN_IN=https://harmonest.de/auth/callback"
echo "NEXT_PUBLIC_REDIRECT_SIGN_OUT=https://harmonest.de/auth/logout"
echo ""

# Test IAM roles
echo "🔍 Testing IAM roles..."
echo ""

# List IAM roles created
ROLES=(
    "harmonest-$ENV-owner-role"
    "harmonest-$ENV-admin-role" 
    "harmonest-$ENV-support-role"
    "harmonest-$ENV-guest-role"
)

for role in "${ROLES[@]}"; do
    if aws iam get-role --role-name "$role" --profile "$PROFILE" >/dev/null 2>&1; then
        echo "✅ IAM Role exists: $role"
    else
        echo "❌ IAM Role missing: $role"
    fi
done

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Update your frontend .env.local with the configuration above"
echo "2. Install required dependencies: npm install aws-amplify aws-sdk"
echo "3. Configure AWS SDK with the Identity Pool ID"
echo "4. Test direct access with different user roles"
echo ""
echo "For troubleshooting, check:"
echo "- CloudWatch logs for Lambda functions"
echo "- IAM role policies and trust relationships"
echo "- Cognito Identity Pool role mappings"
