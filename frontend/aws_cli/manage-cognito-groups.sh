#!/bin/bash

# Manage Cognito User Groups
# This script helps create groups and assign users to groups in AWS Cognito

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

echo -e "${BLUE}=== Cognito User Groups Management ===${NC}"
echo

# Check if AWS CLI is configured
if ! aws sts get-caller-identity --profile $AWS_PROFILE >/dev/null 2>&1; then
    echo -e "${RED}Error: AWS CLI not configured for profile $AWS_PROFILE${NC}"
    echo "Please run: aws configure --profile $AWS_PROFILE"
    exit 1
fi

echo -e "${GREEN}AWS Profile: $AWS_PROFILE${NC}"
echo -e "${GREEN}User Pool ID: $USER_POOL_ID${NC}"
echo

# Function to create a group
create_group() {
    local group_name=$1
    local description=$2
    local precedence=$3
    
    echo -e "${YELLOW}Creating group: $group_name${NC}"
    
    aws cognito-idp create-group \
        --group-name "$group_name" \
        --user-pool-id "$USER_POOL_ID" \
        --description "$description" \
        --precedence $precedence \
        --profile $AWS_PROFILE \
        --region $AWS_REGION
    
    echo -e "${GREEN}✓ Group '$group_name' created successfully${NC}"
}

# Function to add user to group
add_user_to_group() {
    local username=$1
    local group_name=$2
    
    echo -e "${YELLOW}Adding user '$username' to group '$group_name'${NC}"
    
    aws cognito-idp admin-add-user-to-group \
        --user-pool-id "$USER_POOL_ID" \
        --username "$username" \
        --group-name "$group_name" \
        --profile $AWS_PROFILE \
        --region $AWS_REGION
    
    echo -e "${GREEN}✓ User '$username' added to group '$group_name'${NC}"
}

# Function to list all groups
list_groups() {
    echo -e "${YELLOW}Listing all groups:${NC}"
    aws cognito-idp list-groups \
        --user-pool-id "$USER_POOL_ID" \
        --profile $AWS_PROFILE \
        --region $AWS_REGION \
        --query 'Groups[*].[GroupName,Description,Precedence]' \
        --output table
}

# Function to list users in a group
list_users_in_group() {
    local group_name=$1
    echo -e "${YELLOW}Users in group '$group_name':${NC}"
    aws cognito-idp list-users-in-group \
        --user-pool-id "$USER_POOL_ID" \
        --group-name "$group_name" \
        --profile $AWS_PROFILE \
        --region $AWS_REGION \
        --query 'Users[*].[Username,Attributes[?Name==`email`].Value|[0]]' \
        --output table
}

# Main menu
while true; do
    echo -e "${BLUE}Choose an action:${NC}"
    echo "1) Create all standard groups"
    echo "2) Add user to group"
    echo "3) List all groups"
    echo "4) List users in a group"
    echo "5) Create custom group"
    echo "6) Exit"
    read -p "Enter choice (1-6): " choice

    case $choice in
        1)
            echo -e "${YELLOW}Creating standard groups...${NC}"
            
            # Create groups with precedence (lower number = higher precedence)
            create_group "super_admin" "Super Administrator with full system access" 1 || true
            create_group "owner" "Owner with full management access" 2 || true
            create_group "admin" "Administrator with management access" 3 || true
            create_group "support" "Support staff with limited access" 4 || true
            create_group "user" "Regular users" 5 || true
            create_group "guest" "Guest users with minimal access" 6 || true
            
            echo -e "${GREEN}✓ All standard groups created${NC}"
            ;;
        2)
            read -p "Enter username (email): " username
            echo "Available groups:"
            echo "1) super_admin"
            echo "2) owner" 
            echo "3) admin"
            echo "4) support"
            echo "5) user"
            echo "6) guest"
            read -p "Enter group name: " group_name
            
            add_user_to_group "$username" "$group_name"
            ;;
        3)
            list_groups
            ;;
        4)
            read -p "Enter group name: " group_name
            list_users_in_group "$group_name"
            ;;
        5)
            read -p "Enter group name: " group_name
            read -p "Enter description: " description
            read -p "Enter precedence (1-100, lower = higher priority): " precedence
            
            create_group "$group_name" "$description" "$precedence"
            ;;
        6)
            echo -e "${GREEN}Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice. Please try again.${NC}"
            ;;
    esac
    echo
done
