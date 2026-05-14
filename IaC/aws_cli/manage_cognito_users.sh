#!/bin/bash

# Cognito User Management for Harmonest
# Create, update, delete, and manage users in Cognito User Pool
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

echo -e "${BLUE}👥 Harmonest Cognito User Management${NC}"
echo "===================================="
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

# Load configuration
COGNITO_CONFIG_FILE="$SCRIPT_DIR/cognito_config_${ENV}.json"

if [ ! -f "$COGNITO_CONFIG_FILE" ]; then
    echo -e "${RED}❌ Cognito config file not found: $COGNITO_CONFIG_FILE${NC}"
    echo -e "${YELLOW}💡 Run ./create_cognito_infrastructure.sh first${NC}"
    exit 1
fi

USER_POOL_ID=$(jq -r '.userPoolId' "$COGNITO_CONFIG_FILE")

echo -e "${BLUE}📋 Environment: ${ENV}${NC}"
echo -e "${BLUE}📋 User Pool ID: ${USER_POOL_ID}${NC}"
echo

# Main menu
while true; do
    echo -e "${BLUE}🔧 User Management Options:${NC}"
    echo "1) List all users"
    echo "2) Create new user"
    echo "3) Update user attributes"
    echo "4) Enable/Disable user"
    echo "5) Reset user password"
    echo "6) Delete user"
    echo "7) Get user details"
    echo "8) Exit"
    echo
    read -p "Enter choice (1-8): " choice

    case $choice in
        1)
            # List all users
            echo -e "${BLUE}📋 Listing all users...${NC}"
            aws cognito-idp list-users \
              --user-pool-id "$USER_POOL_ID" \
              --profile "$AWS_PROFILE" \
              --region "$REGION" \
              --query 'Users[*].{Username:Username,Email:Attributes[?Name==`email`].Value|[0],Role:Attributes[?Name==`custom:role`].Value|[0],Status:UserStatus,Enabled:Enabled}' \
              --output table
            ;;
        
        2)
            # Create new user
            echo -e "${BLUE}👤 Creating new user...${NC}"
            read -p "Enter email: " USER_EMAIL
            read -p "Enter first name: " USER_FIRST_NAME
            read -p "Enter last name: " USER_LAST_NAME
            
            echo "Select role:"
            echo "1) guest"
            echo "2) user"
            echo "3) support"
            echo "4) admin"
            echo "5) owner"
            echo "6) super_admin"
            read -p "Enter choice (1-6): " role_choice
            
            case $role_choice in
                1) USER_ROLE="guest" ;;
                2) USER_ROLE="user" ;;
                3) USER_ROLE="support" ;;
                4) USER_ROLE="admin" ;;
                5) USER_ROLE="owner" ;;
                6) USER_ROLE="super_admin" ;;
                *) echo -e "${RED}❌ Invalid role choice${NC}"; continue ;;
            esac
            
            read -s -p "Enter temporary password (min 8 chars): " TEMP_PASSWORD
            echo
            
            aws cognito-idp admin-create-user \
              --user-pool-id "$USER_POOL_ID" \
              --username "$USER_EMAIL" \
              --user-attributes Name=email,Value="$USER_EMAIL" Name=given_name,Value="$USER_FIRST_NAME" Name=family_name,Value="$USER_LAST_NAME" Name=custom:role,Value="$USER_ROLE" Name=custom:status,Value=active Name=email_verified,Value=true \
              --temporary-password "$TEMP_PASSWORD" \
              --message-action SUPPRESS \
              --profile "$AWS_PROFILE" \
              --region "$REGION"
            
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ User created successfully: $USER_EMAIL${NC}"
            else
                echo -e "${RED}❌ Failed to create user${NC}"
            fi
            ;;
        
        3)
            # Update user attributes
            echo -e "${BLUE}✏️  Updating user attributes...${NC}"
            read -p "Enter user email: " USER_EMAIL
            
            echo "What would you like to update?"
            echo "1) First name"
            echo "2) Last name"
            echo "3) Role"
            echo "4) Status"
            read -p "Enter choice (1-4): " update_choice
            
            case $update_choice in
                1)
                    read -p "Enter new first name: " NEW_VALUE
                    ATTRIBUTE_NAME="given_name"
                    ;;
                2)
                    read -p "Enter new last name: " NEW_VALUE
                    ATTRIBUTE_NAME="family_name"
                    ;;
                3)
                    echo "Select new role:"
                    echo "1) guest"
                    echo "2) user"
                    echo "3) support"
                    echo "4) admin"
                    echo "5) owner"
                    echo "6) super_admin"
                    read -p "Enter choice (1-6): " role_choice
                    
                    case $role_choice in
                        1) NEW_VALUE="guest" ;;
                        2) NEW_VALUE="user" ;;
                        3) NEW_VALUE="support" ;;
                        4) NEW_VALUE="admin" ;;
                        5) NEW_VALUE="owner" ;;
                        6) NEW_VALUE="super_admin" ;;
                        *) echo -e "${RED}❌ Invalid role choice${NC}"; continue ;;
                    esac
                    ATTRIBUTE_NAME="custom:role"
                    ;;
                4)
                    echo "Select new status:"
                    echo "1) active"
                    echo "2) suspended"
                    echo "3) pending_verification"
                    read -p "Enter choice (1-3): " status_choice
                    
                    case $status_choice in
                        1) NEW_VALUE="active" ;;
                        2) NEW_VALUE="suspended" ;;
                        3) NEW_VALUE="pending_verification" ;;
                        *) echo -e "${RED}❌ Invalid status choice${NC}"; continue ;;
                    esac
                    ATTRIBUTE_NAME="custom:status"
                    ;;
                *)
                    echo -e "${RED}❌ Invalid choice${NC}"
                    continue
                    ;;
            esac
            
            aws cognito-idp admin-update-user-attributes \
              --user-pool-id "$USER_POOL_ID" \
              --username "$USER_EMAIL" \
              --user-attributes Name="$ATTRIBUTE_NAME",Value="$NEW_VALUE" \
              --profile "$AWS_PROFILE" \
              --region "$REGION"
            
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ User updated successfully${NC}"
            else
                echo -e "${RED}❌ Failed to update user${NC}"
            fi
            ;;
        
        4)
            # Enable/Disable user
            echo -e "${BLUE}🔄 Enable/Disable user...${NC}"
            read -p "Enter user email: " USER_EMAIL
            
            echo "Select action:"
            echo "1) Enable user"
            echo "2) Disable user"
            read -p "Enter choice (1-2): " action_choice
            
            case $action_choice in
                1)
                    aws cognito-idp admin-enable-user \
                      --user-pool-id "$USER_POOL_ID" \
                      --username "$USER_EMAIL" \
                      --profile "$AWS_PROFILE" \
                      --region "$REGION"
                    
                    if [ $? -eq 0 ]; then
                        echo -e "${GREEN}✅ User enabled successfully${NC}"
                    else
                        echo -e "${RED}❌ Failed to enable user${NC}"
                    fi
                    ;;
                2)
                    aws cognito-idp admin-disable-user \
                      --user-pool-id "$USER_POOL_ID" \
                      --username "$USER_EMAIL" \
                      --profile "$AWS_PROFILE" \
                      --region "$REGION"
                    
                    if [ $? -eq 0 ]; then
                        echo -e "${GREEN}✅ User disabled successfully${NC}"
                    else
                        echo -e "${RED}❌ Failed to disable user${NC}"
                    fi
                    ;;
                *)
                    echo -e "${RED}❌ Invalid choice${NC}"
                    ;;
            esac
            ;;
        
        5)
            # Reset user password
            echo -e "${BLUE}🔑 Reset user password...${NC}"
            read -p "Enter user email: " USER_EMAIL
            read -s -p "Enter new temporary password (min 8 chars): " NEW_PASSWORD
            echo
            
            aws cognito-idp admin-set-user-password \
              --user-pool-id "$USER_POOL_ID" \
              --username "$USER_EMAIL" \
              --password "$NEW_PASSWORD" \
              --temporary \
              --profile "$AWS_PROFILE" \
              --region "$REGION"
            
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ Password reset successfully${NC}"
                echo -e "${YELLOW}💡 User will need to change password on next login${NC}"
            else
                echo -e "${RED}❌ Failed to reset password${NC}"
            fi
            ;;
        
        6)
            # Delete user
            echo -e "${RED}🗑️  Delete user...${NC}"
            read -p "Enter user email: " USER_EMAIL
            
            echo -e "${RED}⚠️  WARNING: This will permanently delete the user!${NC}"
            read -p "Are you sure? Type 'DELETE' to confirm: " CONFIRM
            
            if [ "$CONFIRM" = "DELETE" ]; then
                aws cognito-idp admin-delete-user \
                  --user-pool-id "$USER_POOL_ID" \
                  --username "$USER_EMAIL" \
                  --profile "$AWS_PROFILE" \
                  --region "$REGION"
                
                if [ $? -eq 0 ]; then
                    echo -e "${GREEN}✅ User deleted successfully${NC}"
                else
                    echo -e "${RED}❌ Failed to delete user${NC}"
                fi
            else
                echo -e "${YELLOW}❌ Deletion cancelled${NC}"
            fi
            ;;
        
        7)
            # Get user details
            echo -e "${BLUE}🔍 Get user details...${NC}"
            read -p "Enter user email: " USER_EMAIL
            
            aws cognito-idp admin-get-user \
              --user-pool-id "$USER_POOL_ID" \
              --username "$USER_EMAIL" \
              --profile "$AWS_PROFILE" \
              --region "$REGION" \
              --query '{Username:Username,UserStatus:UserStatus,Enabled:Enabled,UserCreateDate:UserCreateDate,UserLastModifiedDate:UserLastModifiedDate,Attributes:UserAttributes}' \
              --output json | jq '.'
            ;;
        
        8)
            # Exit
            echo -e "${GREEN}👋 Goodbye!${NC}"
            exit 0
            ;;
        
        *)
            echo -e "${RED}❌ Invalid choice. Please try again.${NC}"
            ;;
    esac
    
    echo
    echo "Press Enter to continue..."
    read
    echo
done
