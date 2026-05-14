"""
Initialize Admin Users Lambda Function
Creates initial admin users in Cognito User Pool without requiring password change
"""
import json
import boto3
import os
import secrets
import string
from botocore.exceptions import ClientError

# Initialize AWS clients
cognito_client = boto3.client('cognito-idp')

# Environment variables
USER_POOL_ID = os.environ.get('USER_POOL_ID')

def generate_secure_password(length=12):
    """Generate a secure random password"""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    password = ''.join(secrets.choice(alphabet) for _ in range(length))
    
    # Ensure password meets requirements
    if (any(c.islower() for c in password) and 
        any(c.isupper() for c in password) and 
        any(c.isdigit() for c in password) and 
        any(c in "!@#$%^&*" for c in password)):
        return password
    else:
        # Regenerate if requirements not met
        return generate_secure_password(length)

def create_admin_user(email, groups, force_password_change=False):
    """Create an admin user in Cognito"""
    try:
        # Generate a secure password
        password = generate_secure_password()
        
        # Check if user already exists
        try:
            existing_user = cognito_client.admin_get_user(
                UserPoolId=USER_POOL_ID,
                Username=email
            )
            print(f"User {email} already exists, updating groups...")
            
            # Update user groups
            for group in groups:
                try:
                    cognito_client.admin_add_user_to_group(
                        UserPoolId=USER_POOL_ID,
                        Username=email,
                        GroupName=group
                    )
                    print(f"Added {email} to group {group}")
                except ClientError as e:
                    if e.response['Error']['Code'] != 'ResourceExistsException':
                        print(f"Warning: Failed to add {email} to group {group}: {e}")
            
            return {
                'email': email,
                'status': 'updated',
                'message': 'User already existed, groups updated'
            }
            
        except ClientError as e:
            if e.response['Error']['Code'] != 'UserNotFoundException':
                raise e
        
        # Create new user
        create_response = cognito_client.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=email,
            UserAttributes=[
                {'Name': 'email', 'Value': email},
                {'Name': 'email_verified', 'Value': 'true'}
            ],
            TemporaryPassword=password,
            MessageAction='SUPPRESS'  # Don't send welcome email
        )
        
        user_id = create_response['User']['Username']
        print(f"Created user {email} with ID {user_id}")
        
        # Set permanent password if requested
        if not force_password_change:
            cognito_client.admin_set_user_password(
                UserPoolId=USER_POOL_ID,
                Username=email,
                Password=password,
                Permanent=True
            )
            print(f"Set permanent password for {email}")
        
        # Add user to groups
        for group in groups:
            try:
                cognito_client.admin_add_user_to_group(
                    UserPoolId=USER_POOL_ID,
                    Username=email,
                    GroupName=group
                )
                print(f"Added {email} to group {group}")
            except ClientError as e:
                print(f"Warning: Failed to add {email} to group {group}: {e}")
        
        return {
            'email': email,
            'user_id': user_id,
            'password': password,
            'status': 'created',
            'groups': groups,
            'force_password_change': force_password_change
        }
        
    except Exception as e:
        print(f"Error creating user {email}: {e}")
        raise e

def handler(event, context):
    """Lambda handler to initialize admin users"""
    try:
        print("Starting admin user initialization...")
        
        if not USER_POOL_ID:
            raise ValueError("USER_POOL_ID environment variable not set")
        
        # Define admin users
        admin_users = [
            {
                'email': 'support@harmonest.de',
                'groups': ['admin'],
                'force_password_change': False
            },
            {
                'email': 'fnikcoder@gmail.com',
                'groups': ['super_admin'],
                'force_password_change': False
            }
        ]
        
        results = []
        
        # Create each admin user
        for user_config in admin_users:
            try:
                result = create_admin_user(
                    email=user_config['email'],
                    groups=user_config['groups'],
                    force_password_change=user_config.get('force_password_change', False)
                )
                results.append(result)
                print(f"Successfully processed {user_config['email']}")
                
            except Exception as e:
                error_result = {
                    'email': user_config['email'],
                    'status': 'error',
                    'error': str(e)
                }
                results.append(error_result)
                print(f"Failed to process {user_config['email']}: {e}")
        
        # Return results
        response = {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Admin user initialization completed',
                'results': results
            }, indent=2)
        }
        
        print("Admin user initialization completed successfully")
        return response
        
    except Exception as e:
        print(f"Error in admin user initialization: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'message': 'Failed to initialize admin users'
            })
        }

def lambda_handler(event, context):
    """Alternative entry point for Lambda"""
    return handler(event, context)
