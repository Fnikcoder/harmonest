#!/bin/bash

# Create Simple Super Admin User (without custom attributes)
# Role will be managed through the application

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# AWS Profile to use
CONFIG_FILE="$(dirname "$0")/aws_config.json"
AWS_PROFILE=$(jq -r '.aws_profile' "$CONFIG_FILE")
REGION=$(jq -r '.region' "$CONFIG_FILE")

echo -e "${BLUE}🔐 Harmonest Simple Super Admin Creation${NC}"
echo "========================================"

# Ask for environment
read -p "Create super admin for [dev/prod]? " ENV

# Validate environment
if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
  echo -e "${RED}❌ Invalid environment: choose 'dev' or 'prod'${NC}"
  exit 1
fi

# Load Cognito configuration
COGNITO_CONFIG_FILE="$(dirname "$0")/cognito_config_$ENV.json"

if [ ! -f "$COGNITO_CONFIG_FILE" ]; then
  echo -e "${RED}❌ Cognito configuration file not found: $COGNITO_CONFIG_FILE${NC}"
  exit 1
fi

USER_POOL_ID=$(jq -r '.userPoolId' "$COGNITO_CONFIG_FILE")

echo -e "${BLUE}📍 Using region: $REGION${NC}"
echo -e "${BLUE}🔧 Using profile: $AWS_PROFILE${NC}"
echo -e "${BLUE}🌍 Environment: $ENV${NC}"
echo -e "${BLUE}👥 User Pool ID: $USER_POOL_ID${NC}"
echo ""

# Test AWS credentials
echo -e "${YELLOW}🔍 Testing AWS credentials...${NC}"
if ! aws sts get-caller-identity --profile $AWS_PROFILE >/dev/null 2>&1; then
  echo -e "${RED}❌ AWS credentials test failed. Please check your profile configuration.${NC}"
  exit 1
fi
echo -e "${GREEN}✅ AWS credentials verified${NC}"
echo ""

# Get super admin details
echo -e "${BLUE}👤 Super Admin User Details${NC}"
echo "=========================="

read -p "Enter super admin email: " ADMIN_EMAIL
read -p "Enter super admin first name: " ADMIN_FIRST_NAME
read -p "Enter super admin last name: " ADMIN_LAST_NAME
read -p "Enter super admin phone (optional, format: +1234567890): " ADMIN_PHONE

# Validate email format
if [[ ! "$ADMIN_EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
  echo -e "${RED}❌ Invalid email format${NC}"
  exit 1
fi

# Generate temporary password that meets policy requirements
TEMP_PASSWORD="TempPass$(openssl rand -hex 4)!"

echo ""
echo -e "${YELLOW}⚠️  Temporary password generated: $TEMP_PASSWORD${NC}"
echo -e "${YELLOW}⚠️  User will be required to change password on first login${NC}"
echo -e "${YELLOW}⚠️  Role will be set to super_admin through the application${NC}"
echo ""

read -p "Continue with super admin creation? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}⚠️ Operation cancelled${NC}"
  exit 0
fi

echo ""
echo -e "${BLUE}👤 Creating super admin user...${NC}"

# Create user attributes (without custom role attribute)
USER_ATTRIBUTES="Name=email,Value=$ADMIN_EMAIL Name=given_name,Value=$ADMIN_FIRST_NAME Name=family_name,Value=$ADMIN_LAST_NAME Name=email_verified,Value=true"

if [ ! -z "$ADMIN_PHONE" ]; then
  USER_ATTRIBUTES="$USER_ATTRIBUTES Name=phone_number,Value=$ADMIN_PHONE Name=phone_number_verified,Value=true"
fi

# Create the user
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "$ADMIN_EMAIL" \
  --user-attributes $USER_ATTRIBUTES \
  --temporary-password "$TEMP_PASSWORD" \
  --message-action SUPPRESS \
  --profile $AWS_PROFILE \
  --region $REGION

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Super admin user created successfully${NC}"
else
  echo -e "${RED}❌ Failed to create super admin user${NC}"
  exit 1
fi

# Set permanent password (optional)
read -p "Set a permanent password now? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  read -s -p "Enter permanent password (min 8 chars, must include uppercase, lowercase, number, special char): " PERMANENT_PASSWORD
  echo
  read -s -p "Confirm permanent password: " CONFIRM_PASSWORD
  echo
  
  if [ "$PERMANENT_PASSWORD" != "$CONFIRM_PASSWORD" ]; then
    echo -e "${RED}❌ Passwords do not match${NC}"
    echo -e "${YELLOW}⚠️ User will need to change password on first login using temporary password: $TEMP_PASSWORD${NC}"
  else
    # Set permanent password
    aws cognito-idp admin-set-user-password \
      --user-pool-id "$USER_POOL_ID" \
      --username "$ADMIN_EMAIL" \
      --password "$PERMANENT_PASSWORD" \
      --permanent \
      --profile $AWS_PROFILE \
      --region $REGION
    
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}✅ Permanent password set successfully${NC}"
    else
      echo -e "${RED}❌ Failed to set permanent password${NC}"
      echo -e "${YELLOW}⚠️ User will need to change password on first login using temporary password: $TEMP_PASSWORD${NC}"
    fi
  fi
fi

echo ""
echo -e "${GREEN}🎉 Super Admin User Creation Completed!${NC}"
echo ""
echo -e "${BLUE}📋 Super Admin Details:${NC}"
echo "  • Email: $ADMIN_EMAIL"
echo "  • Name: $ADMIN_FIRST_NAME $ADMIN_LAST_NAME"
echo "  • Phone: ${ADMIN_PHONE:-'Not provided'}"
echo "  • Environment: $ENV"
echo ""
echo -e "${YELLOW}🔐 Login Instructions:${NC}"
echo "1. Go to your application login page (http://localhost:4200/login)"
echo "2. Use email: $ADMIN_EMAIL"
if [ "$PERMANENT_PASSWORD" != "$CONFIRM_PASSWORD" ] || [ -z "$PERMANENT_PASSWORD" ]; then
  echo "3. Use temporary password: $TEMP_PASSWORD"
  echo "4. You will be prompted to set a new password"
else
  echo "3. Use the permanent password you just set"
fi
echo ""
echo -e "${BLUE}🔧 Role Assignment:${NC}"
echo "• The user role will need to be set to 'super_admin' through the application"
echo "• You can do this by updating the user record in DynamoDB"
echo "• Or implement role management in your admin interface"
echo ""
echo -e "${BLUE}🔒 Security Notes:${NC}"
echo "• This user will have the highest level of access once role is assigned"
echo "• Consider enabling MFA for this account"
echo "• Monitor super admin activities regularly"
