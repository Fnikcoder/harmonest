# Unified Door Access System - Deployment Guide

This guide walks you through deploying the Unified Door Access system for Harmonest, supporting both QRLock (QR codes) and TTLock (PIN codes).

## 📋 Prerequisites

Before deploying, ensure you have:

1. **QRLock API Credentials** (for QR code doors)
   - Email and password for QRLock API access
   - Access to `https://hms.qrlock.net/api/app`

2. **TTLock API Credentials** (for PIN code doors)
   - Username and password for TTLock account
   - Access to `https://lock2.ttlock.com`
   - App ID and App Secret (from your TTLock developer account)

3. **AWS Setup**
   - AWS CLI configured with `harmonestadmin` profile
   - CDK installed and bootstrapped
   - SES verified domain/email for sending emails
   - SNS enabled for SMS in your region

3. **Existing Infrastructure**
   - Core Harmonest stacks deployed (Core, Layer, API, etc.)
   - DynamoDB table and API Gateway already set up

## 🚀 Step-by-Step Deployment

### Step 1: Deploy the Unified Door Access Stack

Deploy the infrastructure with your credentials:

```bash
# Deploy for production with all credentials
cdk deploy --context client=harmonest --context env=prod \
  --context qrlock_email=your-qrlock-email@example.com \
  --context qrlock_password=your-qrlock-password \
  --context ttlock_username=your-ttlock-username \
  --context ttlock_password=your-ttlock-password \
  --context ttlock_app_id=your-app-id \
  --context ttlock_app_secret=your-app-secret \
  --profile harmonestadmin
```

**Required Context Variables:**
- `qrlock_email`: Your QRLock API email
- `qrlock_password`: Your QRLock API password
- `ttlock_username`: Your TTLock username
- `ttlock_password`: Your TTLock password
- `ttlock_app_id`: Your TTLock App ID (from developer console)
- `ttlock_app_secret`: Your TTLock App Secret (from developer console)

### Step 2: Verify API Connections

Test that your credentials work for both systems:

```bash
# Test the complete system
python scripts/test_qr_notification.py prod
```

You should see successful authentication for both QRLock and TTLock APIs.

### Step 3: Infrastructure Created

Deploy the infrastructure:

```bash
# Deploy for production
cdk deploy --context client=harmonest --context env=prod --profile harmonestadmin

# The stack name will be: HarmonestQRNotification-prod
```

This creates:
- ✅ Lambda function for QR code generation
- ✅ API Gateway endpoint `/qr-notification`
- ✅ EventBridge rules for scheduling
- ✅ IAM roles and permissions
- ✅ Secrets Manager integration

### Step 4: Set Up Room Configurations

Configure which doors each room can access:

```bash
# Create sample room configurations
python scripts/setup_room_config.py harmonest-main harmonest

# Or create custom configuration file first
python scripts/setup_room_config.py --create-sample
# Edit sample_room_config.json with your door configurations
python scripts/setup_room_config.py harmonest-main harmonest sample_room_config.json
```

### Step 5: Configure SES for Email Sending

Ensure your email domain is verified in SES:

```bash
# Check SES verification status
aws ses get-identity-verification-attributes --identities noreply@harmonest.com --profile harmonestadmin

# If not verified, verify your domain
aws ses verify-domain-identity --domain harmonest.com --profile harmonestadmin
```

### Step 6: Test the Complete System

Run the integration test:

```bash
# Test the complete flow
python scripts/test_qr_notification.py prod
```

Expected output:
```
🚀 Starting QR Code Notification System Test
✅ Created test data: Reservation ID: RES-test-1234567890
✅ Created test room configuration for Room 101
🧪 Testing QR Notification API...
   Status Code: 200
   Success: True
   Message: QR code generated and email notification sent successfully
📊 Test Results Summary:
   API Endpoint: ✅ PASS
   Lambda Direct: ✅ PASS
   EventBridge: ✅ PASS
   Overall: ✅ ALL TESTS PASSED
```

## 🔧 Configuration

### Environment Variables

The Lambda function uses these environment variables (automatically set by CDK):

```bash
APP_TABLE=harmonest-main                    # DynamoDB table
SES_REGION=eu-central-1                    # SES region
SNS_REGION=eu-central-1                    # SNS region  
FROM_EMAIL=noreply@harmonest.com           # Sender email
ENVIRONMENT=prod                           # Environment name
QRLOCK_CRED_SECRET=harmonest-prod-qrlock-credentials  # Secret name
SMS_SENDER_ID=Harmonest                    # SMS sender ID
DEFAULT_COUNTRY_CODE=49                    # Default country (Germany)
```

