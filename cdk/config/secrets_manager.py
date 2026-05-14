"""
Secrets Management System
Handles creation, retrieval, and management of secrets across environments
"""
import json
import boto3
from typing import Dict, Any, Optional, List
from botocore.exceptions import ClientError
from config_manager import ConfigManager


class SecretsManager:
    """Manage secrets in AWS Secrets Manager"""
    
    def __init__(self, region: str = "eu-central-1", profile: Optional[str] = None):
        """
        Initialize secrets manager
        
        Args:
            region: AWS region
            profile: AWS profile name (optional)
        """
        session = boto3.Session(profile_name=profile) if profile else boto3.Session()
        self.secrets_client = session.client('secretsmanager', region_name=region)
        self.ssm_client = session.client('ssm', region_name=region)
        self.region = region
    
    def get_secret_name(self, client_name: str, env_name: str, service: str, 
                       credential_type: str) -> str:
        """
        Generate standardized secret name
        
        Args:
            client_name: Name of the client
            env_name: Environment name
            service: Service name (e.g., 'guestyforhosts', 'ttlock')
            credential_type: Type of credential (e.g., 'creds', 'api-credentials')
            
        Returns:
            Standardized secret name
        """
        return f"{client_name}/{env_name}/{service}/{credential_type}"
    
    def create_secret(self, secret_name: str, secret_value: Dict[str, Any], 
                     description: str = "", kms_key_id: Optional[str] = None) -> str:
        """
        Create a new secret
        
        Args:
            secret_name: Name of the secret
            secret_value: Secret value as dictionary
            description: Description of the secret
            kms_key_id: KMS key ID for encryption (optional)
            
        Returns:
            Secret ARN
        """
        try:
            create_params = {
                'Name': secret_name,
                'SecretString': json.dumps(secret_value),
                'Description': description
            }
            
            if kms_key_id:
                create_params['KmsKeyId'] = kms_key_id
            
            response = self.secrets_client.create_secret(**create_params)
            return response['ARN']
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceExistsException':
                # Secret already exists, update it instead
                return self.update_secret(secret_name, secret_value)
            else:
                raise e
    
    def update_secret(self, secret_name: str, secret_value: Dict[str, Any]) -> str:
        """
        Update an existing secret
        
        Args:
            secret_name: Name of the secret
            secret_value: New secret value as dictionary
            
        Returns:
            Secret ARN
        """
        response = self.secrets_client.update_secret(
            SecretId=secret_name,
            SecretString=json.dumps(secret_value)
        )
        return response['ARN']
    
    def get_secret(self, secret_name: str) -> Dict[str, Any]:
        """
        Retrieve a secret value
        
        Args:
            secret_name: Name of the secret
            
        Returns:
            Secret value as dictionary
        """
        try:
            response = self.secrets_client.get_secret_value(SecretId=secret_name)
            return json.loads(response['SecretString'])
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                raise ValueError(f"Secret '{secret_name}' not found")
            else:
                raise e
    
    def delete_secret(self, secret_name: str, force_delete: bool = False) -> bool:
        """
        Delete a secret
        
        Args:
            secret_name: Name of the secret
            force_delete: If True, delete immediately without recovery window
            
        Returns:
            True if successful
        """
        try:
            delete_params = {'SecretId': secret_name}
            if force_delete:
                delete_params['ForceDeleteWithoutRecovery'] = True
            
            self.secrets_client.delete_secret(**delete_params)
            return True
        except ClientError:
            return False
    
    def list_secrets(self, client_name: str, env_name: str) -> List[Dict[str, Any]]:
        """
        List all secrets for a client and environment
        
        Args:
            client_name: Name of the client
            env_name: Environment name
            
        Returns:
            List of secret metadata
        """
        prefix = f"{client_name}/{env_name}/"
        
        try:
            response = self.secrets_client.list_secrets()
            secrets = []
            
            for secret in response.get('SecretList', []):
                if secret['Name'].startswith(prefix):
                    secrets.append({
                        'name': secret['Name'],
                        'arn': secret['ARN'],
                        'description': secret.get('Description', ''),
                        'lastChanged': secret.get('LastChangedDate'),
                        'lastAccessed': secret.get('LastAccessedDate')
                    })
            
            return secrets
        except ClientError:
            return []
    
    def setup_client_secrets(self, client_name: str, env_name: str, 
                           kms_key_id: Optional[str] = None) -> Dict[str, str]:
        """
        Setup all required secrets for a client environment
        
        Args:
            client_name: Name of the client
            env_name: Environment name
            kms_key_id: KMS key ID for encryption (optional)
            
        Returns:
            Dictionary of secret ARNs
        """
        secret_arns = {}
        
        # Define all required secrets with default values
        secrets_to_create = [
            {
                'service': 'guestyforhosts',
                'type': 'creds',
                'description': 'Guesty for Hosts login credentials',
                'default_value': {'email': '', 'password': ''}
            },
            {
                'service': 'guestyforhosts',
                'type': 'webSession',
                'description': 'Guesty web session cache',
                'default_value': {}
            },
            {
                'service': 'ttlock',
                'type': 'credentials',
                'description': 'TTLock API credentials',
                'default_value': {
                    'username': '',
                    'password': '',
                    'app_id': '',
                    'app_secret': '',
                    'country_id': '67',
                    'site_id': '2'
                }
            },
            {
                'service': 'ttlock',
                'type': 'token',
                'description': 'TTLock access token storage',
                'default_value': {}
            },
            {
                'service': 'qrlock',
                'type': 'credentials',
                'description': 'QRLock API credentials',
                'default_value': {'email': '', 'password': ''}
            },
            {
                'service': 'qrlock',
                'type': 'token',
                'description': 'QRLock access token storage',
                'default_value': {}
            },
            {
                'service': 'database',
                'type': 'encryption-key',
                'description': 'Database encryption key',
                'default_value': {'key': ''}
            },
            {
                'service': 'email',
                'type': 'smtp-credentials',
                'description': 'SMTP email credentials',
                'default_value': {'host': '', 'port': 587, 'username': '', 'password': ''}
            },
            {
                'service': 'email',
                'type': 'api-keys',
                'description': 'Email service API keys',
                'default_value': {'sendgrid': '', 'ses': ''}
            },
            {
                'service': 'payment',
                'type': 'stripe',
                'description': 'Stripe payment credentials',
                'default_value': {'publishableKey': '', 'secretKey': '', 'webhookSecret': ''}
            },
            {
                'service': 'external-apis',
                'type': 'google-maps',
                'description': 'Google Maps API credentials',
                'default_value': {'apiKey': '', 'publicApiKey': ''}
            },
            {
                'service': 'external-apis',
                'type': 'analytics',
                'description': 'Analytics service credentials',
                'default_value': {'googleAnalytics': '', 'mixpanel': ''}
            }
        ]
        
        # Create each secret
        for secret_config in secrets_to_create:
            secret_name = self.get_secret_name(
                client_name, env_name, 
                secret_config['service'], secret_config['type']
            )
            
            try:
                arn = self.create_secret(
                    secret_name,
                    secret_config['default_value'],
                    secret_config['description'],
                    kms_key_id
                )
                secret_arns[f"{secret_config['service']}_{secret_config['type']}"] = arn
                
                # Store ARN in SSM for cross-stack reference
                ssm_param_name = f"/{client_name}/{env_name}/secrets/{secret_config['service']}/{secret_config['type']}/arn"
                self.ssm_client.put_parameter(
                    Name=ssm_param_name,
                    Value=arn,
                    Type='String',
                    Overwrite=True
                )
                
            except Exception as e:
                print(f"Warning: Failed to create secret {secret_name}: {e}")
        
        return secret_arns
    
    def get_secret_arn_from_ssm(self, client_name: str, env_name: str, 
                               service: str, credential_type: str) -> Optional[str]:
        """
        Get secret ARN from SSM parameter
        
        Args:
            client_name: Name of the client
            env_name: Environment name
            service: Service name
            credential_type: Type of credential
            
        Returns:
            Secret ARN or None if not found
        """
        param_name = f"/{client_name}/{env_name}/secrets/{service}/{credential_type}/arn"
        
        try:
            response = self.ssm_client.get_parameter(Name=param_name)
            return response['Parameter']['Value']
        except ClientError:
            return None


def create_secrets_for_client(client_name: str, env_name: str, 
                            aws_profile: Optional[str] = None,
                            kms_key_id: Optional[str] = None) -> Dict[str, str]:
    """
    Convenience function to create all secrets for a client
    
    Args:
        client_name: Name of the client
        env_name: Environment name
        aws_profile: AWS profile to use
        kms_key_id: KMS key ID for encryption
        
    Returns:
        Dictionary of created secret ARNs
    """
    secrets_manager = SecretsManager(profile=aws_profile)
    return secrets_manager.setup_client_secrets(client_name, env_name, kms_key_id)


if __name__ == "__main__":
    # Example usage
    secrets_manager = SecretsManager(profile="harmonestadmin")
    
    # Setup secrets for harmonest dev environment
    secret_arns = secrets_manager.setup_client_secrets("harmonest", "dev")
    
    print("Created secrets:")
    for key, arn in secret_arns.items():
        print(f"  {key}: {arn}")
