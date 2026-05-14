#!/bin/bash

# Delete Complete Cognito Infrastructure for Harmonest
# Removes User Pool, Identity Pool, IAM Roles, and all related resources
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

echo -e "${RED}🗑️  Harmonest Cognito Infrastructure Deletion${NC}"
echo "=============================================="
echo

# Prompt for environment
echo "Select environment to DELETE:"
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

echo -e "${RED}⚠️  WARNING: This will DELETE ALL Cognito resources for environment: ${ENV}${NC}"
echo -e "${RED}⚠️  This action CANNOT be undone!${NC}"
echo
read -p "Are you absolutely sure? Type 'DELETE' to confirm: " CONFIRM

if [ "$CONFIRM" != "DELETE" ]; then
    echo -e "${YELLOW}❌ Deletion cancelled.${NC}"
    exit 0
fi

echo -e "${BLUE}📋 Loading configuration for environment: ${ENV}${NC}"

# Load configuration file
COGNITO_CONFIG_FILE="$SCRIPT_DIR/cognito_config_${ENV}.json"

if [ ! -f "$COGNITO_CONFIG_FILE" ]; then
    echo -e "${YELLOW}⚠️  Configuration file not found: $COGNITO_CONFIG_FILE${NC}"
    echo -e "${YELLOW}⚠️  Will attempt to find resources by naming convention...${NC}"
    
    # Try to find resources by naming convention
    USER_POOL_NAME="harmonest-${ENV}-user-pool"
    IDENTITY_POOL_NAME="harmonest_${ENV}_identity_pool"
    AUTH_ROLE_NAME="Cognito_harmonest_${ENV}_Auth_Role"
    UNAUTH_ROLE_NAME="Cognito_harmonest_${ENV}_Unauth_Role"
    
    # Try to find User Pool ID
    USER_POOL_ID=$(aws cognito-idp list-user-pools --max-items 50 --profile "$AWS_PROFILE" --region "$REGION" --query "UserPools[?Name=='$USER_POOL_NAME'].Id" --output text 2>/dev/null || echo "")
    
    # Try to find Identity Pool ID
    IDENTITY_POOL_ID=$(aws cognito-identity list-identity-pools --max-results 50 --profile "$AWS_PROFILE" --region "$REGION" --query "IdentityPools[?IdentityPoolName=='$IDENTITY_POOL_NAME'].IdentityPoolId" --output text 2>/dev/null || echo "")
    
else
    # Load from configuration file
    USER_POOL_ID=$(jq -r '.userPoolId' "$COGNITO_CONFIG_FILE")
    USER_POOL_CLIENT_ID=$(jq -r '.userPoolWebClientId' "$COGNITO_CONFIG_FILE")
    IDENTITY_POOL_ID=$(jq -r '.identityPoolId' "$COGNITO_CONFIG_FILE")
    AUTH_ROLE_ARN=$(jq -r '.authRoleArn' "$COGNITO_CONFIG_FILE")
    UNAUTH_ROLE_ARN=$(jq -r '.unauthRoleArn' "$COGNITO_CONFIG_FILE")
    
    # Extract role names from ARNs
    AUTH_ROLE_NAME=$(echo "$AUTH_ROLE_ARN" | sed 's/.*role\///')
    UNAUTH_ROLE_NAME=$(echo "$UNAUTH_ROLE_ARN" | sed 's/.*role\///')
fi

echo -e "${BLUE}🔍 Found resources to delete:${NC}"
echo "  • User Pool ID: ${USER_POOL_ID:-'Not found'}"
echo "  • Identity Pool ID: ${IDENTITY_POOL_ID:-'Not found'}"
echo "  • Auth Role: ${AUTH_ROLE_NAME:-'Not found'}"
echo "  • Unauth Role: ${UNAUTH_ROLE_NAME:-'Not found'}"
echo

