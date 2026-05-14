# Harmonest Credentials & Configuration Deployment Guide

## 🚀 Complete Deployment Process

### Prerequisites
1. **AWS CLI** configured with `harmonestadmin` profile
2. **CDK** installed and bootstrapped
3. **Python 3.9+** for configuration management
4. **Node.js 18+** for frontend applications

### Step 1: Setup Configuration System

#### 1.1 Install Configuration Dependencies
```bash
cd config
pip install -r requirements.txt
```

#### 1.2 Verify Client Configuration
```bash
# Check harmonest configuration
python -c "
from config_manager import ConfigManager
cm = ConfigManager()
config = cm.load_client_config('harmonest')
print('Configuration loaded successfully')
print(f'Client: {config[\"client\"][\"displayName\"]}')
"
```

### Step 2: Deploy Infrastructure

#### 2.1 Deploy Secrets Stack (First)
```bash
# Deploy secrets for dev environment
cdk deploy HarmonestSecrets-dev --profile harmonestadmin

# Deploy secrets for prod environment  
cdk deploy HarmonestSecrets-prod --profile harmonestadmin
```

#### 2.2 Deploy User Management Stack
```bash
# Deploy user management for dev
cdk deploy HarmonestUserManagement-dev --profile harmonestadmin

# Deploy user management for prod
cdk deploy HarmonestUserManagement-prod --profile harmonestadmin
```

#### 2.3 Deploy Main Application Stacks
```bash
# Deploy all stacks for dev environment
cdk deploy --all --profile harmonestadmin --context environment=dev

# Deploy all stacks for prod environment
cdk deploy --all --profile harmonestadmin --context environment=prod
```

### Step 3: Configure Secrets

#### 3.1 Setup Guesty for Hosts Credentials
```bash
# Get the secret name from CDK output
SECRET_NAME="harmonest/prod/guestyforhosts/creds"

# Update with actual credentials
aws secretsmanager update-secret \
    --profile harmonestadmin \
    --secret-id "$SECRET_NAME" \
    --secret-string '{"email":"your-guesty-email@example.com","password":"your-password"}'
```

#### 3.2 Setup TTLock Credentials
```bash
SECRET_NAME="harmonest/prod/ttlock/credentials"

aws secretsmanager update-secret \
    --profile harmonestadmin \
    --secret-id "$SECRET_NAME" \
    --secret-string '{"username":"your-ttlock-username","password":"your-ttlock-password","app_id":"your-app-id","app_secret":"your-app-secret","country_id":"67","site_id":"2"}'
```

#### 3.3 Setup QRLock Credentials
```bash
SECRET_NAME="harmonest/prod/qrlock/credentials"

aws secretsmanager update-secret \
    --profile harmonestadmin \
    --secret-id "$SECRET_NAME" \
    --secret-string '{"email":"your-qrlock-email@example.com","password":"your-qrlock-password"}'
```

#### 3.4 Setup Email Credentials
```bash
# SMTP credentials
SECRET_NAME="harmonest/prod/email/smtp-credentials"

aws secretsmanager update-secret \
    --profile harmonestadmin \
    --secret-id "$SECRET_NAME" \
    --secret-string '{"host":"smtp.gmail.com","port":587,"username":"your-email@gmail.com","password":"your-app-password"}'

# Email API keys
SECRET_NAME="harmonest/prod/email/api-keys"

aws secretsmanager update-secret \
    --profile harmonestadmin \
    --secret-id "$SECRET_NAME" \
    --secret-string '{"sendgrid":"your-sendgrid-api-key","ses":"your-ses-key"}'
```

#### 3.5 Setup Payment Credentials
```bash
SECRET_NAME="harmonest/prod/payment/stripe"

aws secretsmanager update-secret \
    --profile harmonestadmin \
    --secret-id "$SECRET_NAME" \
    --secret-string '{"publishableKey":"pk_live_...","secretKey":"sk_live_...","webhookSecret":"whsec_..."}'
```

#### 3.6 Setup External API Credentials
```bash
# Google Maps
SECRET_NAME="harmonest/prod/external-apis/google-maps"

aws secretsmanager update-secret \
    --profile harmonestadmin \
    --secret-id "$SECRET_NAME" \
    --secret-string '{"apiKey":"your-server-api-key","publicApiKey":"your-frontend-api-key"}'

# Analytics
SECRET_NAME="harmonest/prod/external-apis/analytics"

aws secretsmanager update-secret \
    --profile harmonestadmin \
    --secret-id "$SECRET_NAME" \
    --secret-string '{"googleAnalytics":"GA-XXXXXXXXX","mixpanel":"your-mixpanel-token"}'
```

### Step 4: Create Initial Users

#### 4.1 Create Owner User
```bash
# Get User Pool ID from CDK output
USER_POOL_ID=$(aws ssm get-parameter \
    --profile harmonestadmin \
    --name "/harmonest/prod/cognito/user-pool-id" \
    --query 'Parameter.Value' --output text)

# Create owner user
aws cognito-idp admin-create-user \
    --profile harmonestadmin \
    --user-pool-id "$USER_POOL_ID" \
    --username "owner@harmonest.de" \
    --user-attributes Name=email,Value="owner@harmonest.de" Name=email_verified,Value=true \
    --temporary-password "TempPass123!" \
    --message-action SUPPRESS

# Add to owner group
aws cognito-idp admin-add-user-to-group \
    --profile harmonestadmin \
    --user-pool-id "$USER_POOL_ID" \
    --username "owner@harmonest.de" \
    --group-name "owner"
```

