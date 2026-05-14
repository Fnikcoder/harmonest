# Harmonest AWS CDK Infrastructure

This is a **separate CDK project** that manages the AWS infrastructure for the Harmonest application. It's designed to be independent from the Angular frontend application and can be deployed and managed separately.

## Project Structure

This CDK project is located in the `aws-cdk/` directory and is completely separate from the main Angular application. It contains:

```
aws-cdk/                          # ← Separate CDK project
├── bin/harmonest-app.ts          # CDK app entry point
├── lib/stacks/                   # Infrastructure stacks
├── lambda/                       # Lambda function code
├── scripts/                      # Deployment and migration scripts
├── package.json                  # CDK-specific dependencies
└── README.md                     # This file
```

## Infrastructure Stacks

The infrastructure is organized into multiple independent stacks:

- **AuthStack**: AWS Cognito User Pool, Identity Pool, IAM roles, and user groups
- **StorageStack**: DynamoDB table and S3 bucket for data and file storage
- **MessagingStack**: SQS queues and SNS topics for asynchronous messaging
- **ApiStack**: API Gateway REST API with minimal Lambda functions
- **CdnStack**: CloudFront distribution for content delivery

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CloudFront    │    │   API Gateway   │    │     Lambda      │
│   (CDN Stack)   │────│   (API Stack)   │────│   Functions     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Cognito     │    │    DynamoDB     │    │       S3        │
│  (Auth Stack)   │    │ (Storage Stack) │    │ (Storage Stack) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                │
                       ┌─────────────────┐
                       │   SQS & SNS     │
                       │(Messaging Stack)│
                       └─────────────────┘
```

## Prerequisites

1. **AWS CLI** configured with the `harmonestadmin` profile
2. **Node.js** (version 18 or later)
3. **AWS CDK CLI** installed globally: `npm install -g aws-cdk`
4. **TypeScript** installed globally: `npm install -g typescript`

## Project Setup

This CDK project is **independent** from the main Angular application. Set it up separately:

1. **Navigate to the CDK project directory**:
   ```bash
   cd aws-cdk
   ```

2. **Install CDK-specific dependencies**:
   ```bash
   npm install
   ```

3. **Build the CDK project**:
   ```bash
   npm run build
   ```

4. **Bootstrap CDK** (one-time setup per AWS account/region):
   ```bash
   # For development environment
   npm run bootstrap:dev

   # For production environment
   npm run bootstrap:prod
   ```

> **Note**: The CDK project has its own `package.json` and dependencies, separate from the Angular application.

## Deployment

### Development Environment

```bash
# Deploy all stacks to development
npm run deploy:dev

# Deploy specific stack
cdk deploy Harmonest-dev-Auth --profile harmonestadmin --context environment=dev

# View differences before deployment
npm run diff:dev
```

### Production Environment

```bash
# Deploy all stacks to production
npm run deploy:prod

# Deploy specific stack
cdk deploy Harmonest-prod-Auth --profile harmonestadmin --context environment=prod

# View differences before deployment
npm run diff:prod
```

## Stack Dependencies

The stacks have the following deployment order due to dependencies:

1. **AuthStack** (independent)
2. **StorageStack** (depends on AuthStack)
3. **MessagingStack** (independent)
4. **ApiStack** (depends on AuthStack, StorageStack, MessagingStack)
5. **CdnStack** (depends on StorageStack, ApiStack)

## Configuration

Environment-specific configurations are defined in `lib/config/environments.ts`:

- **Development**: Uses `dev` environment with relaxed security settings
- **Production**: Uses `prod` environment with enhanced security and retention policies

## Services Overview

### Authentication (AuthStack)
- **Cognito User Pool**: User authentication and management
- **Cognito Identity Pool**: Federated identities for AWS resource access
- **IAM Roles**: Authenticated and unauthenticated user roles
- **User Groups**: Role-based access control (super_admin, owner, admin, support, user, guest)

### Storage (StorageStack)
- **DynamoDB**: Single-table design with GSIs for efficient queries
- **S3 Bucket**: File storage with lifecycle policies and CORS configuration

### Messaging (MessagingStack)
- **SQS Queues**: Email notifications, SMS notifications, event processing
- **SNS Topics**: Booking notifications, payment notifications, system alerts
- **Dead Letter Queue**: Failed message handling

### API (ApiStack)
- **API Gateway**: REST API with CORS and throttling
- **Lambda Functions**: Business logic for auth, users, properties, bookings, payments, check-in
- **Cognito Authorizer**: JWT token validation for protected endpoints

### CDN (CdnStack)
- **CloudFront Distribution**: Global content delivery
- **Origin Access Control**: Secure S3 access
- **Cache Policies**: Optimized caching for static assets and API responses

## Lambda Functions (Minimal Set)

This setup uses a **Frontend-First Architecture** with minimal Lambda functions:

- **QR Generation**: `checkin-generate-qr` - Calls 3rd party QR API with secret credentials
- **Payment Processing**: `payment-process` - Handles Stripe/PayPal with secret keys
- **Payment Webhooks**: `payment-webhook` - Receives payment provider webhooks
- **Payment Refunds**: `payment-refund` - Processes refunds with secret keys
- **Email Notifications**: `notification-send-email` - Optional, if using 3rd party email service
- **SMS Notifications**: `notification-send-sms` - Optional, if using 3rd party SMS service
- **Auth Trigger**: `auth-post-confirmation` - Optional, Cognito trigger for user creation

**Most operations are handled directly from the frontend** using AWS SDK with Cognito tokens:
- Authentication (Cognito)
- User management (Cognito + DynamoDB)
- Property CRUD (DynamoDB)
- Booking management (DynamoDB)
- File operations (S3)
- Basic notifications (SNS)

## API Endpoints (Minimal Set)

### Lambda-Based Endpoints (require secret credentials)

**QR Code Generation:**
- `POST /checkin/qr` - Generate QR code for check-in (protected)

**Payment Processing:**
- `POST /payments` - Process payment with Stripe/PayPal (protected)
- `POST /payments/webhook` - Payment provider webhooks (public)
- `POST /payments/refund` - Process refund (protected)

**Notifications (Optional):**
- `POST /notifications/email` - Send email via 3rd party service (protected)
- `POST /notifications/sms` - Send SMS via 3rd party service (protected)

### Frontend Direct Operations (no API needed)

**Authentication:** Direct Cognito SDK calls
**User Management:** Direct Cognito + DynamoDB SDK calls
**Property Management:** Direct DynamoDB SDK calls
**Booking Management:** Direct DynamoDB SDK calls
**File Operations:** Direct S3 SDK calls with signed URLs
**Basic Notifications:** Direct SNS SDK calls

See [FRONTEND_FIRST_ARCHITECTURE.md](./FRONTEND_FIRST_ARCHITECTURE.md) for detailed implementation guide.

## Monitoring and Logging

- **CloudWatch Logs**: All Lambda functions and API Gateway logs
- **CloudWatch Metrics**: API Gateway and Lambda metrics
- **X-Ray Tracing**: Distributed tracing for debugging (can be enabled)

## Security Features

- **IAM Roles**: Least privilege access for all resources
- **Cognito Authentication**: JWT token-based authentication
- **API Gateway Authorizers**: Request validation and authorization
- **S3 Bucket Policies**: Secure file access with signed URLs
- **VPC**: Can be configured for Lambda functions (optional)
- **Encryption**: At-rest and in-transit encryption for all data

## Cost Optimization

- **Pay-per-request**: DynamoDB and Lambda billing
- **S3 Lifecycle Policies**: Automatic transition to cheaper storage classes
- **CloudFront Caching**: Reduced origin requests
- **API Gateway Caching**: Reduced Lambda invocations

## Cleanup

To destroy all resources:

```bash
# Development environment
npm run destroy:dev

