# Frontend-First Architecture Guide

This document explains how to implement most operations directly from your Angular frontend using AWS SDK and Cognito tokens, minimizing the need for Lambda functions.

## Overview

Instead of creating 35+ Lambda functions, we use a **Frontend-First Architecture** where:

- **Frontend handles**: Authentication, CRUD operations, file uploads, basic notifications
- **Lambda functions handle**: Operations requiring secret credentials (QR generation, payments, webhooks)

## Architecture Benefits

✅ **Reduced Complexity**: Fewer moving parts, easier debugging  
✅ **Lower Costs**: No Lambda invocation costs for most operations  
✅ **Better Performance**: Direct AWS SDK calls, no API Gateway latency  
✅ **Real-time Updates**: Direct DynamoDB/S3 access without polling APIs  
✅ **Simplified Development**: No need to maintain separate backend APIs  

## What You Can Do Directly from Frontend

### 1. Authentication (AWS Cognito)

```typescript
// Direct Cognito calls - no Lambda needed
import { Auth } from 'aws-amplify';

// Sign up
await Auth.signUp({
  username: email,
  password: password,
  attributes: { given_name: firstName, family_name: lastName }
});

// Sign in
await Auth.signIn(email, password);

// Forgot password
await Auth.forgotPassword(email);
```

### 2. User Management (Cognito + DynamoDB)

```typescript
// Get current user profile
const user = await Auth.currentAuthenticatedUser();

// Update user attributes (Cognito)
await Auth.updateUserAttributes(user, {
  given_name: newFirstName,
  family_name: newLastName
});

// Update user profile (DynamoDB)
await dynamoClient.send(new UpdateCommand({
  TableName: 'harmonest-dev-main',
  Key: { PK: `user_${user.username}`, SK: 'profile' },
  UpdateExpression: 'SET firstName = :fn, lastName = :ln',
  ExpressionAttributeValues: {
    ':fn': newFirstName,
    ':ln': newLastName
  }
}));
```

### 3. Property Management (DynamoDB)

```typescript
// List properties
const properties = await dynamoClient.send(new QueryCommand({
  TableName: 'harmonest-dev-main',
  IndexName: 'GSI1',
  KeyConditionExpression: 'GSI1PK = :pk',
  ExpressionAttributeValues: { ':pk': 'property_group' }
}));

// Create property (admin only - controlled by IAM policy)
await dynamoClient.send(new PutCommand({
  TableName: 'harmonest-dev-main',
  Item: {
    PK: `property_group_${propertyId}`,
    SK: 'metadata',
    name: propertyName,
    location: location,
    // ... other fields
  }
}));
```

### 4. Booking Management (DynamoDB)

```typescript
// Create booking
await dynamoClient.send(new PutCommand({
  TableName: 'harmonest-dev-main',
  Item: {
    PK: `booking_${bookingId}`,
    SK: 'metadata',
    userId: currentUser.username,
    propertyId: propertyId,
    checkIn: checkInDate,
    checkOut: checkOutDate,
    status: 'pending'
  }
}));

// List user bookings
const bookings = await dynamoClient.send(new QueryCommand({
  TableName: 'harmonest-dev-main',
  IndexName: 'GSI1',
  KeyConditionExpression: 'GSI1PK = :pk',
  ExpressionAttributeValues: { ':pk': `user_${currentUser.username}` }
}));
```

### 5. File Operations (S3)

```typescript
// Upload file with signed URL
const uploadUrl = await s3Client.send(new PutObjectCommand({
  Bucket: 'harmonest-dev-storage',
  Key: `users/profiles/${userId}/avatar.jpg`,
  ContentType: 'image/jpeg'
}));

// Direct upload to S3
await fetch(uploadUrl, {
  method: 'PUT',
  body: fileBlob,
  headers: { 'Content-Type': 'image/jpeg' }
});
```

### 6. Notifications (SNS)

```typescript
// Send notification
await snsClient.send(new PublishCommand({
  TopicArn: 'arn:aws:sns:eu-central-1:123456789:harmonest-dev-booking-notifications',
  Message: JSON.stringify({
    type: 'booking_confirmed',
    userId: userId,
    bookingId: bookingId
  })
}));
```

## IAM Policies for Role-Based Access

### Guest/Unauthenticated Users
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Query",
        "dynamodb:GetItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/harmonest-*-main",
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:Attributes": ["PK", "SK", "name", "description", "images"]
        }
      }
    }
  ]
}
```

### Regular Users
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/harmonest-*-main",
      "Condition": {
        "ForAllValues:StringLike": {
          "dynamodb:LeadingKeys": ["user_${cognito-identity.amazonaws.com:sub}", "booking_*"]
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::harmonest-*-storage/users/${cognito-identity.amazonaws.com:sub}/*"
    }
  ]
}
```

