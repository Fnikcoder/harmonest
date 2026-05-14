# AWS Services Management Scripts

This directory contains shell scripts to manage AWS services for the Harmonest application.

## Overview

The scripts manage the following AWS resources:
- **Authentication**: AWS Cognito User Pool and Identity Pool for user authentication
- **Data Storage**: DynamoDB single table design for all application data
- **File Storage**: S3 buckets for media and documents
- **Content Delivery**: CloudFront distribution for global content delivery
- **Deployment**: Angular application deployment to S3

## Scripts

### 1. Authentication Services

#### `setup_complete_cognito.sh` ⭐ **RECOMMENDED**
Complete Cognito setup from scratch with all best practices.

**Resources Created:**
- Cognito User Pool with proper configuration
- User Pool Client **without secret** (web app compatible)
- Identity Pool with proper provider configuration
- Custom attributes for user roles

**Usage:**
```bash
./setup_complete_cognito.sh
```

#### `create_cognito_authentication.sh`
Creates AWS Cognito User Pool and Identity Pool for authentication.

**Resources Created:**
- Cognito User Pool with custom attributes and MFA support
- User Pool Client **without secret** (fixed for web apps)
- Identity Pool for AWS resource access
- IAM roles for authenticated/unauthenticated users
- Social login provider configuration

**Usage:**
```bash
./create_cognito_authentication.sh
```

#### `fix_cognito_client_secret.sh`
Fixes existing Cognito clients that have secrets (causes SECRET_HASH errors).

**What it does:**
- Detects clients with secrets
- Creates new client without secret
- Updates Identity Pool configuration
- Updates configuration files

**Usage:**
```bash
./fix_cognito_client_secret.sh
```

#### `fix_cognito_identity_pool_roles.sh`
Creates and attaches IAM roles to Identity Pool.

**Resources Created:**
- IAM roles for authenticated users
- IAM roles for unauthenticated users
- Proper permissions for DynamoDB and S3 access
- Role attachment to Identity Pool

**Usage:**
```bash
./fix_cognito_identity_pool_roles.sh
```

#### `fix_cognito_custom_attributes.sh`
Recreates User Pool with custom attributes (if needed).

**Features:**
- Deletes existing User Pool
- Creates new User Pool with custom attributes
- Creates client without secret
- Sets up Identity Pool and IAM roles

**Usage:**
```bash
./fix_cognito_custom_attributes.sh
```

#### `create_cognito_super_admin.sh`
Creates a super admin user in the Cognito User Pool.

**Features:**
- Creates super admin user with highest privileges
- Sets up MFA requirements
- Generates temporary or permanent password
- Configures custom role attribute

**Usage:**
```bash
./create_cognito_super_admin.sh
```

### 2. Data Storage Services

#### `create_dynamodb_s3_services.sh`
Creates all AWS resources needed for data storage.

**Resources Created:**
- DynamoDB table with GSI indexes for efficient querying
- S3 buckets for user media, property media, and documents
- Proper bucket configurations (versioning, CORS, lifecycle policies)

**Usage:**
```bash
./create_dynamodb_s3_services.sh
```

#### `delete_dynamodb_s3_services.sh`
Permanently deletes all AWS data storage resources and their data.

**⚠️ WARNING:** This action cannot be undone!

**Features:**
- Multiple confirmation prompts
- Special production environment protection
- Complete cleanup of all bucket contents and versions

**Usage:**
```bash
./delete_dynamodb_s3_services.sh
```

#### `recreate_dynamodb_s3_services.sh`
Combines delete and create operations for a fresh start.

**Usage:**
```bash
./recreate_dynamodb_s3_services.sh
```

### 3. Content Delivery & Deployment

#### `create_cloudfront_distribution.sh`
Creates CloudFront distribution for global content delivery.

**Resources Created:**
- CloudFront distribution with S3 origin
- Custom domain configuration (optional)
- SSL certificate integration
- Caching policies for optimal performance

**Usage:**
```bash
./create_cloudfront_distribution.sh
```

#### `deploy_angular_to_s3.sh`
Builds and deploys Angular application to S3.

