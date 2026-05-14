# Email Verification Deployment Guide

This guide walks you through deploying the email verification functionality for the Harmonest check-in system.

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **CDK CLI** installed (`npm install -g aws-cdk`)
3. **Python 3.12+** installed
4. **Existing Harmonest infrastructure** deployed (Core, Layer, API stacks)

## Deployment Steps

### 1. Deploy SES Stack (Required First)

The SES stack must be deployed before the email verification stack as it creates the necessary email identities.

```bash
# Deploy SES stack
cdk deploy HarmonestSES-prod --context env=prod --profile harmonestadmin
```

**Important**: After deploying the SES stack, you need to verify the domain and email identity:

#### Domain Verification
1. Go to AWS SES Console → Identities
2. Find `harmonest.com` domain identity
3. Copy the DNS verification records (CNAME records for DKIM)
4. Add them to your DNS provider (Route 53, Cloudflare, etc.)
5. Wait for verification (can take up to 72 hours)

**Note**: Once the domain is verified, you can send from ANY email address on that domain (like `noreply@harmonest.com`, `support@harmonest.com`, etc.) without additional verification.

### 2. Deploy Email Verification Stack

Once SES is set up and verified:

```bash
# Deploy email verification stack
cdk deploy HarmonestEmailVerification-prod --context env=prod --profile harmonestadmin
```

### 3. Deploy All Stacks (Alternative)

You can also deploy all stacks at once:

```bash
# Deploy all stacks including email verification
cdk deploy --all --context env=prod --profile harmonestadmin
```

## Post-Deployment Configuration

### 1. SES Sandbox Mode

By default, SES accounts are in sandbox mode, which means:
- You can only send emails to verified email addresses
- Daily sending quota is limited to 200 emails
- Maximum send rate is 1 email per second

**For Production**: Request to move out of sandbox mode:
1. Go to SES Console → Account dashboard
2. Click "Request production access"
3. Fill out the form with your use case
4. Wait for AWS approval (usually 24-48 hours)

### 2. Update Test Script

Update the `test_email_verification.py` script with your actual API Gateway URL:

```python
# Replace this line in test_email_verification.py
API_BASE_URL = "https://your-actual-api-id.execute-api.eu-central-1.amazonaws.com/prod"
```

You can find your API Gateway URL in:
- AWS Console → API Gateway → Your API → Stages → prod
- CDK deployment outputs
- SSM Parameter Store: `/harmonest/prod/api/url`

### 3. Test the Deployment

Run the test script to verify everything works:

```bash
# Basic tests
python test_email_verification.py

# Interactive test (will prompt for verification code)
python test_email_verification.py --interactive
```

## Monitoring and Troubleshooting

### CloudWatch Logs

Monitor the Lambda function logs:
```bash
# View logs
aws logs tail /aws/lambda/harmonest-prod-lambda_email_verification --follow --profile harmonestadmin
```

### Common Issues

#### 1. SES Domain Not Verified
**Error**: `MessageRejected: Email address not verified`
**Solution**: Verify the `harmonest.com` domain in SES Console (this covers all @harmonest.com addresses)

#### 2. SES Sandbox Mode
**Error**: `MessageRejected: Email address not verified` (for recipient)
**Solution**: Either verify recipient email or request production access

#### 3. Lambda Timeout
**Error**: Task timed out after 30.00 seconds
**Solution**: Check SES configuration and network connectivity

#### 4. DynamoDB Access Issues
**Error**: `AccessDeniedException`
**Solution**: Verify Lambda has proper DynamoDB permissions

### Useful AWS CLI Commands

```bash
# Check SES identities
aws ses list-identities --profile harmonestadmin --region eu-central-1

# Check SES sending statistics
aws ses get-send-statistics --profile harmonestadmin --region eu-central-1

# Test Lambda function directly
aws lambda invoke \
  --function-name harmonest-prod-lambda_email_verification \
  --payload '{"httpMethod":"POST","body":"{\"operation\":\"send-verification-email\",\"email\":\"test@example.com\",\"type\":\"checkin\"}"}' \
  --profile harmonestadmin \
  --region eu-central-1 \
  response.json

# View response
cat response.json
```

## Security Considerations

1. **Rate Limiting**: API Gateway has built-in throttling (1000 req/sec, 2000 burst)
2. **CORS**: Configured to allow specific domains only
3. **Code Expiration**: Verification codes expire after 10 minutes
4. **Single Use**: Codes can only be used once
5. **TTL Cleanup**: Expired codes are automatically removed from DynamoDB

## Integration with Frontend

The email verification API is now available at:
```
POST https://your-api-id.execute-api.eu-central-1.amazonaws.com/prod/email-verification
```

Example integration:
```javascript
// Send verification email
const response = await fetch('/email-verification', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'send-verification-email',
    email: userEmail,
    type: 'checkin'
  })
});

// Verify code
const verifyResponse = await fetch('/email-verification', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'verify-email-code',
    email: userEmail,
    verificationCode: userCode,
    type: 'checkin'
  })
});
```

## Cleanup

To remove the email verification functionality:

```bash
# Remove email verification stack
cdk destroy HarmonestEmailVerification-prod --context env=prod --profile harmonestadmin

# Remove SES stack (optional, but will remove email identities)
cdk destroy HarmonestSES-prod --context env=prod --profile harmonestadmin
```

## Support

For issues or questions:
1. Check CloudWatch logs for detailed error information
2. Verify SES configuration and domain verification status
3. Test with the provided test script
4. Review the API documentation for correct request format
