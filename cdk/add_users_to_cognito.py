#!/usr/bin/env python3
"""
Script to add users to Cognito User Pool with their roles
Usage: python add_users_to_cognito.py
"""

import boto3
import json
import sys
from typing import List, Dict
import secrets
import string

# Configuration
USER_POOL_ID = "eu-central-1_oOMDUFanW"
AWS_REGION = "eu-central-1"
AWS_PROFILE = "harmonestadmin"

# Available roles/groups
AVAILABLE_ROLES = {
    "1": "owner",
    "2": "super_admin", 
    "3": "admin",
    "4": "support",
    "5": "guest"
}

class CognitoUserManager:
    def __init__(self):
        # Initialize AWS session with profile
        session = boto3.Session(profile_name=AWS_PROFILE)
        self.cognito_client = session.client('cognito-idp', region_name=AWS_REGION)
        self.user_pool_id = USER_POOL_ID
        
    def generate_temp_password(self, length=12):
        """Generate a temporary password"""
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        password = ''.join(secrets.choice(alphabet) for _ in range(length))
        return password
    
    def list_existing_groups(self):
        """List all existing groups in the user pool"""
        try:
            response = self.cognito_client.list_groups(UserPoolId=self.user_pool_id)
            return [group['GroupName'] for group in response['Groups']]
        except Exception as e:
            print(f"❌ Error listing groups: {e}")
            return []
    
    def create_user(self, email: str, role: str, temp_password: str = None, send_email: bool = True):
        """Create a new user in Cognito User Pool"""
        try:
            # Generate temporary password if not provided
            if not temp_password:
                temp_password = self.generate_temp_password()
            
            # Create user
            response = self.cognito_client.admin_create_user(
                UserPoolId=self.user_pool_id,
                Username=email,
                UserAttributes=[
                    {'Name': 'email', 'Value': email},
                    {'Name': 'email_verified', 'Value': 'true'}
                ],
                TemporaryPassword=temp_password,
                MessageAction='SUPPRESS' if not send_email else 'RESEND',
                DesiredDeliveryMediums=['EMAIL'] if send_email else []
            )
            
            print(f"✅ User {email} created successfully")
            if not send_email:
                print(f"   Temporary password: {temp_password}")
            
            return True, temp_password
            
        except self.cognito_client.exceptions.UsernameExistsException:
            print(f"⚠️  User {email} already exists")
            return False, None
        except Exception as e:
            print(f"❌ Error creating user {email}: {e}")
            return False, None
    
    def add_user_to_group(self, email: str, role: str):
        """Add user to a specific group/role"""
        try:
            self.cognito_client.admin_add_user_to_group(
                UserPoolId=self.user_pool_id,
                Username=email,
                GroupName=role
            )
            print(f"✅ Added {email} to {role} group")
            return True
        except Exception as e:
            print(f"❌ Error adding {email} to {role} group: {e}")
            return False
    
    def remove_user_from_group(self, email: str, role: str):
        """Remove user from a specific group/role"""
        try:
            self.cognito_client.admin_remove_user_from_group(
                UserPoolId=self.user_pool_id,
                Username=email,
                GroupName=role
            )
            print(f"✅ Removed {email} from {role} group")
            return True
        except Exception as e:
            print(f"❌ Error removing {email} from {role} group: {e}")
            return False
    
    def get_user_groups(self, email: str):
        """Get all groups for a user"""
        try:
            response = self.cognito_client.admin_list_groups_for_user(
                UserPoolId=self.user_pool_id,
                Username=email
            )
            return [group['GroupName'] for group in response['Groups']]
        except Exception as e:
            print(f"❌ Error getting groups for {email}: {e}")
            return []
    
    def list_all_users(self):
        """List all users in the user pool"""
        try:
            users = []
            paginator = self.cognito_client.get_paginator('list_users')
            
            for page in paginator.paginate(UserPoolId=self.user_pool_id):
                for user in page['Users']:
                    email = None
                    for attr in user['Attributes']:
                        if attr['Name'] == 'email':
                            email = attr['Value']
                            break
                    
                    if email:
                        groups = self.get_user_groups(email)
                        users.append({
                            'email': email,
                            'status': user['UserStatus'],
                            'groups': groups
                        })
            
            return users
        except Exception as e:
            print(f"❌ Error listing users: {e}")
            return []

def display_menu():
    """Display the main menu"""
    print("\n" + "="*50)
    print("🔐 Cognito User Management")
    print("="*50)
    print("1. Add single user")
    print("2. Add multiple users from input")
    print("3. List all users")
    print("4. Update user role")
    print("5. Remove user from role")
    print("6. List available groups")
    print("7. Exit")
    print("="*50)

def display_roles():
    """Display available roles"""
    print("\nAvailable roles:")
    for key, role in AVAILABLE_ROLES.items():
        print(f"  {key}. {role}")

