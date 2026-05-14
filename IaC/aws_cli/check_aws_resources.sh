#!/bin/bash

# Check AWS Resources for Harmonest
# Verifies existence of Cognito User Pools, Identity Pools, IAM Roles, and Policies
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

echo -e "${BLUE}🔍 Harmonest AWS Resources Check${NC}"
echo "=================================="
echo

# Prompt for environment
echo "Select environment to check:"
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

echo -e "${BLUE}📋 Checking resources for environment: ${ENV}${NC}"
echo

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --profile "$AWS_PROFILE")
echo -e "${BLUE}📋 AWS Account ID: ${ACCOUNT_ID}${NC}"
echo

# Check 1: Cognito User Pools
echo -e "${BLUE}🔐 Checking Cognito User Pools...${NC}"
USER_POOL_NAME="harmonest-${ENV}-user-pool"

USER_POOLS=$(aws cognito-idp list-user-pools --max-results 50 --profile "$AWS_PROFILE" --region "$REGION" --query "UserPools[?Name=='$USER_POOL_NAME']" --output json)

if [ "$(echo "$USER_POOLS" | jq length)" -gt 0 ]; then
    USER_POOL_ID=$(echo "$USER_POOLS" | jq -r '.[0].Id')
    echo -e "${GREEN}✅ User Pool exists: $USER_POOL_NAME ($USER_POOL_ID)${NC}"

    # Check User Pool Client
    CLIENTS=$(aws cognito-idp list-user-pool-clients --user-pool-id "$USER_POOL_ID" --profile "$AWS_PROFILE" --region "$REGION" --query 'UserPoolClients' --output json)
    if [ "$(echo "$CLIENTS" | jq length)" -gt 0 ]; then
        CLIENT_ID=$(echo "$CLIENTS" | jq -r '.[0].ClientId')
        CLIENT_NAME=$(echo "$CLIENTS" | jq -r '.[0].ClientName')
        echo -e "${GREEN}✅ User Pool Client exists: $CLIENT_NAME ($CLIENT_ID)${NC}"
    else
        echo -e "${RED}❌ No User Pool Client found${NC}"
    fi
else
    echo -e "${RED}❌ User Pool not found: $USER_POOL_NAME${NC}"
    USER_POOL_ID=""
fi

# Check 2: Identity Pools
echo -e "${BLUE}🆔 Checking Identity Pools...${NC}"
IDENTITY_POOL_NAME="harmonest_${ENV}_identity_pool"

IDENTITY_POOLS=$(aws cognito-identity list-identity-pools --max-results 50 --profile "$AWS_PROFILE" --region "$REGION" --query "IdentityPools[?IdentityPoolName=='$IDENTITY_POOL_NAME']" --output json)

if [ "$(echo "$IDENTITY_POOLS" | jq length)" -gt 0 ]; then
    IDENTITY_POOL_ID=$(echo "$IDENTITY_POOLS" | jq -r '.[0].IdentityPoolId')
    echo -e "${GREEN}✅ Identity Pool exists: $IDENTITY_POOL_NAME ($IDENTITY_POOL_ID)${NC}"
else
    echo -e "${RED}❌ Identity Pool not found: $IDENTITY_POOL_NAME${NC}"
    IDENTITY_POOL_ID=""
fi

# Check 3: IAM Roles
echo -e "${BLUE}👤 Checking IAM Roles...${NC}"
AUTH_ROLE_NAME="Cognito_harmonest_${ENV}_Auth_Role"
UNAUTH_ROLE_NAME="Cognito_harmonest_${ENV}_Unauth_Role"

# Check Authenticated Role
aws iam get-role --role-name "$AUTH_ROLE_NAME" --profile "$AWS_PROFILE" --region "$REGION" >/dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Authenticated Role exists: $AUTH_ROLE_NAME${NC}"
else
    echo -e "${RED}❌ Authenticated Role not found: $AUTH_ROLE_NAME${NC}"
fi

# Check Unauthenticated Role
aws iam get-role --role-name "$UNAUTH_ROLE_NAME" --profile "$AWS_PROFILE" --region "$REGION" >/dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Unauthenticated Role exists: $UNAUTH_ROLE_NAME${NC}"
else
    echo -e "${RED}❌ Unauthenticated Role not found: $UNAUTH_ROLE_NAME${NC}"
fi

# Check 4: IAM Policies
echo -e "${BLUE}📋 Checking IAM Policies...${NC}"
POLICIES=(
    "Harmonest-${ENV}-Guest-Policy"
    "Harmonest-${ENV}-User-Policy"
    "Harmonest-${ENV}-Support-Policy"
    "Harmonest-${ENV}-Admin-Policy"
    "Harmonest-${ENV}-Owner-Policy"
    "Harmonest-${ENV}-SuperAdmin-Policy"
)

for policy in "${POLICIES[@]}"; do
    POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${policy}"
    aws iam get-policy --policy-arn "$POLICY_ARN" --profile "$AWS_PROFILE" --region "$REGION" >/dev/null 2>&1

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Policy exists: $policy${NC}"
    else
        echo -e "${RED}❌ Policy not found: $policy${NC}"
    fi
done

# Check 5: Cognito User Groups
if [ ! -z "$USER_POOL_ID" ]; then
    echo -e "${BLUE}👥 Checking Cognito User Groups...${NC}"
    GROUPS=("guest" "user" "support" "admin" "owner" "super_admin")

    for group in "${GROUPS[@]}"; do
        aws cognito-idp get-group --group-name "$group" --user-pool-id "$USER_POOL_ID" --profile "$AWS_PROFILE" --region "$REGION" >/dev/null 2>&1

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Group exists: $group${NC}"
        else
            echo -e "${RED}❌ Group not found: $group${NC}"
        fi
    done
