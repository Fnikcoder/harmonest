"""
Credentials Management for Lambda Functions
Provides secure access to secrets and configuration
"""
import json
import os
import time
import boto3
from typing import Dict, Any, Optional
from functools import lru_cache
from botocore.exceptions import ClientError


class CredentialsManager:
    """Manage credentials and secrets for Lambda functions"""
    
    def __init__(self):
        self.secrets_client = boto3.client('secretsmanager')
        self.ssm_client = boto3.client('ssm')
        
        # Get client and environment from environment variables
        self.client_name = os.getenv('CLIENT_NAME', 'unknown')
        self.env_name = os.getenv('ENVIRONMENT', 'dev')
    
    @lru_cache(maxsize=32)
    def get_secret(self, service: str, credential_type: str) -> Dict[str, Any]:
        """
        Get secret value from AWS Secrets Manager

        Args:
            service: Service name (e.g., 'guestyforhosts', 'ttlock')
            credential_type: Type of credential (e.g., 'creds', 'api-credentials')

        Returns:
            Secret value as dictionary
        """
        secret_name = f"{self.client_name}/{self.env_name}/{service}/{credential_type}"

        try:
            response = self.secrets_client.get_secret_value(SecretId=secret_name)
            return json.loads(response['SecretString'])
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == 'ResourceNotFoundException':
                raise ValueError(f"Secret '{secret_name}' not found")
            elif error_code == 'InvalidRequestException':
                raise ValueError(f"Invalid request for secret '{secret_name}'")
            elif error_code == 'InvalidParameterException':
                raise ValueError(f"Invalid parameter for secret '{secret_name}'")
            else:
                raise e

    def clear_secret_cache(self, service: str = None, credential_type: str = None):
        """
        Clear cached secrets (useful when tokens expire)

        Args:
            service: Service name to clear (optional, clears all if None)
            credential_type: Credential type to clear (optional)
        """
        if hasattr(self.get_secret, 'cache_clear'):
            self.get_secret.cache_clear()
    
    def update_secret(self, service: str, credential_type: str, 
                     secret_value: Dict[str, Any]) -> bool:
        """
        Update secret value in AWS Secrets Manager
        
        Args:
            service: Service name
            credential_type: Type of credential
            secret_value: New secret value as dictionary
            
        Returns:
            True if successful
        """
        secret_name = f"{self.client_name}/{self.env_name}/{service}/{credential_type}"
        
        try:
            self.secrets_client.update_secret(
                SecretId=secret_name,
                SecretString=json.dumps(secret_value)
            )
            
            # Clear cache for this secret
            cache_key = (service, credential_type)
            if hasattr(self.get_secret, 'cache_info'):
                # Clear specific cache entry if possible
                self.get_secret.cache_clear()
            
            return True
        except ClientError:
            return False
    
    def get_guesty_credentials(self) -> Dict[str, str]:
        """Get Guesty for Hosts credentials"""
        # Use environment variable if available (for compatibility with existing g4h.py)
        secret_arn = os.getenv('G4H_CRED_SECRET')
        if secret_arn:
            try:
                response = self.secrets_client.get_secret_value(SecretId=secret_arn)
                return json.loads(response['SecretString'])
            except ClientError:
                pass
        # Fallback to constructed secret name
        return self.get_secret('guestyforhosts', 'creds')

    def get_guesty_session(self) -> Dict[str, Any]:
        """Get Guesty for Hosts session data"""
        # Use environment variable if available (for compatibility with existing g4h.py)
        secret_arn = os.getenv('G4H_SESSION_SECRET')
        if secret_arn:
            try:
                response = self.secrets_client.get_secret_value(SecretId=secret_arn)
                return json.loads(response['SecretString'])
            except ClientError:
                pass
        # Fallback to constructed secret name
        return self.get_secret('guestyforhosts', 'webSession')

    def update_guesty_session(self, session_data: Dict[str, Any]) -> bool:
        """Update Guesty for Hosts session data"""
        # Use environment variable if available (for compatibility with existing g4h.py)
        secret_arn = os.getenv('G4H_SESSION_SECRET')
        if secret_arn:
            try:
                self.secrets_client.update_secret(
                    SecretId=secret_arn,
                    SecretString=json.dumps(session_data)
                )
                return True
            except ClientError:
                pass
        # Fallback to constructed secret name
        return self.update_secret('guestyforhosts', 'webSession', session_data)
    
    def get_ttlock_credentials(self) -> Dict[str, str]:
        """Get TTLock API credentials"""
        return self.get_secret('ttlock', 'credentials')

    def get_ttlock_token(self) -> Dict[str, Any]:
        """Get TTLock access token with expiration check"""
        try:
            token_data = self.get_secret('ttlock', 'token')

            # Check if token is still valid
            if token_data:
                expires_at = token_data.get('expires_at', 0)
                current_time = time.time()

                if current_time >= expires_at:
                    print("TTLock token has expired")
                    # Clear cache to force fresh fetch next time
                    self.clear_secret_cache()
                    return {}

            return token_data
        except ValueError:
            # Token secret doesn't exist yet
            return {}

    def update_ttlock_token(self, token_data: Dict[str, Any]) -> bool:
        """Update TTLock access token and clear cache"""
        success = self.update_secret('ttlock', 'token', token_data)
        if success:
            # Clear cache to ensure fresh data on next access
            self.clear_secret_cache()
        return success

    def get_qrlock_credentials(self) -> Dict[str, str]:
        """Get QRLock API credentials"""
        return self.get_secret('qrlock', 'credentials')

    def get_qrlock_token(self) -> Dict[str, Any]:
        """Get QRLock access token with expiration check"""
        try:
            token_data = self.get_secret('qrlock', 'token')

            # Check if token is still valid
            if token_data:
                expires_at = token_data.get('expires_at', 0)
                current_time = time.time()

                if current_time >= expires_at:
                    print("QRLock token has expired")
                    # Clear cache to force fresh fetch next time
                    self.clear_secret_cache()
                    return {}

            return token_data
        except ValueError:
            # Token secret doesn't exist yet
            return {}

    def update_qrlock_token(self, token_data: Dict[str, Any]) -> bool:
        """Update QRLock access token and clear cache"""
        success = self.update_secret('qrlock', 'token', token_data)
        if success:
            # Clear cache to ensure fresh data on next access
            self.clear_secret_cache()
        return success
    
    def get_email_smtp_credentials(self) -> Dict[str, Any]:
        """Get SMTP email credentials"""
        return self.get_secret('email', 'smtp-credentials')
    
    def get_email_api_keys(self) -> Dict[str, str]:
        """Get email service API keys"""
        return self.get_secret('email', 'api-keys')
    
    def get_stripe_credentials(self) -> Dict[str, str]:
        """Get Stripe payment credentials"""
        return self.get_secret('payment', 'stripe')
    
    def get_google_maps_credentials(self) -> Dict[str, str]:
        """Get Google Maps API credentials"""
        return self.get_secret('external-apis', 'google-maps')
    
    def get_analytics_credentials(self) -> Dict[str, str]:
        """Get analytics service credentials"""
        return self.get_secret('external-apis', 'analytics')
    
    def get_sms_credentials(self) -> Dict[str, Any]:
        """Get SMS service credentials"""
        return self.get_secret('external-apis', 'sms')
    
    @lru_cache(maxsize=16)
    def get_secret_arn(self, service: str, credential_type: str) -> Optional[str]:
        """
        Get secret ARN from SSM parameter
        
        Args:
            service: Service name
            credential_type: Type of credential
            
        Returns:
            Secret ARN or None if not found
        """
        param_name = f"/{self.client_name}/{self.env_name}/secrets/{service}/{credential_type}/arn"
        
        try:
            response = self.ssm_client.get_parameter(Name=param_name)
            return response['Parameter']['Value']
        except ClientError:
            return None


