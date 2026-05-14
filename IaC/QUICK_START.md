# Quick Start Guide - Harmonest AWS CDK Infrastructure

This guide will help you quickly set up and deploy the Harmonest infrastructure using this **separate CDK project**.

## Important: Project Separation

This CDK project is **completely separate** from the main Angular application:

- **CDK Project**: `aws-cdk/` directory - manages AWS infrastructure
- **Angular Project**: Main directory - handles the frontend application
- **Independent Deployment**: Each project can be deployed separately

## Prerequisites

1. **AWS CLI** configured with `harmonestadmin` profile
2. **Node.js** 18+ installed
3. **AWS CDK CLI** installed globally: `npm install -g aws-cdk`

## Quick Setup (5 minutes)

### 1. Navigate to CDK Project

```bash
cd aws-cdk
```

### 2. Install CDK Dependencies

```bash
npm install
```

### 3. Build the CDK Project

```bash
npm run build
```

### 4. Bootstrap CDK (one-time setup)

```bash
# For development
npm run bootstrap:dev

# For production
npm run bootstrap:prod
```

### 5. Deploy Infrastructure

```bash
# Deploy to development
npm run deploy:dev

# Deploy to production
npm run deploy:prod
```

## Migration from Shell Scripts

If you're migrating from the existing shell script infrastructure:

### Windows (PowerShell)

```powershell
# Run the migration script
.\scripts\migrate-from-shell-scripts.ps1
```

### Linux/Mac (Bash)

```bash
# Run the migration script
./scripts/migrate-from-shell-scripts.sh
```

## Verify Deployment

After deployment, verify your resources:

```bash
# List all stacks
cdk list --profile harmonestadmin --context environment=dev

# View stack outputs
aws cloudformation describe-stacks --stack-name Harmonest-dev-Auth --profile harmonestadmin --region eu-central-1 --query 'Stacks[0].Outputs'
```

## Connect to Your Angular Application

After successful infrastructure deployment, you need to connect it to your main Angular application:

### 1. Get Stack Outputs (from CDK directory)

```bash
# Make sure you're in the CDK directory
cd aws-cdk

# Get Cognito User Pool ID
aws cloudformation describe-stacks --stack-name Harmonest-dev-Auth --profile harmonestadmin --region eu-central-1 --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text

# Get API Gateway URL
aws cloudformation describe-stacks --stack-name Harmonest-dev-Api --profile harmonestadmin --region eu-central-1 --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' --output text

# Or use the automated script
.\scripts\update-angular-config.ps1 -Environment dev
```

### 2. Update Angular Environment Files (in main project)

Navigate back to your main Angular project and update the environment files:

```bash
# Go back to main project directory
cd ../

# Update src/environments/environment.ts and src/environments/environment.prod.ts
```

```typescript
export const environment = {
  production: false,
  cognito: {
    region: 'eu-central-1',
    userPoolId: 'YOUR_NEW_USER_POOL_ID',
    userPoolWebClientId: 'YOUR_NEW_CLIENT_ID',
    identityPoolId: 'YOUR_NEW_IDENTITY_POOL_ID',
    // ... other config
  },
  apiUrl: 'YOUR_NEW_API_GATEWAY_URL',
  // ... other config
};
```

## Common CDK Commands

**Important**: Run these commands from the `aws-cdk/` directory:

```bash
# Navigate to CDK project
cd aws-cdk

# View differences before deployment
npm run diff:dev

# Deploy specific stack
cdk deploy Harmonest-dev-Auth --profile harmonestadmin --context environment=dev

# Destroy all stacks (careful!)
npm run destroy:dev

# View synthesized CloudFormation template
cdk synth --profile harmonestadmin --context environment=dev

# Watch for changes and rebuild
npm run watch

# List all stacks
cdk list --profile harmonestadmin --context environment=dev
```

## Stack Overview

Your infrastructure includes:

- **AuthStack**: Cognito User Pool, Identity Pool, IAM roles
- **StorageStack**: DynamoDB table, S3 bucket
- **MessagingStack**: SQS queues, SNS topics
- **ApiStack**: API Gateway, Lambda functions
- **CdnStack**: CloudFront distribution

## Troubleshooting

### Common Issues

1. **Bootstrap Error**: Make sure CDK is bootstrapped in your region
2. **Permission Denied**: Verify AWS profile has necessary permissions
3. **Stack Dependencies**: Deploy stacks in order (Auth → Storage → Messaging → API → CDN)

### Get Help

```bash
# View CDK help
cdk --help

# View specific command help
cdk deploy --help

# Check AWS credentials
aws sts get-caller-identity --profile harmonestadmin
```

## Project Workflow

### Infrastructure Management (CDK Project)
```bash
cd aws-cdk                    # Work on infrastructure
npm run deploy:dev           # Deploy AWS resources
npm run diff:dev             # Check changes
```

### Application Development (Main Project)
```bash
cd ../                       # Back to main Angular project
ng serve                     # Develop your application
ng build                     # Build for production
```

## Next Steps

1. **Deploy Infrastructure**: Complete the CDK deployment
2. **Configure Angular App**: Update environment files with new resource IDs
3. **Implement Frontend-First Architecture**: Set up direct AWS SDK calls in Angular
4. **Test Integration**: Verify Angular app works with new infrastructure
5. **Implement Essential Lambda Functions**: Add QR generation and payment processing
6. **Set Up Monitoring**: Configure CloudWatch alarms and dashboards
7. **CI/CD Pipeline**: Set up automated deployments for both projects

## Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [CDK TypeScript Reference](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib-readme.html)
- [Frontend-First Architecture Guide](./FRONTEND_FIRST_ARCHITECTURE.md)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)

---

**Need help?** Check the main [README.md](./README.md) for detailed documentation.
