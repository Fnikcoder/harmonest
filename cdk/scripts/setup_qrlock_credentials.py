#!/usr/bin/env python3
"""
QRLock Credentials Setup Script
Sets up QRLock API credentials in AWS Secrets Manager
"""
import json
import boto3
import sys
import getpass
from typing import Dict, Any


def setup_qrlock_credentials(env_name: str, region: str = "eu-central-1", profile: str = None):
    """Setup QRLock credentials in AWS Secrets Manager"""
    
    # Initialize AWS session
    if profile:
        session = boto3.Session(profile_name=profile, region_name=region)
        sm = session.client('secretsmanager')
    else:
        sm = boto3.client('secretsmanager', region_name=region)
    
    secret_name = f"harmonest-{env_name}-qrlock-credentials"
    
    print(f"Setting up QRLock credentials for environment: {env_name}")
    print(f"Secret name: {secret_name}")
    print(f"Region: {region}")
    print()
    
    # Get credentials from user
    print("Please enter your QRLock API credentials:")
    email = input("QRLock Email: ").strip()
    password = getpass.getpass("QRLock Password: ").strip()
    
    if not email or not password:
        print("❌ Error: Both email and password are required")
        return False
    
    # Prepare credentials
    credentials = {
        "email": email,
        "password": password
    }
    
    try:
        # Check if secret already exists
        try:
            sm.describe_secret(SecretId=secret_name)
            print(f"📝 Secret {secret_name} already exists. Updating...")
            
            # Update existing secret
            sm.put_secret_value(
                SecretId=secret_name,
                SecretString=json.dumps(credentials)
            )
            
        except sm.exceptions.ResourceNotFoundException:
            print(f"🆕 Creating new secret: {secret_name}")
            
            # Create new secret
            sm.create_secret(
                Name=secret_name,
                Description="QRLock API credentials for door access management",
                SecretString=json.dumps(credentials)
            )
        
        print("✅ QRLock credentials successfully stored in AWS Secrets Manager")
        print()
        print("Next steps:")
        print("1. Deploy the QR Code Notification stack:")
        print(f"   cdk deploy --context env={env_name} --profile {profile or 'default'}")
        print()
        print("2. Test the credentials:")
        print(f"   python scripts/test_qrlock_connection.py {env_name}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error storing credentials: {str(e)}")
        return False


def verify_qrlock_credentials(env_name: str, region: str = "eu-central-1", profile: str = None):
    """Verify QRLock credentials by testing authentication"""
    
    # Initialize AWS session
    if profile:
        session = boto3.Session(profile_name=profile, region_name=region)
        sm = session.client('secretsmanager')
    else:
        sm = boto3.client('secretsmanager', region_name=region)
    
    secret_name = f"harmonest-{env_name}-qrlock-credentials"
    
    try:
        # Get credentials from Secrets Manager
        response = sm.get_secret_value(SecretId=secret_name)
        credentials = json.loads(response['SecretString'])
        
        print(f"📋 Retrieved credentials for: {credentials['email']}")
        
        # Test QRLock authentication
        import requests
        
        headers = {
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json"
        }
        
        payload = {
            "email": credentials["email"],
            "password": credentials["password"]
        }
        
        print("🔐 Testing QRLock authentication...")
        
        response = requests.post(
            "https://hms.qrlock.net/api/app/auth/signin",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("auth") and data.get("accessToken"):
                print("✅ QRLock authentication successful!")
                print(f"   Username: {data.get('username', 'N/A')}")
                print(f"   Authorities: {', '.join(data.get('authorities', []))}")
                return True
            else:
                print("❌ QRLock authentication failed: Invalid response")
                print(f"   Response: {data}")
                return False
        else:
            print(f"❌ QRLock authentication failed: HTTP {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error verifying credentials: {str(e)}")
        return False


def list_qrlock_secrets(region: str = "eu-central-1", profile: str = None):
    """List all QRLock-related secrets"""
    
    # Initialize AWS session
    if profile:
        session = boto3.Session(profile_name=profile, region_name=region)
        sm = session.client('secretsmanager')
    else:
        sm = boto3.client('secretsmanager', region_name=region)
    
    try:
        # List secrets with QRLock in the name
        response = sm.list_secrets(
            Filters=[
                {
                    'Key': 'name',
                    'Values': ['harmonest-*-qrlock-credentials']
                }
            ]
        )
        
        secrets = response.get('SecretList', [])
        
        if not secrets:
            print("No QRLock credential secrets found.")
            return
        
        print("QRLock Credential Secrets:")
        print("=" * 40)
        
        for secret in secrets:
            name = secret['Name']
            created = secret['CreatedDate'].strftime('%Y-%m-%d %H:%M:%S')
            modified = secret.get('LastChangedDate', secret['CreatedDate']).strftime('%Y-%m-%d %H:%M:%S')
            
            print(f"Name: {name}")
            print(f"Created: {created}")
            print(f"Modified: {modified}")
            print(f"Description: {secret.get('Description', 'N/A')}")
            print("-" * 40)
            
    except Exception as e:
        print(f"❌ Error listing secrets: {str(e)}")


def main():
    """Main function"""
    if len(sys.argv) < 2:
        print("QRLock Credentials Setup")
        print("=" * 30)
        print()
        print("Usage:")
        print("  python setup_qrlock_credentials.py <command> [options]")
        print()
        print("Commands:")
        print("  setup <env_name> [--profile <profile>] [--region <region>]")
        print("    Set up QRLock credentials for environment")
        print()
        print("  verify <env_name> [--profile <profile>] [--region <region>]")
        print("    Verify QRLock credentials by testing authentication")
        print()
        print("  list [--profile <profile>] [--region <region>]")
        print("    List all QRLock credential secrets")
        print()
        print("Examples:")
        print("  python setup_qrlock_credentials.py setup prod --profile harmonestadmin")
        print("  python setup_qrlock_credentials.py verify prod --profile harmonestadmin")
        print("  python setup_qrlock_credentials.py list --profile harmonestadmin")
        sys.exit(1)
    
    command = sys.argv[1]
    
    # Parse arguments
    profile = None
    region = "eu-central-1"
    env_name = None
    
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == "--profile" and i + 1 < len(sys.argv):
            profile = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == "--region" and i + 1 < len(sys.argv):
            region = sys.argv[i + 1]
            i += 2
        else:
            if env_name is None and command in ["setup", "verify"]:
                env_name = sys.argv[i]
            i += 1
    
    # Execute command
    if command == "setup":
        if not env_name:
            print("❌ Error: Environment name required for setup command")
            sys.exit(1)
        success = setup_qrlock_credentials(env_name, region, profile)
        sys.exit(0 if success else 1)
        
    elif command == "verify":
        if not env_name:
            print("❌ Error: Environment name required for verify command")
            sys.exit(1)
        success = verify_qrlock_credentials(env_name, region, profile)
        sys.exit(0 if success else 1)
        
    elif command == "list":
        list_qrlock_secrets(region, profile)
        
    else:
        print(f"❌ Error: Unknown command '{command}'")
        print("Available commands: setup, verify, list")
        sys.exit(1)


if __name__ == "__main__":
    main()