### Admin Users
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:*",
        "s3:*",
        "cognito-idp:ListUsers",
        "cognito-idp:AdminGetUser",
        "cognito-idp:AdminUpdateUserAttributes"
      ],
      "Resource": "*"
    }
  ]
}
```

## Lambda Functions (Minimal Set)

### 1. QR Code Generation
**Why Lambda?** Requires 3rd party API credentials that shouldn't be exposed to frontend.

```typescript
// Frontend calls Lambda
const response = await fetch(`${apiUrl}/checkin/qr`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    bookingId: bookingId,
    guestName: guestName,
    checkInDate: checkInDate,
    roomNumber: roomNumber
  })
});
```

### 2. Payment Processing
**Why Lambda?** Stripe/PayPal secret keys must be kept secure.

```typescript
// Frontend calls Lambda for payment
const response = await fetch(`${apiUrl}/payments`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: totalAmount,
    currency: 'EUR',
    paymentMethodId: stripePaymentMethodId,
    bookingId: bookingId
  })
});
```

### 3. Payment Webhooks
**Why Lambda?** External services (Stripe/PayPal) need a server endpoint to send webhooks.

## Implementation Steps

### 1. Set Up AWS SDK in Angular

```bash
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/client-s3 @aws-sdk/client-sns
```

### 2. Configure AWS SDK with Cognito

```typescript
// aws-config.service.ts
import { Injectable } from '@angular/core';
import { Auth } from 'aws-amplify';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

@Injectable({ providedIn: 'root' })
export class AwsConfigService {
  private dynamoClient: DynamoDBDocumentClient;

  constructor() {
    this.initializeClients();
  }

  private async initializeClients() {
    const credentials = await Auth.currentCredentials();
    
    this.dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({
      region: 'eu-central-1',
      credentials: Auth.essentialCredentials(credentials)
    }));
  }

  getDynamoClient() {
    return this.dynamoClient;
  }
}
```

### 3. Create Service Classes

```typescript
// user.service.ts
@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private awsConfig: AwsConfigService) {}

  async getUserProfile(userId: string) {
    const client = this.awsConfig.getDynamoClient();
    return await client.send(new GetCommand({
      TableName: 'harmonest-dev-main',
      Key: { PK: `user_${userId}`, SK: 'profile' }
    }));
  }

  async updateUserProfile(userId: string, updates: any) {
    const client = this.awsConfig.getDynamoClient();
    return await client.send(new UpdateCommand({
      TableName: 'harmonest-dev-main',
      Key: { PK: `user_${userId}`, SK: 'profile' },
      UpdateExpression: 'SET #name = :name, #email = :email',
      ExpressionAttributeNames: {
        '#name': 'name',
        '#email': 'email'
      },
      ExpressionAttributeValues: {
        ':name': updates.name,
        ':email': updates.email
      }
    }));
  }
}
```

## Security Considerations

1. **IAM Policies**: Use fine-grained policies based on user roles
2. **Cognito Groups**: Assign users to groups with different permissions
3. **Resource-Level Permissions**: Restrict access to user's own data
4. **API Rate Limiting**: Use API Gateway throttling for Lambda endpoints
5. **Input Validation**: Validate all inputs on both frontend and Lambda

## Cost Comparison

### Traditional Backend API (35 Lambda functions)
- **Lambda Invocations**: ~1M requests/month = $0.20
- **Lambda Duration**: ~100ms average = $8.33
- **API Gateway**: ~1M requests = $3.50
- **Total**: ~$12/month + DynamoDB/S3 costs

### Frontend-First Architecture (6 Lambda functions)
- **Lambda Invocations**: ~50K requests/month = $0.01
- **Lambda Duration**: ~100ms average = $0.42
- **API Gateway**: ~50K requests = $0.18
- **Total**: ~$0.61/month + DynamoDB/S3 costs

**Savings**: ~95% reduction in serverless costs!

## Next Steps

1. **Deploy the minimal CDK setup**
2. **Implement AWS SDK services in Angular**
3. **Set up proper IAM policies**
4. **Test role-based access control**
5. **Implement the few essential Lambda functions**
6. **Add monitoring and error handling**

This approach gives you the best of both worlds: the security and scalability of AWS services with the simplicity and cost-effectiveness of frontend-first architecture.
