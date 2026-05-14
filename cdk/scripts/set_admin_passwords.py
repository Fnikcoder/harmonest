#!/usr/bin/env python3
"""
Script to set known passwords for admin users in Cognito User Pool
"""
import boto3
import sys
import getpass
from botocore.exceptions import ClientError

def get_user_pool_id():
    """Get the User Pool ID from CloudFormation stack"""
    session = boto3.Session(profile_name='harmonestadmin')
    cf_client = session.client('cloudformation', region_name='eu-central-1')
    
    try:
        response = cf_client.describe_stacks(StackName='HarmonestUserManagement-prod')
        
        # Look for User Pool ID in stack resources
        resources_response = cf_client.describe_stack_resources(StackName='HarmonestUserManagement-prod')
        
        for resource in resources_response['StackResources']:
            if resource['ResourceType'] == 'AWS::Cognito::UserPool':
                return resource['PhysicalResourceId']
        
        raise ValueError("User Pool not found in stack resources")
        
    except ClientError as e:
        print(f"Error getting User Pool ID: {e}")
        return None

def set_user_password(user_pool_id, username, password):
    """Set a permanent password for a user"""
    session = boto3.Session(profile_name='harmonestadmin')
    cognito_client = session.client('cognito-idp', region_name='eu-central-1')
    
    try:
        # Set permanent password
        cognito_client.admin_set_user_password(
            UserPoolId=user_pool_id,
            Username=username,
            Password=password,
            Permanent=True
        )
        print(f"✅ Password set successfully for {username}")
        return True
        
    except ClientError as e:
        print(f"❌ Error setting password for {username}: {e}")
        return False

def main():
    print("🔐 Admin User Password Setup")
    print("=" * 40)
    
    # Get User Pool ID
    print("Getting User Pool ID...")
    user_pool_id = get_user_pool_id()
    
    if not user_pool_id:
        print("❌ Could not retrieve User Pool ID")
        sys.exit(1)
    
    print(f"✅ Found User Pool: {user_pool_id}")
    print()
    
    # Admin users to update
    admin_users = [
        {
            'email': 'support@harmonest.de',
            'role': 'admin'
        },
        {
            'email': 'fnikcoder@gmail.com', 
            'role': 'super_admin'
        }
    ]
    
    # Set passwords for each user
    for user in admin_users:
        print(f"Setting password for {user['email']} ({user['role']})...")
        
        # Prompt for password
        while True:
            password = getpass.getpass(f"Enter password for {user['email']}: ")
            confirm_password = getpass.getpass("Confirm password: ")
            
            if password == confirm_password:
                if len(password) >= 8:
                    break
                else:
                    print("❌ Password must be at least 8 characters long")
            else:
                print("❌ Passwords do not match")
        
        # Set the password
        success = set_user_password(user_pool_id, user['email'], password)
        
        if success:
            print(f"✅ {user['email']} can now log in with the password you set")
        else:
            print(f"❌ Failed to set password for {user['email']}")
        
        print()
    
    print("🎉 Admin password setup complete!")
    print()
    print("📋 Login Information:")
    print("- User Pool ID:", user_pool_id)
    print("- Admin Users:")
    for user in admin_users:
        print(f"  • {user['email']} ({user['role']})")
    print()
    print("🌐 API Gateway Endpoint:")
    print("  https://8y8k22wgzj.execute-api.eu-central-1.amazonaws.com/prod/")

if __name__ == "__main__":
    main()