### Room Configuration Format

Each room needs a configuration in DynamoDB:

```json
{
  "PK": "ROOM_CONFIG#harmonest",
  "SK": "ROOM#101", 
  "roomName": "101",
  "roomType": "standard",
  "doors": [
    {
      "name": "Main Entrance",
      "readerId": "12345",
      "type": "qrlock",
      "description": "Building main entrance"
    },
    {
      "name": "Room 101 Door", 
      "readerId": "12347",
      "type": "qrlock",
      "description": "Room entrance"
    },
    {
      "name": "Laundry Room",
      "readerId": "12348", 
      "type": "pin4",
      "pin": "1234",
      "description": "Shared facility"
    }
  ]
}
```

## 🔗 Integration with Check-in Process

The system automatically integrates with your existing check-in process:

1. **Guest completes check-in** → Check-in Lambda calls `_schedule_qr_code_trigger()`
2. **EventBridge rule created** → Scheduled 24h before check-in (or 15min if <24h)
3. **QR Code Lambda triggered** → Generates QR code and sends notification
4. **Guest receives email/SMS** → With link to `harmonest.de/activatedqrcode?qrcode=...`

## 📱 Frontend Integration

You need to implement the QR code display page:

### QR Code Display Page

Create a page at `https://harmonest.de/activatedqrcode` that:

1. **Extracts QR code** from URL parameter `?qrcode=...`
2. **Displays QR code** as image or text for scanning
3. **Shows room information** (optional)
4. **Provides download option** (optional)

Example implementation:
```html
<!DOCTYPE html>
<html>
<head>
    <title>Room Access QR Code</title>
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
</head>
<body>
    <div id="qr-container">
        <h2>Your Room Access Code</h2>
        <canvas id="qr-canvas"></canvas>
        <p>Hold your phone close to the door reader</p>
    </div>
    
    <script>
        const urlParams = new URLSearchParams(window.location.search);
        const qrCode = urlParams.get('qrcode');
        
        if (qrCode) {
            QRCode.toCanvas(document.getElementById('qr-canvas'), qrCode, {
                width: 256,
                margin: 2
            });
        }
    </script>
</body>
</html>
```

## 🔍 Monitoring & Troubleshooting

### CloudWatch Logs

Monitor the Lambda function:
```bash
# View logs
aws logs tail /aws/lambda/harmonest-prod-lambda_qr_code_notification --follow --profile harmonestadmin
```

### Common Issues

1. **QRLock Authentication Failed**
   ```bash
   # Verify credentials
   python scripts/setup_qrlock_credentials.py verify prod --profile harmonestadmin
   ```

2. **Room Configuration Not Found**
   ```bash
   # Check room configurations
   python scripts/setup_room_config.py harmonest-main harmonest
   ```

3. **Email Not Sending**
   ```bash
   # Check SES verification
   aws ses get-identity-verification-attributes --identities noreply@harmonest.com --profile harmonestadmin
   ```

### Debug Mode

Enable debug logging:
```bash
# Update Lambda environment variable
aws lambda update-function-configuration \
  --function-name harmonest-prod-lambda_qr_code_notification \
  --environment Variables='{LOG_LEVEL=DEBUG}' \
  --profile harmonestadmin
```

## 🔄 Updates & Maintenance

### Update QRLock Credentials

```bash
# Update credentials
python scripts/setup_qrlock_credentials.py setup prod --profile harmonestadmin
```

### Update Room Configurations

```bash
# Add new room configurations
python scripts/setup_room_config.py harmonest-main harmonest new_rooms.json
```

### Redeploy Lambda Function

```bash
# Redeploy with code changes
cdk deploy --context client=harmonest --context env=prod --profile harmonestadmin
```

## 🎯 Next Steps

After successful deployment:

1. **Implement QR Code Display Page** at `harmonest.de/activatedqrcode`
2. **Test with Real Reservations** using your check-in flow
3. **Monitor Performance** via CloudWatch metrics
4. **Set Up Alerts** for failed QR generations or email deliveries
5. **Configure Additional Rooms** as needed

## 📞 Support

If you encounter issues:

1. Check the deployment logs
2. Verify all prerequisites are met
3. Run the test script to isolate the problem
4. Check CloudWatch logs for detailed error messages

The system is now ready to automatically generate and send QR codes to your guests! 🎉
