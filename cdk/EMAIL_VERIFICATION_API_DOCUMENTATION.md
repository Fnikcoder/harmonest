# Email Verification API Documentation

This document describes the email verification API endpoints for the Harmonest check-in system.

## Overview

The email verification system provides secure email verification functionality for the check-in process using:
- **AWS Lambda** for processing verification requests
- **AWS SES** for sending verification emails
- **AWS DynamoDB** for storing verification codes with TTL
- **AWS API Gateway** for REST API endpoints

## API Endpoints

### Base URL
```
https://{api-id}.execute-api.eu-central-1.amazonaws.com/{stage}/email-verification
```

### 1. Send Verification Email

**Endpoint**: `POST /email-verification`

**Request Body**:
```json
{
  "operation": "send-verification-email",
  "email": "user@example.com",
  "type": "checkin"
}
```

**Parameters**:
- `operation` (required): Must be "send-verification-email"
- `email` (required): Valid email address to send verification code to
- `type` (optional): Type of verification, defaults to "checkin"

**Success Response** (200):
```json
{
  "success": true,
  "message": "Verification code sent successfully to user@example.com",
  "data": {
    "email": "user@example.com",
    "type": "checkin",
    "expiresInMinutes": 10
  },
  "errorCode": null,
  "timestamp": 1703123456789
}
```

**Error Responses**:
- **400 Bad Request**: Missing required fields or invalid email format
- **500 Internal Server Error**: Email sending failed or server error

### 2. Verify Email Code

**Endpoint**: `POST /email-verification`

**Request Body**:
```json
{
  "operation": "verify-email-code",
  "email": "user@example.com",
  "verificationCode": "123456",
  "type": "checkin"
}
```

**Parameters**:
- `operation` (required): Must be "verify-email-code"
- `email` (required): Email address that received the verification code
- `verificationCode` (required): 6-digit verification code from email
- `type` (optional): Type of verification, defaults to "checkin"

**Success Response** (200):
```json
{
  "success": true,
  "message": "Email verified successfully",
  "data": {
    "email": "user@example.com",
    "type": "checkin",
    "verifiedAt": 1703123456789
  },
  "errorCode": null,
  "timestamp": 1703123456789
}
```

**Error Responses**:
- **400 Bad Request**: Invalid verification code, expired code, or missing fields
- **500 Internal Server Error**: Server error

## Error Codes

| Error Code | Description |
|------------|-------------|
| `MISSING_REQUIRED_FIELDS` | Required fields are missing from request |
| `INVALID_EMAIL` | Email format is invalid |
| `INVALID_OPERATION` | Unknown operation specified |
| `VERIFICATION_CODE_EXPIRED` | Verification code has expired (>10 minutes) |
| `INVALID_VERIFICATION_CODE` | Verification code is incorrect or already used |
| `EMAIL_SEND_FAILED` | Failed to send email via SES |
| `INTERNAL_ERROR` | Internal server error |

## Email Template

The verification email includes:
- **Subject**: "Harmonest - Email Verification for Check-in"
- **6-digit verification code** prominently displayed
- **10-minute expiration notice**
- **Professional HTML and text formatting**

## Security Features

1. **Code Expiration**: Verification codes expire after 10 minutes
2. **Single Use**: Codes can only be used once
3. **Email Validation**: Strict email format validation
4. **Rate Limiting**: Built-in AWS API Gateway throttling
5. **HTTPS Only**: All communications encrypted
6. **TTL Cleanup**: Expired codes automatically removed from database

## Database Schema

Verification codes are stored in DynamoDB with the following structure:

```json
{
  "PK": "EMAIL_VERIFICATION#user@example.com",
  "SK": "CODE#checkin",
  "email": "user@example.com",
  "verificationCode": "123456",
  "type": "checkin",
  "createdAt": 1703123456789,
  "expiresAt": 1703124056789,
  "ttl": 1703124056,
  "verified": false,
  "verifiedAt": null
}
```

## Integration Example

### JavaScript/TypeScript
```javascript
// Send verification email
const sendVerification = async (email) => {
  const response = await fetch('/email-verification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      operation: 'send-verification-email',
      email: email,
      type: 'checkin'
    })
  });
  
  return await response.json();
};

// Verify code
const verifyCode = async (email, code) => {
  const response = await fetch('/email-verification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      operation: 'verify-email-code',
      email: email,
      verificationCode: code,
      type: 'checkin'
    })
  });
  
  return await response.json();
};
```

### cURL Examples

**Send Verification Email**:
```bash
curl -X POST https://your-api-id.execute-api.eu-central-1.amazonaws.com/prod/email-verification \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "send-verification-email",
    "email": "test@example.com",
    "type": "checkin"
  }'
```

**Verify Code**:
```bash
curl -X POST https://your-api-id.execute-api.eu-central-1.amazonaws.com/prod/email-verification \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "verify-email-code",
    "email": "test@example.com",
    "verificationCode": "123456",
    "type": "checkin"
  }'
```

## Deployment

```bash
# Deploy all stacks including email verification
cdk deploy --all --context env=prod --profile harmonestadmin

# Deploy email verification stack only
cdk deploy HarmonestEmailVerification-prod --context env=prod --profile harmonestadmin

# Deploy SES stack (required for email verification)
cdk deploy HarmonestSES-prod --context env=prod --profile harmonestadmin
```

## Monitoring

- **CloudWatch Logs**: `/aws/lambda/harmonest-{env}-lambda_email_verification`
- **Metrics**: Lambda invocations, errors, duration
- **SES Metrics**: Email sending success/failure rates
- **DynamoDB**: Read/write capacity monitoring

## SES Setup Requirements

Before using the email verification system:

1. **Domain Verification**: The domain `harmonest.com` must be verified in SES
2. **Email Identity**: The sender email `noreply@harmonest.com` must be verified
3. **DKIM**: Domain Keys Identified Mail should be enabled for better deliverability
4. **Production Access**: SES account must be moved out of sandbox mode for production use

The CDK deployment automatically creates the necessary SES identities, but manual verification steps may be required depending on your AWS account status.
