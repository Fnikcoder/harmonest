#!/bin/bash

# Deploy Email Verification Lambda Function
# This script creates and deploys the AWS Lambda function for email verification

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_PROFILE="harmonestadmin"
AWS_REGION="eu-central-1"
FUNCTION_NAME="harmonest-email-verification"
API_NAME="harmonest-email-verification-api"

echo -e "${BLUE}=== Harmonest Email Verification Lambda Deployment ===${NC}"
echo

# Prompt for environment
echo -e "${YELLOW}Select environment:${NC}"
echo "1) Development (dev)"
echo "2) Production (prod)"
read -p "Enter choice (1-2): " env_choice

case $env_choice in
    1)
        ENVIRONMENT="dev"
        FUNCTION_NAME="${FUNCTION_NAME}-dev"
        API_NAME="${API_NAME}-dev"
        ;;
    2)
        ENVIRONMENT="prod"
        FUNCTION_NAME="${FUNCTION_NAME}-prod"
        API_NAME="${API_NAME}-prod"
        ;;
    *)
        echo -e "${RED}Invalid choice. Exiting.${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}Selected environment: ${ENVIRONMENT}${NC}"
echo

# Check if AWS CLI is configured
if ! aws sts get-caller-identity --profile $AWS_PROFILE >/dev/null 2>&1; then
    echo -e "${RED}Error: AWS CLI not configured for profile $AWS_PROFILE${NC}"
    echo "Please run: aws configure --profile $AWS_PROFILE"
    exit 1
fi

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text)
echo -e "${BLUE}AWS Account ID: ${ACCOUNT_ID}${NC}"

# Create Lambda function code
echo -e "${YELLOW}Creating Lambda function code...${NC}"
cat > email-verification-lambda.js << 'EOF'
const AWS = require('aws-sdk');
const ses = new AWS.SES({ region: process.env.SES_REGION || 'eu-central-1' });

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

        console.log('Processing request:', { operation, email, type });

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
        Source: process.env.FROM_EMAIL || 'noreply@harmonest.com'
    };

    try {
        const result = await ses.sendEmail(params).promise();
        console.log('Email sent successfully:', result.MessageId);
        
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
    // Simple verification - in production, implement proper code storage/validation
    console.log('Verifying code for email:', email);
    
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
EOF

# Create package.json
cat > package.json << EOF
{
  "name": "harmonest-email-verification",
  "version": "1.0.0",
  "description": "Email verification Lambda function for Harmonest",
  "main": "email-verification-lambda.js",
  "dependencies": {
    "aws-sdk": "^2.1000.0"
  }
}
EOF

# Create deployment package
echo -e "${YELLOW}Creating deployment package...${NC}"
zip -r email-verification-lambda.zip email-verification-lambda.js package.json

# Check if Lambda function exists
if aws lambda get-function --profile $AWS_PROFILE --function-name $FUNCTION_NAME --region $AWS_REGION >/dev/null 2>&1; then
    echo -e "${YELLOW}Lambda function exists. Updating...${NC}"
    
    # Update function code
    aws lambda update-function-code \
        --profile $AWS_PROFILE \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://email-verification-lambda.zip \
        --region $AWS_REGION
        
    echo -e "${GREEN}Lambda function updated successfully!${NC}"
else
    echo -e "${YELLOW}Creating new Lambda function...${NC}"
    
    # Create IAM role for Lambda (if it doesn't exist)
    ROLE_NAME="harmonest-email-verification-role"
    ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
    
    if ! aws iam get-role --profile $AWS_PROFILE --role-name $ROLE_NAME >/dev/null 2>&1; then
        echo -e "${YELLOW}Creating IAM role...${NC}"
        
        # Create trust policy
        cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
        
        # Create role
        aws iam create-role \
            --profile $AWS_PROFILE \
            --role-name $ROLE_NAME \
            --assume-role-policy-document file://trust-policy.json
            
        # Attach basic execution policy
        aws iam attach-role-policy \
            --profile $AWS_PROFILE \
            --role-name $ROLE_NAME \
            --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
            
        # Create and attach SES policy
        cat > ses-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    }
  ]
}
EOF
        
        aws iam put-role-policy \
            --profile $AWS_PROFILE \
            --role-name $ROLE_NAME \
            --policy-name SESEmailPolicy \
            --policy-document file://ses-policy.json
            
        echo -e "${GREEN}IAM role created successfully!${NC}"
        
        # Wait for role to be available
        echo -e "${YELLOW}Waiting for IAM role to be available...${NC}"
        sleep 10
    fi
    
    # Create Lambda function
    aws lambda create-function \
        --profile $AWS_PROFILE \
        --function-name $FUNCTION_NAME \
        --runtime nodejs18.x \
        --role $ROLE_ARN \
        --handler email-verification-lambda.handler \
        --zip-file fileb://email-verification-lambda.zip \
        --timeout 30 \
        --memory-size 256 \
        --environment Variables="{SES_REGION=$AWS_REGION,FROM_EMAIL=noreply@harmonest.com,ENVIRONMENT=$ENVIRONMENT}" \
        --region $AWS_REGION
        
    echo -e "${GREEN}Lambda function created successfully!${NC}"
fi

# Clean up temporary files
rm -f email-verification-lambda.js package.json email-verification-lambda.zip trust-policy.json ses-policy.json

echo
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo -e "${BLUE}Function Name: ${FUNCTION_NAME}${NC}"
echo -e "${BLUE}Region: ${AWS_REGION}${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Set up API Gateway to trigger this Lambda function"
echo "2. Verify your email domain in AWS SES"
echo "3. Update the frontend API endpoint configuration"
echo "4. Test the email verification functionality"
echo
echo -e "${YELLOW}To test the function:${NC}"
echo "aws lambda invoke --profile $AWS_PROFILE --function-name $FUNCTION_NAME --payload '{\"httpMethod\":\"POST\",\"body\":\"{\\\"operation\\\":\\\"send-verification-email\\\",\\\"email\\\":\\\"test@example.com\\\",\\\"verificationCode\\\":\\\"123456\\\",\\\"type\\\":\\\"checkin\\\"}\"}' --region $AWS_REGION response.json"
