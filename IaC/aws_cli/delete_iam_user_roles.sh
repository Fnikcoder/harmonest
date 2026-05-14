#!/bin/bash

# Delete IAM User Roles and Policies for Harmonest
# Removes all role-based IAM policies and Cognito groups
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

echo -e "${RED}🗑️  Harmonest IAM User Roles and Policies Deletion${NC}"
echo "===================================================="
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

echo -e "${RED}⚠️  WARNING: This will DELETE ALL IAM policies and groups for environment: ${ENV}${NC}"
echo -e "${RED}⚠️  This action CANNOT be undone!${NC}"
echo
read -p "Are you absolutely sure? Type 'DELETE' to confirm: " CONFIRM

if [ "$CONFIRM" != "DELETE" ]; then
    echo -e "${YELLOW}❌ Deletion cancelled.${NC}"
    exit 0
fi

# Load configuration files
COGNITO_CONFIG_FILE="$SCRIPT_DIR/cognito_config_${ENV}.json"
POLICY_CONFIG_FILE="$SCRIPT_DIR/iam_policies_${ENV}.json"

if [ -f "$COGNITO_CONFIG_FILE" ]; then
    USER_POOL_ID=$(jq -r '.userPoolId' "$COGNITO_CONFIG_FILE")
else
    echo -e "${YELLOW}⚠️  Cognito config file not found, will skip group deletion${NC}"
    USER_POOL_ID=""
fi

echo -e "${BLUE}📋 Deleting IAM policies and groups for environment: ${ENV}${NC}"
echo

# Step 1: Delete Cognito User Groups
if [ ! -z "$USER_POOL_ID" ]; then
    echo -e "${BLUE}🗑️  Step 1: Deleting Cognito User Groups...${NC}"
    
    GROUPS=("guest" "user" "support" "admin" "owner" "super_admin")
    
    for group in "${GROUPS[@]}"; do
        echo -e "${YELLOW}Deleting group: $group${NC}"
        aws cognito-idp delete-group \
          --group-name "$group" \
          --user-pool-id "$USER_POOL_ID" \
          --profile "$AWS_PROFILE" \
          --region "$REGION" 2>/dev/null || echo "Group may not exist"
    done
    
    echo -e "${GREEN}✅ Cognito groups deletion completed${NC}"
else
    echo -e "${YELLOW}⚠️  Skipping Cognito groups deletion (User Pool ID not found)${NC}"
fi

# Step 2: Delete IAM Policies
echo -e "${BLUE}🗑️  Step 2: Deleting IAM Policies...${NC}"

POLICIES=(
    "Harmonest-${ENV}-Guest-Policy"
    "Harmonest-${ENV}-User-Policy"
    "Harmonest-${ENV}-Support-Policy"
    "Harmonest-${ENV}-Admin-Policy"
    "Harmonest-${ENV}-Owner-Policy"
    "Harmonest-${ENV}-SuperAdmin-Policy"
)

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --profile "$AWS_PROFILE")

for policy in "${POLICIES[@]}"; do
    echo -e "${YELLOW}Deleting policy: $policy${NC}"
    
    POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${policy}"
    
    # Check if policy exists
    aws iam get-policy --policy-arn "$POLICY_ARN" --profile "$AWS_PROFILE" --region "$REGION" >/dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        # Get all policy versions
        VERSIONS=$(aws iam list-policy-versions --policy-arn "$POLICY_ARN" --profile "$AWS_PROFILE" --region "$REGION" --query 'Versions[?!IsDefaultVersion].VersionId' --output text)
        
        # Delete non-default versions first
        for version in $VERSIONS; do
            if [ ! -z "$version" ]; then
                echo -e "${YELLOW}  Deleting policy version: $version${NC}"
                aws iam delete-policy-version \
                  --policy-arn "$POLICY_ARN" \
                  --version-id "$version" \
                  --profile "$AWS_PROFILE" \
                  --region "$REGION" 2>/dev/null || echo "Version may not exist"
            fi
        done
        
        # Delete the policy
        aws iam delete-policy \
          --policy-arn "$POLICY_ARN" \
          --profile "$AWS_PROFILE" \
          --region "$REGION"
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Policy deleted: $policy${NC}"
        else
            echo -e "${RED}❌ Failed to delete policy: $policy${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Policy not found: $policy${NC}"
    fi
done

# Step 3: Delete configuration file
if [ -f "$POLICY_CONFIG_FILE" ]; then
    echo -e "${BLUE}🗑️  Step 3: Deleting policy configuration file...${NC}"
    rm -f "$POLICY_CONFIG_FILE"
    echo -e "${GREEN}✅ Policy configuration file deleted: $POLICY_CONFIG_FILE${NC}"
fi

echo
echo -e "${GREEN}🎉 IAM User Roles and Policies Deletion Complete!${NC}"
echo
echo -e "${BLUE}📋 Summary:${NC}"
echo "  • Environment: $ENV"
echo "  • All IAM policies deleted"
echo "  • All Cognito groups deleted"
echo "  • Configuration file removed"
echo
echo -e "${YELLOW}⚠️  Remember to:${NC}"
echo "1. Verify that all policies have been removed from AWS Console"
echo "2. Check that no resources are still referencing the deleted policies"
echo "3. Update your application configuration if needed"
echo
echo -e "${RED}⚠️  This deletion is permanent and cannot be undone!${NC}"
