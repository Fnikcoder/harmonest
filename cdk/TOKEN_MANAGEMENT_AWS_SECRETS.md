# Token Management with AWS Secrets Manager

## Overview

Both QRLock and TTLock tokens are now stored in **AWS Secrets Manager** just like the Guesty (G4H) credentials. This provides centralized, secure token management with automatic persistence and reuse across Lambda invocations.

## Architecture

```
Lambda Function → Load Credentials → Authenticate → Save Token → AWS Secrets Manager
                     ↓                                              ↑
              Load Existing Token ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
```

## Secrets Structure

### QRLock Secrets

**Credentials**: `harmonest/{env}/qrlock/credentials`
```json
{
  "email": "qrlock_user@example.com",
  "password": "qrlock_password"
}
```

**Token**: `harmonest/{env}/qrlock/token`
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": 1692209856.789,
  "created_at": 1692123456.789
}
```

### TTLock Secrets

**Credentials**: `harmonest/{env}/ttlock/credentials`
```json
{
  "username": "ttlock_username",
  "password": "ttlock_password",
  "app_id": "ttlock_app_id",
  "app_secret": "ttlock_app_secret",
  "country_id": "67",
  "site_id": "2"
}
```

**Token**: `harmonest/{env}/ttlock/token`
```json
{
  "access_token": "ttlock_access_token_string",
  "expires_at": 1692216656.789,
  "created_at": 1692123456.789
}
```

## Implementation Details

### Client Initialization

**QRLock Client**:
```python
def __init__(self):
    # AWS Secrets Manager configuration
    env_name = os.environ.get('ENVIRONMENT', 'prod')
    self.credentials_secret = f"harmonest/{env_name}/qrlock/credentials"
    self.token_secret = f"harmonest/{env_name}/qrlock/token"
    
    # Load credentials and token from Secrets Manager
    self._load_credentials()
    self._load_token()
```

**TTLock Client**:
```python
def __init__(self):
    # AWS Secrets Manager configuration
    env_name = os.environ.get('ENVIRONMENT', 'prod')
    self.credentials_secret = f"harmonest/{env_name}/ttlock/credentials"
    self.token_secret = f"harmonest/{env_name}/ttlock/token"
    
    # Load credentials and token from Secrets Manager
    self._load_credentials()
    self._load_token()
```

### Token Loading

**Load Existing Token**:
```python
def _load_token(self) -> None:
    """Load existing access token from AWS Secrets Manager"""
    try:
        sm = boto3.client("secretsmanager")
        response = sm.get_secret_value(SecretId=self.token_secret)
        token_data = json.loads(response["SecretString"])
        
        # Check if token is still valid
        token_expiry = token_data.get("expires_at", 0)
        current_time = time.time()
        
        if current_time < token_expiry:
            self.access_token = token_data.get("access_token")
            print("Loaded valid token from Secrets Manager")
        else:
            print("Token in Secrets Manager has expired")
            
    except sm.exceptions.ResourceNotFoundException:
        print("No existing token found in Secrets Manager")
    except Exception as e:
        print(f"Error loading token from Secrets Manager: {str(e)}")
```

### Token Saving

**Save New Token**:
```python
def _save_token(self, token: str, expires_in_seconds: int = 3600) -> None:
    """Save access token to AWS Secrets Manager"""
    try:
        sm = boto3.client("secretsmanager")
        
        token_data = {
            "access_token": token,
            "expires_at": time.time() + expires_in_seconds,
            "created_at": time.time()
        }
        
        try:
            # Try to update existing secret
            sm.update_secret(
                SecretId=self.token_secret,
                SecretString=json.dumps(token_data)
            )
        except sm.exceptions.ResourceNotFoundException:
            # Create new secret if it doesn't exist
            sm.create_secret(
                Name=self.token_secret,
                SecretString=json.dumps(token_data),
                Description="API access token"
            )
        
        print("Token saved to Secrets Manager")
        
    except Exception as e:
        print(f"Error saving token to Secrets Manager: {str(e)}")
        # Don't fail authentication if token saving fails
