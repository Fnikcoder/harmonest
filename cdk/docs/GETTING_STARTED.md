# 🚀 Getting Started with Multi-Tenant Hotel Management System

This guide will help you get up and running with the multi-tenant hotel management system in just a few minutes.

## 📋 **Prerequisites**

Before you begin, ensure you have the following installed:

- **Python 3.12+** with pip
- **Node.js 18+** with npm
- **AWS CLI** configured with appropriate permissions
- **AWS CDK** v2.x (`npm install -g aws-cdk`)
- **Git** for version control

## 🏁 **Quick Start (5 Minutes)**

### Step 1: Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd hotel-management-system

# Install Python dependencies
pip install -r requirements.txt

# Install CDK dependencies
npm install
```

### Step 2: Explore Demo Clients

```bash
# List available demo clients
python scripts/demo-environment.py --list

# Validate demo environment
python scripts/demo-environment.py --validate
```

You should see 6 demo clients:
- **harmonest**: Original full-featured client
- **alpine-lodge**: Mountain resort
- **boutique-suites**: Luxury boutique hotel
- **budget-stay**: Budget hotel chain
- **paradise-resort**: Full-service resort
- **executive-inn**: Business hotel

### Step 3: Deploy Your First Client

```bash
# Deploy Alpine Lodge to development environment
python deploy.py deploy alpine-lodge --env dev

# Check deployment status
aws cloudformation describe-stacks --stack-name AlpineLodgeCore-Dev --profile alpine-lodge-admin
```

### Step 4: Test the Deployment

```bash
# Run tests for Alpine Lodge
python scripts/run-tests.sh --client alpine-lodge

# Test API endpoints (if deployed)
curl -X POST https://dev.alpinelodge.com/api/checkin \
  -H "Content-Type: application/json" \
  -d '{"operation":"validate","reservationCode":"TEST123","guestFirstName":"John"}'
```

### Step 5: Generate Documentation

```bash
# Generate documentation for Alpine Lodge
python scripts/generate-docs.sh --client alpine-lodge

# View generated documentation
open docs/generated/alpine-lodge/README.md
```

## 🏨 **Creating Your First Client**

### Option 1: Interactive Onboarding (Recommended)

```bash
# Start interactive onboarding wizard
python scripts/onboard-client.py --client your-hotel-name

# Follow the prompts to configure:
# - Basic information (name, display name, description)
# - Domain configuration
# - Email settings
# - AWS configuration
# - Feature settings
# - Environment configuration
```

### Option 2: Manual Configuration

```bash
# Copy a demo client configuration
cp -r config/clients/alpine-lodge config/clients/your-hotel-name

# Edit the configuration file
nano config/clients/your-hotel-name/config.json

# Update the following fields:
# - client.name: "your-hotel-name"
# - client.displayName: "Your Hotel Name"
# - client.domains.primary: "yourhotel.com"
# - client.email.noreply: "noreply@yourhotel.com"
# - client.aws.profile: "your-aws-profile"
```

### Step 3: Validate Your Configuration

```bash
# Validate the new client configuration
python scripts/validate-config.py --client your-hotel-name

# Fix any validation errors and re-validate
```

### Step 4: Deploy Your Client

```bash
# Deploy to development first
python deploy.py deploy your-hotel-name --env dev

# If successful, deploy to production
python deploy.py deploy your-hotel-name --env prod
```

## 🧪 **Testing Your Deployment**

### Basic Health Check

```bash
# Test API health endpoint
curl https://yourhotel.com/api/health

# Expected response:
# {"status": "healthy", "client": "your-hotel-name", "timestamp": "..."}
```

### Check-in Flow Test

```bash
# Test check-in validation
curl -X POST https://yourhotel.com/api/checkin \
  -H "Content-Type: application/json" \
  -H "X-Client-Name: your-hotel-name" \
  -d '{
    "operation": "validate",
    "reservationCode": "TEST123",
    "guestFirstName": "John"
  }'
```

### Run Comprehensive Tests

```bash
# Run all tests for your client
python scripts/run-tests.sh --client your-hotel-name

# Run specific test types
python scripts/run-tests.sh --client your-hotel-name --type integration
python scripts/run-tests.sh --client your-hotel-name --type e2e
```

## 📊 **Setting Up Monitoring**

### Automatic Monitoring Setup

```bash
# Setup monitoring for your client
python scripts/setup-monitoring.py --client your-hotel-name

# This creates:
# - CloudWatch dashboard
# - CloudWatch alarms
# - SNS topics for alerts
# - Email subscriptions
```

### View Your Dashboard

1. Go to AWS CloudWatch Console
2. Navigate to Dashboards
3. Find `your-hotel-name-prod-monitoring`
4. View metrics for your client

### Configure Alerts

The monitoring setup automatically creates SNS topics and subscribes your configured email addresses:

- **Critical Alerts**: `your-hotel-name-prod-critical-alerts`
- **Warning Alerts**: `your-hotel-name-prod-warning-alerts`
- **Info Alerts**: `your-hotel-name-prod-info-alerts`

## 📚 **Generate Documentation**

### Client-Specific Documentation

```bash
# Generate complete documentation for your client
python scripts/generate-docs.sh --client your-hotel-name