else
    echo -e "${YELLOW}⚠️  Skipping group check (User Pool not found)${NC}"
fi

# Check 6: Configuration Files
echo -e "${BLUE}📄 Checking Configuration Files...${NC}"
COGNITO_CONFIG_FILE="$SCRIPT_DIR/cognito_config_${ENV}.json"
POLICY_CONFIG_FILE="$SCRIPT_DIR/iam_policies_${ENV}.json"

if [ -f "$COGNITO_CONFIG_FILE" ]; then
    echo -e "${GREEN}✅ Cognito config exists: $COGNITO_CONFIG_FILE${NC}"
else
    echo -e "${RED}❌ Cognito config not found: $COGNITO_CONFIG_FILE${NC}"
fi

if [ -f "$POLICY_CONFIG_FILE" ]; then
    echo -e "${GREEN}✅ Policy config exists: $POLICY_CONFIG_FILE${NC}"
else
    echo -e "${RED}❌ Policy config not found: $POLICY_CONFIG_FILE${NC}"
fi

# Check 7: Users in User Pool
if [ ! -z "$USER_POOL_ID" ]; then
    echo -e "${BLUE}👤 Checking Users in User Pool...${NC}"

    USERS=$(aws cognito-idp list-users --user-pool-id "$USER_POOL_ID" --profile "$AWS_PROFILE" --region "$REGION" --query 'Users' --output json)
    USER_COUNT=$(echo "$USERS" | jq length)

    if [ "$USER_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✅ Found $USER_COUNT users in User Pool${NC}"

        # Show user details
        echo -e "${BLUE}📋 User Details:${NC}"
        echo "$USERS" | jq -r '.[] | "  • \(.Username) (\(.UserStatus)) - \(.Attributes[] | select(.Name=="email") | .Value)"'
    else
        echo -e "${YELLOW}⚠️  No users found in User Pool${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Skipping user check (User Pool not found)${NC}"
fi

echo
echo -e "${BLUE}📊 Summary for Environment: ${ENV}${NC}"
echo "=================================="

# Count existing resources
EXISTING_COUNT=0
TOTAL_COUNT=0

# User Pool + Client
TOTAL_COUNT=$((TOTAL_COUNT + 2))
if [ ! -z "$USER_POOL_ID" ]; then
    EXISTING_COUNT=$((EXISTING_COUNT + 1))
    if [ ! -z "$CLIENT_ID" ]; then
        EXISTING_COUNT=$((EXISTING_COUNT + 1))
    fi
fi

# Identity Pool
TOTAL_COUNT=$((TOTAL_COUNT + 1))
if [ ! -z "$IDENTITY_POOL_ID" ]; then
    EXISTING_COUNT=$((EXISTING_COUNT + 1))
fi

# IAM Roles (2)
TOTAL_COUNT=$((TOTAL_COUNT + 2))
aws iam get-role --role-name "$AUTH_ROLE_NAME" --profile "$AWS_PROFILE" --region "$REGION" >/dev/null 2>&1 && EXISTING_COUNT=$((EXISTING_COUNT + 1))
aws iam get-role --role-name "$UNAUTH_ROLE_NAME" --profile "$AWS_PROFILE" --region "$REGION" >/dev/null 2>&1 && EXISTING_COUNT=$((EXISTING_COUNT + 1))

# IAM Policies (6)
TOTAL_COUNT=$((TOTAL_COUNT + 6))
for policy in "${POLICIES[@]}"; do
    POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${policy}"
    aws iam get-policy --policy-arn "$POLICY_ARN" --profile "$AWS_PROFILE" --region "$REGION" >/dev/null 2>&1 && EXISTING_COUNT=$((EXISTING_COUNT + 1))
done

# Groups (6)
if [ ! -z "$USER_POOL_ID" ]; then
    TOTAL_COUNT=$((TOTAL_COUNT + 6))
    for group in "${GROUPS[@]}"; do
        aws cognito-idp get-group --group-name "$group" --user-pool-id "$USER_POOL_ID" --profile "$AWS_PROFILE" --region "$REGION" >/dev/null 2>&1 && EXISTING_COUNT=$((EXISTING_COUNT + 1))
    done
fi

echo -e "${BLUE}📊 Resources Status: ${EXISTING_COUNT}/${TOTAL_COUNT} exist${NC}"

if [ "$EXISTING_COUNT" -eq "$TOTAL_COUNT" ]; then
    echo -e "${GREEN}🎉 All resources are properly configured!${NC}"
elif [ "$EXISTING_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  No resources found. Run ./create_cognito_infrastructure.sh to set up.${NC}"
else
    echo -e "${YELLOW}⚠️  Partial setup detected. You may need to run setup scripts.${NC}"
fi

echo
echo -e "${BLUE}💡 Next Steps:${NC}"
if [ "$EXISTING_COUNT" -lt "$TOTAL_COUNT" ]; then
    echo "1. Run ./create_cognito_infrastructure.sh (if Cognito resources missing)"
    echo "2. Run ./create_iam_user_roles.sh (if IAM policies missing)"
    echo "3. Run ./manage_cognito_users.sh (to manage users)"
else
    echo "1. Your infrastructure is complete!"
    echo "2. Use ./manage_cognito_users.sh to manage users"
    echo "3. Test your application authentication"
fi