**Features:**
- Builds Angular app for production
- Uploads to S3 bucket
- Invalidates CloudFront cache
- Supports dev/prod environments

**Usage:**
```bash
./deploy_angular_to_s3.sh
```

### 4. Utilities

#### `test_aws_credentials.sh`
Tests AWS credentials and profile configuration.

**Features:**
- Validates AWS profile setup
- Tests permissions for required services
- Displays account information

**Usage:**
```bash
./test_aws_credentials.sh
```

## Configuration

All scripts read configuration from `aws_config.json`:

```json
{
  "prod": {
    "bucket": "harmonest.de",
    "domain": "harmonest.de"
  },
  "dev": {
    "bucket": "dev.harmonest.de",
    "domain": "dev.harmonest.de",
    "cloudfront_distribution_id": "E3GUI85JMV4H9S"
  },
  "region": "eu-central-1",
  "aws_profile": "harmonestadmin"
}
```

## Resource Naming Convention

### Development Environment (`dev`)
- DynamoDB Table: `harmonest-dev-main`
- S3 Buckets:
  - `harmonest-dev-user-media`
  - `harmonest-dev-property-media`
  - `harmonest-dev-documents`

### Production Environment (`prod`)
- DynamoDB Table: `harmonest-main`
- S3 Buckets:
  - `harmonest-user-media`
  - `harmonest-property-media`
  - `harmonest-documents`

## DynamoDB Table Structure

The main table uses a single-table design with the following structure:

### Primary Key
- **PK** (Partition Key): Entity type and ID (e.g., `USER#user-123`, `BOOKING#booking-456`)
- **SK** (Sort Key): Metadata or relationship identifier

### Global Secondary Indexes (GSI)
- **GSI1**: User-based queries (`GSI1PK`, `GSI1SK`)
- **GSI2**: Location/property-based queries (`GSI2PK`, `GSI2SK`)
- **GSI3**: Status-based queries (`GSI3PK`, `GSI3SK`)
- **GSI4**: Date-based queries (`GSI4PK`, `GSI4SK`)

### Supported Entities
- **Users**: Profile, preferences, sessions
- **Properties**: Groups, unit models, individual units
- **Bookings**: Reservations, check-ins, modifications
- **Payments**: Transactions, methods, intents
- **QR Codes**: Access codes for smart locks

## S3 Bucket Configuration

### User Media Bucket
- **Purpose**: User avatars, profile documents
- **Features**: CORS enabled, versioning, lifecycle policies

### Property Media Bucket
- **Purpose**: Property images, videos, virtual tours
- **Features**: CORS enabled, versioning, lifecycle policies

### Documents Bucket
- **Purpose**: Booking confirmations, receipts, legal documents
- **Features**: Versioning, lifecycle policies, secure access

### Lifecycle Policies
- **30 days**: Move to Standard-IA
- **90 days**: Move to Glacier
- **7 days**: Abort incomplete multipart uploads

## Security Features

### Production Protection
- Additional confirmation required for production operations
- Special confirmation text required for destructive operations

### Access Control
- Uses configured AWS profile (`harmonestadmin`)
- Bucket policies and IAM roles should be configured separately

## Prerequisites

1. **AWS CLI** installed and configured
2. **AWS Profile** `harmonestadmin` configured with appropriate permissions
3. **Permissions** required:
   - DynamoDB: CreateTable, DeleteTable, DescribeTable
   - S3: CreateBucket, DeleteBucket, PutBucketPolicy, PutBucketVersioning, etc.

## Usage Examples

### Create development environment
```bash
./create_aws_services.sh
# Choose: dev
```

### Delete production environment (with extra confirmation)
```bash
./delete_aws_services.sh
# Choose: prod
# Type: DELETE PRODUCTION DATA
```

### Fresh start for development
```bash
./recreate_aws_services.sh
# Choose: dev
```

## Troubleshooting

### Common Issues

1. **AWS Profile Not Found**
   - Ensure `harmonestadmin` profile is configured
   - Run: `aws configure --profile harmonestadmin`

2. **Permission Denied**
   - Check IAM permissions for the profile
   - Ensure profile has necessary DynamoDB and S3 permissions