# Step 1: Delete User Pool (this will also delete the client)
if [ ! -z "$USER_POOL_ID" ] && [ "$USER_POOL_ID" != "null" ]; then
    echo -e "${BLUE}🗑️  Step 1: Deleting User Pool...${NC}"
    
    aws cognito-idp delete-user-pool \
      --user-pool-id "$USER_POOL_ID" \
      --profile "$AWS_PROFILE" \
      --region "$REGION"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ User Pool deleted: $USER_POOL_ID${NC}"
    else
        echo -e "${RED}❌ Failed to delete User Pool${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  User Pool not found, skipping...${NC}"
fi

# Step 2: Delete Identity Pool
if [ ! -z "$IDENTITY_POOL_ID" ] && [ "$IDENTITY_POOL_ID" != "null" ]; then
    echo -e "${BLUE}🗑️  Step 2: Deleting Identity Pool...${NC}"
    
    aws cognito-identity delete-identity-pool \
      --identity-pool-id "$IDENTITY_POOL_ID" \
      --profile "$AWS_PROFILE" \
      --region "$REGION"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Identity Pool deleted: $IDENTITY_POOL_ID${NC}"
    else
        echo -e "${RED}❌ Failed to delete Identity Pool${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Identity Pool not found, skipping...${NC}"
fi

# Step 3: Delete IAM Roles
echo -e "${BLUE}🗑️  Step 3: Deleting IAM Roles...${NC}"

# Delete authenticated role
if [ ! -z "$AUTH_ROLE_NAME" ] && [ "$AUTH_ROLE_NAME" != "null" ]; then
    echo -e "${YELLOW}Deleting authenticated role: $AUTH_ROLE_NAME${NC}"
    
    # First, delete attached policies
    aws iam delete-role-policy \
      --role-name "$AUTH_ROLE_NAME" \
      --policy-name "CognitoAuthenticatedPolicy" \
      --profile "$AWS_PROFILE" \
      --region "$REGION" 2>/dev/null || echo "Policy may not exist"
    
    # Then delete the role
    aws iam delete-role \
      --role-name "$AUTH_ROLE_NAME" \
      --profile "$AWS_PROFILE" \
      --region "$REGION"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Authenticated role deleted: $AUTH_ROLE_NAME${NC}"
    else
        echo -e "${RED}❌ Failed to delete authenticated role${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Authenticated role not found, skipping...${NC}"
fi

# Delete unauthenticated role
if [ ! -z "$UNAUTH_ROLE_NAME" ] && [ "$UNAUTH_ROLE_NAME" != "null" ]; then
    echo -e "${YELLOW}Deleting unauthenticated role: $UNAUTH_ROLE_NAME${NC}"
    
    # First, delete attached policies
    aws iam delete-role-policy \
      --role-name "$UNAUTH_ROLE_NAME" \
      --policy-name "CognitoUnauthenticatedPolicy" \
      --profile "$AWS_PROFILE" \
      --region "$REGION" 2>/dev/null || echo "Policy may not exist"
    
    # Then delete the role
    aws iam delete-role \
      --role-name "$UNAUTH_ROLE_NAME" \
      --profile "$AWS_PROFILE" \
      --region "$REGION"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Unauthenticated role deleted: $UNAUTH_ROLE_NAME${NC}"
    else
        echo -e "${RED}❌ Failed to delete unauthenticated role${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Unauthenticated role not found, skipping...${NC}"
fi

# Step 4: Delete configuration file
if [ -f "$COGNITO_CONFIG_FILE" ]; then
    echo -e "${BLUE}🗑️  Step 4: Deleting configuration file...${NC}"
    rm -f "$COGNITO_CONFIG_FILE"
    echo -e "${GREEN}✅ Configuration file deleted: $COGNITO_CONFIG_FILE${NC}"
fi

echo
echo -e "${GREEN}🎉 Cognito Infrastructure Deletion Complete!${NC}"
echo
echo -e "${BLUE}📋 Summary:${NC}"
echo "  • Environment: $ENV"
echo "  • All Cognito resources have been deleted"
echo "  • Configuration file removed"
echo
echo -e "${YELLOW}⚠️  Remember to:${NC}"
echo "1. Update your Angular environment files"
echo "2. Remove any cached authentication tokens"
echo "3. Clear browser storage for your application"
echo
echo -e "${RED}⚠️  This deletion is permanent and cannot be undone!${NC}"
