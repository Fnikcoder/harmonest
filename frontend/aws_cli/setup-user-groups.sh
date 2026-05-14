#!/bin/bash

# Quick setup script for Cognito user groups
# This script creates the standard groups and assigns your admin user

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_PROFILE="harmonestadmin"
AWS_REGION="eu-central-1"
USER_POOL_ID="eu-central-1_oOMDUFanW"

echo -e "${BLUE}=== Quick Cognito Groups Setup ===${NC}"
echo

# Check if AWS CLI is configured
if ! aws sts get-caller-identity --profile $AWS_PROFILE >/dev/null 2>&1; then
    echo -e "${RED}Error: AWS CLI not configured for profile $AWS_PROFILE${NC}"
    echo "Please run: aws configure --profile $AWS_PROFILE"
    exit 1
fi

echo -e "${GREEN}Setting up Cognito user groups...${NC}"
echo

# Create groups (ignore errors if they already exist)
echo -e "${YELLOW}Creating groups...${NC}"

aws cognito-idp create-group \
    --group-name "super_admin" \
    --user-pool-id "$USER_POOL_ID" \
    --description "Super Administrator with full system access" \
    --precedence 1 \
    --profile $AWS_PROFILE \
    --region $AWS_REGION 2>/dev/null || echo "Group super_admin already exists"

aws cognito-idp create-group \
    --group-name "owner" \
    --user-pool-id "$USER_POOL_ID" \
    --description "Owner with full management access" \
    --precedence 2 \
    --profile $AWS_PROFILE \
    --region $AWS_REGION 2>/dev/null || echo "Group owner already exists"

aws cognito-idp create-group \
    --group-name "admin" \
    --user-pool-id "$USER_POOL_ID" \
    --description "Administrator with management access" \
    --precedence 3 \
    --profile $AWS_PROFILE \
    --region $AWS_REGION 2>/dev/null || echo "Group admin already exists"

aws cognito-idp create-group \
    --group-name "support" \
    --user-pool-id "$USER_POOL_ID" \
    --description "Support staff with limited access" \
    --precedence 4 \
    --profile $AWS_PROFILE \
    --region $AWS_REGION 2>/dev/null || echo "Group support already exists"

aws cognito-idp create-group \
    --group-name "user" \
    --user-pool-id "$USER_POOL_ID" \
    --description "Regular users" \
    --precedence 5 \
    --profile $AWS_PROFILE \
    --region $AWS_REGION 2>/dev/null || echo "Group user already exists"

aws cognito-idp create-group \
    --group-name "guest" \
    --user-pool-id "$USER_POOL_ID" \
    --description "Guest users with minimal access" \
    --precedence 6 \
    --profile $AWS_PROFILE \
    --region $AWS_REGION 2>/dev/null || echo "Group guest already exists"

echo -e "${GREEN}✓ Groups created successfully${NC}"
echo

# Prompt for admin user
echo -e "${YELLOW}Now let's assign an admin user...${NC}"
read -p "Enter your email address to make super_admin: " admin_email

if [ ! -z "$admin_email" ]; then
    echo -e "${YELLOW}Adding $admin_email to super_admin group...${NC}"
    
    aws cognito-idp admin-add-user-to-group \
        --user-pool-id "$USER_POOL_ID" \
        --username "$admin_email" \
        --group-name "super_admin" \
        --profile $AWS_PROFILE \
        --region $AWS_REGION
    
    echo -e "${GREEN}✓ $admin_email added to super_admin group${NC}"
else
    echo -e "${YELLOW}Skipping user assignment${NC}"
fi

echo
echo -e "${GREEN}Setup complete!${NC}"
echo
echo -e "${BLUE}Next steps:${NC}"
echo "1. Login to your application with the admin email"
echo "2. The role checker component will show your groups from JWT token"
echo "3. You should see management panel access"
echo
echo -e "${YELLOW}To manage more users and groups, run:${NC}"
echo "bash aws_cli/manage-cognito-groups.sh"