3. **Region Mismatch**
   - Verify region in `aws_config.json` matches your AWS setup

4. **Bucket Already Exists**
   - S3 bucket names are globally unique
   - Choose different bucket names in config if needed

### Verification Commands

```bash
# List DynamoDB tables
aws dynamodb list-tables --profile harmonestadmin

# List S3 buckets
aws s3 ls --profile harmonestadmin

# Describe table
aws dynamodb describe-table --table-name harmonest-dev-main --profile harmonestadmin
```

## Next Steps

After running the scripts:

1. **Update Application Configuration**
   - Update your app to use the new resource names
   - Configure connection strings and credentials

2. **Set Up IAM Policies**
   - Create application-specific IAM roles
   - Grant minimal required permissions

3. **Configure Monitoring**
   - Set up CloudWatch alarms
   - Configure billing alerts

4. **Test Integration**
   - Verify your application can connect to the resources
   - Test CRUD operations

## Troubleshooting

### Common Cognito Issues

#### "Client is configured with secret but SECRET_HASH was not received"
**Solution:** Run `./fix_cognito_client_secret.sh` to create a new client without secret.

**Why this happens:** Web applications cannot securely store client secrets. Only use client secrets for server-side applications.

#### "Token is not from a supported provider of this identity pool"
**Solution:** Run `./fix_cognito_identity_pool_roles.sh` to create and attach IAM roles.

**Why this happens:** Identity Pool needs IAM roles to provide AWS credentials to authenticated users.

#### "User does not exist" or "Incorrect username or password"
**Solution:**
1. Create a user with `./create_cognito_super_admin.sh`
2. Check user status with AWS CLI: `aws cognito-idp admin-get-user --user-pool-id <pool-id> --username <email>`
3. Set permanent password if user is in FORCE_CHANGE_PASSWORD status

#### Authentication works but can't access DynamoDB/S3
**Solution:** Check IAM role permissions in Identity Pool roles.

### Best Practices

1. **Always use `setup_complete_cognito.sh` for new setups** - it follows all best practices
2. **Never use client secrets for web applications** - they cannot be kept secure in browsers
3. **Test authentication in incognito/private browser window** - avoids cached token issues
4. **Clear browser storage when changing Cognito configuration** - old tokens may cause issues

### Quick Setup Guide

For a fresh Cognito setup:

1. **Complete infrastructure setup:**
   ```bash
   ./create_cognito_infrastructure.sh
   ```
   This script will:
   - Prompt for dev/prod environment
   - Create User Pool with custom attributes
   - Create User Pool Client (web app)
   - Create Identity Pool
   - Create and configure IAM roles
   - Create super admin user
   - Save configuration files

2. **Create role-based IAM policies:**
   ```bash
   ./create_iam_user_roles.sh
   ```
   This script creates:
   - Guest Policy (read-only public access)
   - User Policy (booking and profile management)
   - Support Policy (customer service access)
   - Admin Policy (full system administration)
   - Owner Policy (property owner management)
   - Super Admin Policy (full system control)
   - Cognito User Groups for each role

3. **Manage users:**
   ```bash
   ./manage_cognito_users.sh
   ```
   This script provides:
   - List all users
   - Create new users
   - Update user attributes (name, role, status)
   - Enable/disable users
   - Reset passwords
   - Delete users
   - Get user details

4. **Delete infrastructure (if needed):**
   ```bash
   ./delete_cognito_infrastructure.sh
   ```
   This script will:
   - Prompt for dev/prod environment
   - Delete all Cognito resources
   - Remove IAM roles
   - Clean up configuration files

5. **Delete IAM policies (if needed):**
   ```bash
   ./delete_iam_user_roles.sh
   ```
   This script will:
   - Delete all role-based IAM policies
   - Remove Cognito user groups
   - Clean up policy configuration files

4. **Update Angular environment files** with the new configuration from `cognito_config_dev.json`

5. **Test authentication** in your application

## Support

For issues with these scripts, check:
1. AWS CLI configuration (`aws configure list`)
2. IAM permissions for your AWS profile
3. Region settings in `aws_config.json`
4. Network connectivity to AWS services
5. Browser console for authentication errors
