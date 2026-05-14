# AWS Email Verification Lambda Function Setup

This document provides instructions for setting up AWS Lambda functions to handle email verification for the check-in process.

## Overview

The email verification system uses:
- **AWS Lambda** for processing verification requests
- **AWS SES (Simple Email Service)** for sending emails
- **AWS API Gateway** for REST API endpoints
- **AWS DynamoDB** for storing verification codes (optional)

## API Endpoints

### 1. Send Verification Email
- **Endpoint**: `POST /email-verification`
- **Operation**: `send-verification-email`
- **Payload**:
```json
{
  "operation": "send-verification-email",
  "email": "user@example.com",
  "verificationCode": "123456",
  "type": "checkin"
}
```

### 2. Verify Email Code
- **Endpoint**: `POST /email-verification`
- **Operation**: `verify-email-code`
- **Payload**:
```json
{
  "operation": "verify-email-code",
  "email": "user@example.com",
  "verificationCode": "123456",
  "type": "checkin"
}
```

## Lambda Function Code Template

```javascript
const AWS = require('aws-sdk');
const ses = new AWS.SES({ region: 'eu-central-1' });

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { operation, email, verificationCode, type } = body;

        if (operation === 'send-verification-email') {
            return await sendVerificationEmail(email, verificationCode, type, headers);
        } else if (operation === 'verify-email-code') {
            return await verifyEmailCode(email, verificationCode, type, headers);
        } else {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'Invalid operation'
                })
            };
        }
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Internal server error'
            })
        };
    }
};

async function sendVerificationEmail(email, verificationCode, type, headers) {
    const emailTemplate = getEmailTemplate(verificationCode, type);
    
    const params = {
        Destination: {
            ToAddresses: [email]
        },
        Message: {
            Body: {
                Html: {
                    Charset: 'UTF-8',
                    Data: emailTemplate.html
                },
                Text: {
                    Charset: 'UTF-8',
                    Data: emailTemplate.text
                }
            },
            Subject: {
                Charset: 'UTF-8',
                Data: emailTemplate.subject
            }
        },
        Source: 'noreply@harmonest.com' // Replace with your verified SES email
    };

    try {
        await ses.sendEmail(params).promise();
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Verification code sent successfully'
            })
        };
    } catch (error) {
        console.error('SES Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Failed to send email'
            })
        };
    }
}

async function verifyEmailCode(email, inputCode, type, headers) {
    // In a real implementation, you would:
    // 1. Retrieve the stored verification code from DynamoDB
    // 2. Check if it matches and hasn't expired
    // 3. Mark the email as verified
    
    // For now, this is a simple validation
    // You should implement proper code storage and validation
    
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            message: 'Email verified successfully'
        })
    };
}

function getEmailTemplate(verificationCode, type) {
    const templates = {
        checkin: {
            subject: 'Harmonest - Email Verification for Check-in',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #dc2626;">Harmonest Check-in Verification</h2>
                    <p>Your verification code for check-in is:</p>
                    <div style="background: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
                        <span style="font-size: 32px; font-weight: bold; color: #dc2626; letter-spacing: 5px;">${verificationCode}</span>
                    </div>
                    <p>This code will expire in 10 minutes.</p>
                    <p>If you didn't request this verification, please ignore this email.</p>
                    <hr style="margin: 30px 0;">
                    <p style="color: #6b7280; font-size: 14px;">
                        This is an automated message from Harmonest. Please do not reply to this email.
                    </p>
                </div>
            `,
            text: `
                Harmonest Check-in Verification
                
                Your verification code is: ${verificationCode}
                
                This code will expire in 10 minutes.
                
                If you didn't request this verification, please ignore this email.
            `
        }
    };
    
    return templates[type] || templates.checkin;
}
```

## AWS Setup Instructions

### 1. Create Lambda Function
```bash
# Create the Lambda function
aws lambda create-function \
    --profile harmonestadmin \
    --function-name harmonest-email-verification \
    --runtime nodejs18.x \
    --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-execution-role \
    --handler index.handler \
    --zip-file fileb://email-verification-lambda.zip \
    --region eu-central-1
```

### 2. Set up SES
```bash
# Verify your email domain in SES
aws ses verify-domain-identity \
    --profile harmonestadmin \
    --domain harmonest.com \
    --region eu-central-1

# Verify individual email address for testing
aws ses verify-email-identity \
    --profile harmonestadmin \
    --email-address noreply@harmonest.com \
    --region eu-central-1
```

### 3. Create API Gateway
```bash
# Create REST API
aws apigateway create-rest-api \
    --profile harmonestadmin \
    --name harmonest-email-verification-api \
    --region eu-central-1
```

### 4. Required IAM Permissions
The Lambda execution role needs these permissions:
- `ses:SendEmail`
- `ses:SendRawEmail`
- `logs:CreateLogGroup`
- `logs:CreateLogStream`
- `logs:PutLogEvents`

## Environment Variables
Set these environment variables in your Lambda function:
- `SES_REGION`: eu-central-1
- `FROM_EMAIL`: noreply@harmonest.com
- `ENVIRONMENT`: prod/dev

## Testing
You can test the Lambda function using the AWS CLI:
```bash
aws lambda invoke \
    --profile harmonestadmin \
    --function-name harmonest-email-verification \
    --payload '{"httpMethod":"POST","body":"{\"operation\":\"send-verification-email\",\"email\":\"test@example.com\",\"verificationCode\":\"123456\",\"type\":\"checkin\"}"}' \
    --region eu-central-1 \
    response.json
```

## Security Considerations
1. Use environment variables for sensitive data
2. Implement rate limiting
3. Validate email addresses
4. Store verification codes securely in DynamoDB with TTL
5. Use HTTPS only
6. Implement proper CORS policies
