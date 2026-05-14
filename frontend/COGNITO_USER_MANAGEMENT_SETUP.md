# Cognito User Management Setup

This document explains how to set up and use the Cognito User Management feature in the Harmonest application.

## Overview

The user management system now pulls real users from AWS Cognito User Pool instead of using mock data. This provides:

- Real-time user data from Cognito
- User creation, editing, and deletion
- Role management
- User status management (enable/disable)
- Proper authentication and authorization

## Prerequisites

1. **AWS CLI installed and configured**
   ```bash
   # Install AWS CLI
   # Windows: Download from https://aws.amazon.com/cli/
   # macOS: brew install awscli
   # Linux: sudo apt-get install awscli

   # Configure AWS CLI with your credentials
   aws configure --profile harmonestadmin
   ```

2. **AWS Credentials with proper permissions**
   Your AWS user/role needs the following Cognito permissions:
   - `cognito-idp:ListUsers`
   - `cognito-idp:AdminGetUser`
   - `cognito-idp:AdminCreateUser`
   - `cognito-idp:AdminUpdateUserAttributes`
   - `cognito-idp:AdminDeleteUser`
   - `cognito-idp:AdminEnableUser`
   - `cognito-idp:AdminDisableUser`
   - `cognito-idp:AdminSetUserPassword`

## Setup Instructions

### 1. Environment Variables

Set the following environment variables on your system:

**Windows (PowerShell):**
```powershell
$env:AWS_PROFILE="harmonestadmin"
$env:AWS_REGION="eu-central-1"
```

**Windows (Command Prompt):**
```cmd
set AWS_PROFILE=harmonestadmin
set AWS_REGION=eu-central-1
```

**macOS/Linux:**
```bash
export AWS_PROFILE=harmonestadmin
export AWS_REGION=eu-central-1
```

### 2. IAM Policy

Create an IAM policy with the following permissions and attach it to your user/role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cognito-idp:ListUsers",
        "cognito-idp:AdminGetUser",
        "cognito-idp:AdminCreateUser",
        "cognito-idp:AdminUpdateUserAttributes",
        "cognito-idp:AdminDeleteUser",
        "cognito-idp:AdminEnableUser",
        "cognito-idp:AdminDisableUser",
        "cognito-idp:AdminSetUserPassword"
      ],
      "Resource": "arn:aws:cognito-idp:eu-central-1:*:userpool/eu-central-1_3nRWgJleG"
    }
  ]
}
```

### 3. Test AWS Credentials

Test your AWS credentials by running:

```bash
aws cognito-idp list-users --user-pool-id eu-central-1_3nRWgJleG --profile harmonestadmin
```

If this command returns user data, your credentials are properly configured.

## Features

### User Management Dashboard

Navigate to `/management/users` to access the user management dashboard.

**Features include:**
- **View Users**: See all users from Cognito User Pool
- **Search & Filter**: Filter by role, status, or search by name/email
- **Create Users**: Add new users to Cognito
- **Edit Users**: Update user roles (other attributes require user self-service)
- **Enable/Disable**: Enable or disable user accounts
- **Delete Users**: Remove users from Cognito (permanent action)

### User Roles

The system supports the following roles:
- **Super Admin**: Full system access
- **Owner**: Property owner with full access
- **Admin**: Administrative access
- **Support**: Support team access
- **User**: Regular user access

### User Statuses

Cognito user statuses include:
- **CONFIRMED**: User has confirmed their account
- **UNCONFIRMED**: User hasn't confirmed their account yet
- **FORCE_CHANGE_PASSWORD**: User must change password on next login
- **RESET_REQUIRED**: Password reset required
- **COMPROMISED**: Account has been compromised

## Security Considerations

### Development vs Production

**Development:**
- Uses AWS CLI credentials configured locally
- Credentials are read from environment variables
- Suitable for local development only

**Production:**
- Should use IAM roles or Cognito Identity Pool
- Never hardcode credentials in frontend code
- Use AWS STS for temporary credentials
- Implement proper CORS and security headers

### Best Practices

1. **Never commit AWS credentials** to version control
2. **Use IAM roles** in production environments
3. **Implement proper error handling** for AWS API calls
4. **Log security events** for audit purposes
5. **Use least privilege principle** for IAM permissions

## Troubleshooting

### Common Issues

1. **"Access Denied" errors**
   - Check IAM permissions
   - Verify AWS credentials are configured
   - Ensure correct AWS profile is being used

2. **"User Pool not found" errors**
   - Verify the User Pool ID in environment configuration
   - Check AWS region settings

3. **CORS errors**
   - Ensure proper CORS configuration in AWS
   - Check browser console for detailed error messages

4. **Network timeouts**
   - Check internet connectivity
   - Verify AWS service availability

### Debug Steps

1. Check browser console for error messages
2. Verify AWS credentials: `aws sts get-caller-identity --profile harmonestadmin`
3. Test Cognito access: `aws cognito-idp list-users --user-pool-id eu-central-1_3nRWgJleG --profile harmonestadmin`
4. Check network tab in browser dev tools for failed requests

## Support

For additional support:
1. Check AWS Cognito documentation
2. Review AWS CLI configuration
3. Verify IAM permissions
4. Contact your AWS administrator if using organizational accounts