```

### Authentication Flow

**Enhanced Authentication**:
```python
def authenticate(self) -> bool:
    """Authenticate and save token to Secrets Manager"""
    # ... authentication logic ...
    
    if authentication_successful:
        self.access_token = response_token
        # Save token to Secrets Manager for reuse
        self._save_token(self.access_token, expires_in_seconds)
        return True
    
    return False
```

## Benefits

### Security
- **Encrypted Storage**: All tokens encrypted at rest in Secrets Manager
- **Access Control**: IAM policies control who can access tokens
- **Audit Trail**: CloudTrail logs all secret access
- **Rotation Support**: Easy token rotation when needed

### Performance
- **Token Reuse**: Avoid unnecessary authentication calls
- **Faster Startup**: Load existing valid tokens on Lambda cold start
- **Reduced API Calls**: Fewer authentication requests to QRLock/TTLock

### Reliability
- **Persistence**: Tokens survive Lambda container recycling
- **Shared Access**: Multiple Lambda instances can share tokens
- **Graceful Degradation**: Continue working if token save fails
- **Automatic Expiry**: Built-in token expiration handling

### Operational
- **Centralized Management**: All tokens in one place
- **Easy Monitoring**: CloudWatch metrics for secret access
- **Consistent Pattern**: Same approach as Guesty credentials
- **Environment Separation**: Different tokens per environment

## IAM Permissions

### Required Permissions

**QR Code Notification Lambda**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:CreateSecret",
        "secretsmanager:UpdateSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:*:*:secret:harmonest/{env}/qrlock/*",
        "arn:aws:secretsmanager:*:*:secret:harmonest/{env}/ttlock/*"
      ]
    }
  ]
}
```

## Environment Configuration

### Environment Variables
- `ENVIRONMENT`: Environment name (prod, dev, staging)
- Used to construct secret names: `harmonest/{env}/qrlock/credentials`

### Secret Names by Environment
- **Production**: `harmonest/prod/qrlock/credentials`, `harmonest/prod/qrlock/token`
- **Development**: `harmonest/dev/qrlock/credentials`, `harmonest/dev/qrlock/token`
- **Staging**: `harmonest/staging/qrlock/credentials`, `harmonest/staging/qrlock/token`

## Monitoring and Logging

### CloudWatch Logs
```
Loaded valid QRLock token from Secrets Manager
QRLock authentication successful
QRLock token saved to Secrets Manager
TTLock token in Secrets Manager has expired
TTLock authentication successful
TTLock token saved to Secrets Manager
```

### CloudWatch Metrics
- Secret access frequency
- Authentication success/failure rates
- Token expiration events
- Error rates

### Recommended Alarms
- High authentication failure rate
- Frequent token expiration
- Secret access errors
- Missing credentials

## Setup Instructions

### 1. Create Credential Secrets

**QRLock Credentials**:
```bash
aws secretsmanager create-secret \
  --name "harmonest/prod/qrlock/credentials" \
  --description "QRLock API credentials" \
  --secret-string '{"email":"user@example.com","password":"password123"}'
```

**TTLock Credentials**:
```bash
aws secretsmanager create-secret \
  --name "harmonest/prod/ttlock/credentials" \
  --description "TTLock API credentials" \
  --secret-string '{"username":"user","password":"pass","app_id":"123","app_secret":"secret"}'
```

### 2. Deploy Updated Stack
```bash
cdk deploy --profile harmonestadmin --context client=paradise-resort --context env=prod
```

### 3. Verify Token Creation
- Tokens will be automatically created on first authentication
- Check Secrets Manager console for token secrets
- Monitor CloudWatch logs for successful token operations

## Migration from Environment Variables

### Before (Environment Variables)
```python
self.email = os.environ.get("QRLOCK_EMAIL")
self.password = os.environ.get("QRLOCK_PASSWORD")
```

### After (Secrets Manager)
```python
self._load_credentials()  # Loads from Secrets Manager
self._load_token()        # Loads existing token if valid
```

### Migration Steps
1. Create credential secrets in Secrets Manager
2. Deploy updated Lambda functions
3. Remove environment variables from Lambda configuration
4. Verify authentication works with Secrets Manager

This token management system provides the same secure, centralized approach used for Guesty credentials, ensuring consistent security practices across all API integrations.