# Global instance for Lambda functions
credentials_manager = CredentialsManager()


def get_credentials(service: str, credential_type: str) -> Dict[str, Any]:
    """
    Convenience function to get credentials
    
    Args:
        service: Service name
        credential_type: Type of credential
        
    Returns:
        Credential dictionary
    """
    return credentials_manager.get_secret(service, credential_type)


def update_credentials(service: str, credential_type: str, 
                      credentials: Dict[str, Any]) -> bool:
    """
    Convenience function to update credentials
    
    Args:
        service: Service name
        credential_type: Type of credential
        credentials: New credentials
        
    Returns:
        True if successful
    """
    return credentials_manager.update_secret(service, credential_type, credentials)


# Service-specific convenience functions
def get_guesty_creds() -> Dict[str, str]:
    """Get Guesty credentials"""
    return credentials_manager.get_guesty_credentials()


def get_guesty_session() -> Dict[str, Any]:
    """Get Guesty session"""
    return credentials_manager.get_guesty_session()


def update_guesty_session(session_data: Dict[str, Any]) -> bool:
    """Update Guesty session"""
    return credentials_manager.update_guesty_session(session_data)


def get_ttlock_creds() -> Dict[str, str]:
    """Get TTLock credentials"""
    return credentials_manager.get_ttlock_credentials()


