# QR Code Notification System Documentation

This document describes the QR Code Notification system for the Harmonest hotel management platform.

## Overview

The QR Code Notification system automatically generates QR codes for guest room access and sends them via email or SMS. The system integrates with the QRLock API for door access management and supports dynamic client configuration.

## Architecture

```
Check-in Complete → EventBridge Schedule → QR Code Lambda → QRLock API → Email/SMS Notification
                                                        ↓
                                                   Update DynamoDB
```

### Components

1. **QR Code Notification Lambda** (`functions/qr_code_notification/`)
   - Main handler for QR code generation and notification
   - Integrates with QRLock API
   - Sends email and SMS notifications

2. **QRLock Client** (`qrlock_client.py`)
   - Handles authentication with QRLock API
   - Manages QR code generation requests
   - Door access configuration management

3. **Notification Templates** (`notification_templates.py`)
   - Email template generation with client branding
   - SMS template optimization for character limits

4. **SMS Service** (`sms_service.py`)
   - AWS SNS integration for SMS delivery
   - Phone number formatting and validation
   - Message length optimization

## Features

### QR Code Generation
- **QRLock API Integration**: Authenticates and generates QR codes via QRLock API
- **Door Access Management**: Configures which doors guests can access
- **Time-based Access**: QR codes valid for guest's stay duration
- **Room-specific Configuration**: Different door access per room type

### Notification Delivery
- **Email Notifications**: Rich HTML emails with QR code links
- **SMS Notifications**: Optimized short messages with links
- **Dynamic Templates**: Client-specific branding and domains
- **Multi-language Support**: Ready for internationalization

### Door Access Logic
- **Room Configuration**: JSON-based door configuration per room
- **QR vs PIN Doors**: Support for both QR code and PIN-based doors
- **Access Paths**: Configures complete access path from entrance to room

## Configuration

### Environment Variables

```bash
# QRLock API Configuration
QRLOCK_EMAIL=your-qrlock-email@example.com
QRLOCK_PASSWORD=your-qrlock-password

# Email Configuration
FROM_EMAIL=noreply@harmonest.com
SES_REGION=eu-central-1

# SMS Configuration
SNS_REGION=eu-central-1
SMS_SENDER_ID=Harmonest
DEFAULT_COUNTRY_CODE=49

# General Configuration
ENVIRONMENT=prod
APP_TABLE=harmonest-main
```

### Room Configuration

Room configurations are stored in DynamoDB with the following structure:

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
      "description": "Room 101 entrance"
    },
    {
      "name": "Laundry Room",
      "readerId": "12348",
      "type": "pin4",
      "pin": "1234",
      "description": "Shared laundry facility"
    }
  ]
}
```

## API Endpoints

### Generate QR Code Notification

**Endpoint**: `POST /qr-notification`

**Request Body**:
```json
{
  "reservationId": "12345",
  "notificationPreference": "email"
}
```

**Response**:
```json
{
  "success": true,
  "message": "QR code generated and email notification sent successfully",
  "data": {
    "reservationId": "12345",
    "qrCode": "FFB5EAF96908B0C7AF4...",
    "notificationType": "email",
    "doorCount": 3,
    "qrDoorCount": 2,
    "pinDoorCount": 1
  }
}
```

## Deployment

### Prerequisites

1. **QRLock API Credentials**: Obtain credentials from QRLock
2. **AWS SES Setup**: Configure SES for email sending
3. **AWS SNS Setup**: Enable SMS sending in your region
4. **Room Configurations**: Set up room door configurations

### Deploy with CDK

```bash
# Deploy the QR Code Notification stack
cdk deploy --context client=harmonest --context env=prod --profile harmonestadmin

# Set QRLock credentials (optional - can be set via environment)
cdk deploy --context qrlock_email=your-email@example.com --context qrlock_password=your-password
```

### Setup Room Configurations

```bash
# Create sample room configurations
python scripts/setup_room_config.py harmonest-main harmonest

# Or use custom configuration file
python scripts/setup_room_config.py harmonest-main harmonest custom_rooms.json
```

## Testing

### Manual Testing

1. **Test QR Code Generation**:
```bash
curl -X POST https://your-api-id.execute-api.eu-central-1.amazonaws.com/prod/qr-notification \
  -H "Content-Type: application/json" \
  -d '{"reservationId": "test-123"}'
```

2. **Test Room Configuration**:
```python
python scripts/setup_room_config.py --create-sample
```

### Integration Testing

The system integrates with:
- **Check-in Process**: Automatically triggered after check-in completion
- **EventBridge**: Scheduled QR code generation
- **DynamoDB**: Room configurations and QR code records
- **SES/SNS**: Email and SMS delivery

## Monitoring

### CloudWatch Logs
- `/aws/lambda/harmonest-{env}-lambda_qr_code_notification`

### Key Metrics
- QR code generation success rate
- Email/SMS delivery success rate
- QRLock API response times
- Door configuration lookup performance

### Alarms
- Failed QR code generations
- QRLock API authentication failures
- High error rates in notifications

## Troubleshooting

### Common Issues

1. **QRLock Authentication Failed**
   - Check QRLOCK_EMAIL and QRLOCK_PASSWORD environment variables
   - Verify QRLock API credentials are valid
   - Check QRLock API status

2. **Room Configuration Not Found**
   - Verify room configurations exist in DynamoDB
   - Check room name matches exactly
   - Run room configuration setup script

3. **Email/SMS Delivery Failed**
   - Check SES/SNS permissions
   - Verify FROM_EMAIL is verified in SES
   - Check phone number format for SMS

4. **QR Code Link Not Working**
   - Verify primary domain configuration
   - Check QR code display page implementation
   - Ensure QR code is properly encoded

### Debug Mode

Enable debug logging by setting `LOG_LEVEL=DEBUG` in environment variables.

## Security Considerations

1. **QRLock Credentials**: Store securely in environment variables or AWS Secrets Manager
2. **QR Code Security**: QR codes contain access tokens - ensure HTTPS for all links
3. **Phone Number Privacy**: SMS service validates and formats phone numbers
4. **Email Security**: Use verified domains in SES

## Future Enhancements

1. **URL Shortening**: Integrate with URL shortener for SMS
2. **Push Notifications**: Add mobile app push notification support
3. **QR Code Expiry**: Implement time-based QR code expiration
4. **Access Logging**: Track door access events
5. **Multi-language**: Add support for multiple languages in templates