def get_user_input():
    """Get user information from input"""
    print("\n📝 Enter user information:")
    email = input("Email address: ").strip()
    
    if not email or '@' not in email:
        print("❌ Invalid email address")
        return None, None
    
    display_roles()
    role_choice = input("\nSelect role (1-5): ").strip()
    
    if role_choice not in AVAILABLE_ROLES:
        print("❌ Invalid role selection")
        return None, None
    
    role = AVAILABLE_ROLES[role_choice]
    return email, role

def add_multiple_users():
    """Add multiple users from input"""
    print("\n📝 Enter multiple users (format: email,role_number)")
    print("Example: john@example.com,3")
    print("Available roles: 1=owner, 2=super_admin, 3=admin, 4=support, 5=guest")
    print("Enter 'done' when finished:")
    
    users = []
    while True:
        user_input = input("User (email,role): ").strip()
        
        if user_input.lower() == 'done':
            break
        
        if ',' not in user_input:
            print("❌ Invalid format. Use: email,role_number")
            continue
        
        try:
            email, role_num = user_input.split(',', 1)
            email = email.strip()
            role_num = role_num.strip()
            
            if role_num not in AVAILABLE_ROLES:
                print(f"❌ Invalid role number: {role_num}")
                continue
            
            role = AVAILABLE_ROLES[role_num]
            users.append((email, role))
            print(f"✅ Added {email} ({role}) to queue")
            
        except ValueError:
            print("❌ Invalid format. Use: email,role_number")
    
    return users

def main():
    """Main function"""
    manager = CognitoUserManager()
    
    print(f"🚀 Connected to User Pool: {USER_POOL_ID}")
    print(f"📍 Region: {AWS_REGION}")
    print(f"👤 Profile: {AWS_PROFILE}")
    
    while True:
        display_menu()
        choice = input("\nSelect option (1-7): ").strip()
        
        if choice == '1':
            # Add single user
            email, role = get_user_input()
            if email and role:
                send_email = input("Send welcome email? (y/n): ").lower().startswith('y')
                success, temp_password = manager.create_user(email, role, send_email=send_email)
                if success:
                    manager.add_user_to_group(email, role)
        
        elif choice == '2':
            # Add multiple users
            users = add_multiple_users()
            if users:
                print(f"\n🔄 Processing {len(users)} users...")
                send_email = input("Send welcome emails? (y/n): ").lower().startswith('y')
                
                for email, role in users:
                    print(f"\n👤 Processing {email}...")
                    success, temp_password = manager.create_user(email, role, send_email=send_email)
                    if success:
                        manager.add_user_to_group(email, role)
        
        elif choice == '3':
            # List all users
            print("\n👥 All users in User Pool:")
            users = manager.list_all_users()
            if users:
                print(f"{'Email':<30} {'Status':<15} {'Groups'}")
                print("-" * 70)
                for user in users:
                    groups_str = ', '.join(user['groups']) if user['groups'] else 'No groups'
                    print(f"{user['email']:<30} {user['status']:<15} {groups_str}")
            else:
                print("No users found")
        
        elif choice == '4':
            # Update user role
            email = input("\nEnter user email: ").strip()
            if email:
                current_groups = manager.get_user_groups(email)
                print(f"Current groups: {', '.join(current_groups) if current_groups else 'None'}")
                
                display_roles()
                role_choice = input("Select new role (1-5): ").strip()
                
                if role_choice in AVAILABLE_ROLES:
                    new_role = AVAILABLE_ROLES[role_choice]
                    
                    # Remove from all current groups
                    for group in current_groups:
                        manager.remove_user_from_group(email, group)
                    
                    # Add to new group
                    manager.add_user_to_group(email, new_role)
        
        elif choice == '5':
            # Remove user from role
            email = input("\nEnter user email: ").strip()
            if email:
                current_groups = manager.get_user_groups(email)
                if current_groups:
                    print("Current groups:")
                    for i, group in enumerate(current_groups, 1):
                        print(f"  {i}. {group}")
                    
                    try:
                        group_choice = int(input("Select group to remove (number): ")) - 1
                        if 0 <= group_choice < len(current_groups):
                            group_to_remove = current_groups[group_choice]
                            manager.remove_user_from_group(email, group_to_remove)
                        else:
                            print("❌ Invalid selection")
                    except ValueError:
                        print("❌ Invalid number")
                else:
                    print("User has no groups")
        
        elif choice == '6':
            # List available groups
            groups = manager.list_existing_groups()
            print(f"\n📋 Available groups in User Pool:")
            for group in groups:
                print(f"  - {group}")
        
        elif choice == '7':
            # Exit
            print("\n👋 Goodbye!")
            break
        
        else:
            print("❌ Invalid option. Please select 1-7.")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Interrupted by user. Goodbye!")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)