def get_ttlock_token() -> Dict[str, Any]:
    """Get TTLock access token"""
    return credentials_manager.get_ttlock_token()


def update_ttlock_token(token_data: Dict[str, Any]) -> bool:
    """Update TTLock access token"""
    return credentials_manager.update_ttlock_token(token_data)


def get_qrlock_creds() -> Dict[str, str]:
    """Get QRLock credentials"""
    return credentials_manager.get_qrlock_credentials()


def get_qrlock_token() -> Dict[str, Any]:
    """Get QRLock access token"""
    return credentials_manager.get_qrlock_token()


def update_qrlock_token(token_data: Dict[str, Any]) -> bool:
    """Update QRLock access token"""
    return credentials_manager.update_qrlock_token(token_data)


def get_stripe_creds() -> Dict[str, str]:
    """Get Stripe credentials"""
    return credentials_manager.get_stripe_credentials()


def get_email_creds() -> Dict[str, Any]:
    """Get email SMTP credentials"""
    return credentials_manager.get_email_smtp_credentials()


# Configuration helpers
def get_client_config() -> Dict[str, Any]:
    """
    Get client configuration from environment variables
    
    Returns:
        Client configuration dictionary
    """
    return {
        'client_name': os.getenv('CLIENT_NAME', 'unknown'),
        'display_name': os.getenv('CLIENT_DISPLAY_NAME', 'Unknown Client'),
        'environment': os.getenv('ENVIRONMENT', 'dev'),
        'region': os.getenv('AWS_REGION', 'eu-central-1'),
        'domain_primary': os.getenv('CLIENT_DOMAIN_PRIMARY', 'example.com'),
        'email_noreply': os.getenv('CLIENT_EMAIL_NOREPLY', 'noreply@example.com'),
        'branding_primary_color': os.getenv('CLIENT_BRANDING_PRIMARY_COLOR', '#2563eb'),
        'user_pool_id': os.getenv('USER_POOL_ID', ''),
        'dynamodb_table': os.getenv('DYNAMODB_TABLE_NAME', ''),
        's3_bucket': os.getenv('S3_BUCKET_NAME', '')
    }


def is_feature_enabled(feature_name: str) -> bool:
    """
    Check if a feature is enabled
    
    Args:
        feature_name: Name of the feature
        
    Returns:
        True if feature is enabled
    """
    env_var = f"FEATURE_{feature_name.upper()}_ENABLED"
    return os.getenv(env_var, 'false').lower() == 'true'


# Error handling
class CredentialsError(Exception):
    """Custom exception for credentials-related errors"""
    pass


def safe_get_credentials(service: str, credential_type: str, 
                        default: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Safely get credentials with fallback
    
    Args:
        service: Service name
        credential_type: Type of credential
        default: Default value if credentials not found
        
    Returns:
        Credentials or default value
    """
    try:
        return get_credentials(service, credential_type)
    except (ValueError, ClientError):
        if default is not None:
            return default
        raise CredentialsError(f"Failed to get credentials for {service}/{credential_type}")