# Generated files:
# - docs/generated/your-hotel-name/overview.md
# - docs/generated/your-hotel-name/api.md
# - docs/generated/your-hotel-name/deployment.md
# - docs/generated/your-hotel-name/configuration.md
# - docs/generated/your-hotel-name/troubleshooting.md
```

### Serve Documentation Locally

```bash
# Generate and serve documentation
python scripts/generate-docs.sh --client your-hotel-name --serve

# Open browser to http://localhost:8080
```

## 🔧 **Common Configuration Options**

### Feature Flags

Enable or disable features for your client:

```json
{
  "features": {
    "checkin": {
      "enabled": true,
      "deadlineHours": 24,
      "qrCodeEnabled": true
    },
    "reservations": {
      "enabled": true,
      "syncEnabled": true,
      "syncIntervalMinutes": 30
    },
    "listings": {
      "enabled": true,
      "syncEnabled": true,
      "publicListings": false
    }
  }
}
```

### Environment-Specific Scaling

Configure different resource sizes for different environments:

```json
{
  "environments": {
    "prod": {
      "enabled": true,
      "scaling": {
        "lambda": {
          "memorySize": 1024,
          "timeout": 90
        }
      }
    },
    "dev": {
      "enabled": true,
      "scaling": {
        "lambda": {
          "memorySize": 256,
          "timeout": 30
        }
      }
    }
  }
}
```

### Branding Customization

Customize the look and feel for your client:

```json
{
  "branding": {
    "primaryColor": "#2563eb",
    "secondaryColor": "#64748b",
    "accentColor": "#10b981",
    "logo": "your-logo.png",
    "theme": "modern"
  }
}
```

## 🚨 **Troubleshooting**

### Common Issues

#### 1. Configuration Validation Errors

```bash
# Run validation to see specific errors
python scripts/validate-config.py --client your-hotel-name

# Common fixes:
# - Check domain format (must be valid domain)
# - Check email format (must be valid email)
# - Check AWS profile exists
# - Check required fields are present
```

#### 2. Deployment Failures

```bash
# Check CloudFormation events
aws cloudformation describe-stack-events \
  --stack-name YourHotelCore-Prod \
  --profile your-aws-profile

# Common fixes:
# - Verify AWS credentials
# - Check IAM permissions
# - Verify region settings
# - Check for resource name conflicts
```

#### 3. Lambda Function Errors

```bash
# Check Lambda logs
aws logs tail /aws/lambda/your-hotel-name-prod-lambda_checkin \
  --follow --profile your-aws-profile

# Common fixes:
# - Check environment variables
# - Verify DynamoDB table exists
# - Check IAM permissions for Lambda
```

#### 4. API Gateway Issues

```bash
# Test API Gateway directly
aws apigateway test-invoke-method \
  --rest-api-id your-api-id \
  --resource-id your-resource-id \
  --http-method POST \
  --profile your-aws-profile

# Common fixes:
# - Check API Gateway deployment
# - Verify Lambda integration
# - Check CORS settings
```

### Getting Help

1. **Check Documentation**: Review generated client-specific documentation
2. **Run Validation**: Use validation scripts to identify issues
3. **Check Logs**: Review CloudWatch logs for runtime errors
4. **Review Configuration**: Ensure configuration follows schema

### Support Resources

- **Configuration Schema**: `config/schema.json`
- **Demo Clients**: Use as reference for configuration
- **Validation Scripts**: Comprehensive error checking
- **Generated Documentation**: Client-specific troubleshooting guides

## 🎯 **Next Steps**

### For Development

1. **Customize Features**: Enable/disable features based on your needs
2. **Add Integrations**: Configure PMS and other third-party integrations
3. **Customize Branding**: Update colors, logos, and themes
4. **Setup Environments**: Configure dev, staging, and prod environments

### For Production

1. **Security Review**: Review AWS IAM permissions and security settings
2. **Performance Testing**: Run load tests to verify performance
3. **Monitoring Setup**: Configure comprehensive monitoring and alerting
4. **Backup Strategy**: Implement backup and disaster recovery procedures

### For Operations

1. **Documentation**: Generate and maintain client-specific documentation
2. **Monitoring**: Set up dashboards and alerting
3. **Maintenance**: Regular validation and updates
4. **Scaling**: Plan for growth and additional clients

## 🎉 **Congratulations!**

You now have a fully functional multi-tenant hotel management system! Your client is deployed, monitored, and documented. You can now:

- ✅ Accept check-in requests from guests
- ✅ Sync reservations from your PMS
- ✅ Manage listings and availability
- ✅ Monitor system performance
- ✅ Scale to additional clients

**Ready to add more clients?** Simply repeat the process with different client names and configurations!

---

*For more detailed information, see the [Multi-Tenant Guide](../MULTI_TENANT_GUIDE.md) and generated client-specific documentation.*