# Production environment (requires confirmation)
npm run destroy:prod
```

**Warning**: This will permanently delete all data. Make sure to backup important data before destroying production resources.

## Troubleshooting

### Common Issues

1. **Bootstrap Error**: Run `cdk bootstrap` with the correct profile and region
2. **Permission Denied**: Ensure the AWS profile has necessary IAM permissions
3. **Stack Dependencies**: Deploy stacks in the correct order
4. **Resource Limits**: Check AWS service limits for your account

### Useful Commands

```bash
# List all stacks
cdk list --profile harmonestadmin --context environment=dev

# View synthesized CloudFormation template
cdk synth --profile harmonestadmin --context environment=dev

# View stack outputs
aws cloudformation describe-stacks --stack-name Harmonest-dev-Auth --profile harmonestadmin --region eu-central-1
```

## Migration from Shell Scripts

This **separate CDK project** replaces the shell scripts in the main project's `aws_cli` directory. The CDK provides:

- **Infrastructure as Code**: Version-controlled, repeatable deployments
- **Type Safety**: TypeScript provides compile-time error checking
- **Dependency Management**: Automatic handling of resource dependencies
- **Rollback Support**: Automatic rollback on deployment failures
- **Change Detection**: Only deploys changed resources
- **Project Separation**: Infrastructure code is separate from application code

### Migration Process

1. **Keep both projects separate**: The CDK project manages infrastructure, the Angular project handles the application
2. **Deploy infrastructure first**: Use this CDK project to create AWS resources
3. **Update Angular configuration**: Use the CDK outputs to configure the Angular app
4. **Clean up old resources**: Remove shell script-created resources after verification

## Integration with Angular Application

After deploying this CDK infrastructure:

1. **Get Stack Outputs**: Extract resource IDs and ARNs from CDK stack outputs
2. **Update Angular Configuration**: Configure the Angular app to use the new AWS resources
3. **Implement AWS SDK**: Set up direct AWS SDK calls in the Angular application
4. **Configure IAM Policies**: Set up role-based access control for different user types

### Connecting the Projects

```bash
# 1. Deploy infrastructure (from aws-cdk directory)
cd aws-cdk
npm run deploy:dev

# 2. Get stack outputs
aws cloudformation describe-stacks --stack-name Harmonest-dev-Auth --profile harmonestadmin --region eu-central-1 --query 'Stacks[0].Outputs'

# 3. Update Angular environment files (from main project directory)
cd ../
# Update src/environments/environment.ts with new resource IDs
```

## Next Steps

1. **Deploy Infrastructure**: Use this CDK project to create AWS resources
2. **Configure Angular App**: Update the main Angular project with new resource IDs
3. **Implement Frontend-First Architecture**: Set up direct AWS SDK calls in Angular
4. **Implement Essential Lambda Functions**: Add QR generation and payment processing logic
5. **Set Up Monitoring**: Configure CloudWatch alarms and dashboards
6. **Security Hardening**: Implement fine-grained IAM policies
7. **CI/CD Pipeline**: Set up automated deployments for both infrastructure and application