#### 4.2 Create Super Admin User
```bash
aws cognito-idp admin-create-user \
    --profile harmonestadmin \
    --user-pool-id "$USER_POOL_ID" \
    --username "admin@harmonest.de" \
    --user-attributes Name=email,Value="admin@harmonest.de" Name=email_verified,Value=true \
    --temporary-password "TempPass123!" \
    --message-action SUPPRESS

aws cognito-idp admin-add-user-to-group \
    --profile harmonestadmin \
    --user-pool-id "$USER_POOL_ID" \
    --username "admin@harmonest.de" \
    --group-name "super_admin"
```

### Step 5: Generate Frontend Configuration

#### 5.1 Generate Frontend Config
```bash
cd config

# Generate frontend config for prod
python -c "
from frontend_config_generator import FrontendConfigGenerator
from config_manager import ConfigManager
import json

# Get AWS resource IDs (replace with actual values from CDK output)
aws_resources = {
    'user_pool_id': 'eu-central-1_XXXXXXXXX',
    'user_pool_client_id': 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
    'cognito_domain': 'harmonest-auth.auth.eu-central-1.amazoncognito.com'
}

cm = ConfigManager()
generator = FrontendConfigGenerator(cm)
config_path = generator.save_frontend_config('harmonest', 'prod', aws_resources)
print(f'Frontend config saved to: {config_path}')
"
```

#### 5.2 Deploy Frontend Config to S3
```bash
# Upload frontend config to S3 for public access
aws s3 cp config/clients/harmonest/frontend-config-prod.json \
    s3://harmonest-frontend-config-prod/config.json \
    --profile harmonestadmin \
    --content-type "application/json"
```

### Step 6: Test Deployment

#### 6.1 Test API Endpoints
```bash
# Get API Gateway URL from CDK output
API_URL=$(aws ssm get-parameter \
    --profile harmonestadmin \
    --name "/harmonest/prod/api/base-url" \
    --query 'Parameter.Value' --output text)

# Test public endpoint
curl "$API_URL/listings"

# Test health check
curl "$API_URL/health"
```

#### 6.2 Test Authentication
```bash
# Test Cognito user pool
aws cognito-idp list-users \
    --profile harmonestadmin \
    --user-pool-id "$USER_POOL_ID" \
    --limit 10
```

### Step 7: Domain Configuration

#### 7.1 Setup Custom Domains (Optional)
```bash
# Create SSL certificate for custom domains
aws acm request-certificate \
    --profile harmonestadmin \
    --domain-name "api.harmonest.de" \
    --subject-alternative-names "admin.harmonest.de" \
    --validation-method DNS \
    --region eu-central-1
```

### Step 8: Monitoring Setup

#### 8.1 Setup CloudWatch Alarms
```bash
# Create alarm for Lambda errors
aws cloudwatch put-metric-alarm \
    --profile harmonestadmin \
    --alarm-name "harmonest-lambda-errors" \
    --alarm-description "Lambda function errors" \
    --metric-name Errors \
    --namespace AWS/Lambda \
    --statistic Sum \
    --period 300 \
    --threshold 5 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 2
```

## 🔧 Environment-Specific Configuration

### Development Environment
- Use `dev` environment name
- Separate AWS resources with `-dev` suffix
- Use development domains (dev.harmonest.de)
- Relaxed CORS policies for localhost

### Production Environment  
- Use `prod` environment name
- Production domains (harmonest.de)
- Strict security policies
- Enhanced monitoring and logging

## 🔐 Security Checklist

- [ ] All secrets stored in AWS Secrets Manager
- [ ] KMS encryption enabled for all secrets
- [ ] IAM roles follow least privilege principle
- [ ] API Gateway has proper CORS configuration
- [ ] Cognito has strong password policies
- [ ] CloudWatch logging enabled for all Lambda functions
- [ ] SSL certificates configured for custom domains

## 🚨 Troubleshooting

### Common Issues

1. **CDK Bootstrap Error**
   ```bash
   cdk bootstrap aws://669597026882/eu-central-1 --profile harmonestadmin
   ```

2. **Secret Not Found Error**
   - Verify secret exists in AWS Secrets Manager
   - Check secret name format: `{client}/{env}/{service}/{type}`

3. **Permission Denied**
   - Verify AWS profile has necessary permissions
   - Check IAM roles and policies

4. **CORS Errors**
   - Update allowed origins in API Gateway configuration
   - Verify frontend domain is included in CORS settings

### Useful Commands

```bash
# List all secrets for harmonest
aws secretsmanager list-secrets \
    --profile harmonestadmin \
    --query 'SecretList[?contains(Name, `harmonest`)].Name'

# Check CDK diff before deployment
cdk diff --profile harmonestadmin

# View CloudWatch logs
aws logs describe-log-groups \
    --profile harmonestadmin \
    --log-group-name-prefix "/aws/lambda/harmonest"
```
