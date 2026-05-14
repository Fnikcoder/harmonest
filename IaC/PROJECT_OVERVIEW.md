# Harmonest Project Structure Overview

This document explains the separation between the CDK infrastructure project and the main Angular application.

## Project Architecture

```
harmonest/
├── frontend/                          # Main Angular Application
│   ├── src/
│   │   ├── app/                      # Angular components, services, etc.
│   │   ├── environments/             # Environment configurations
│   │   └── ...
│   ├── aws_cli/                      # Legacy shell scripts (to be replaced)
│   ├── aws-cdk/                      # ← Separate CDK Infrastructure Project
│   │   ├── bin/                      # CDK app entry point
│   │   ├── lib/                      # Infrastructure stacks
│   │   ├── lambda/                   # Lambda function code
│   │   ├── scripts/                  # Deployment scripts
│   │   ├── package.json              # CDK dependencies
│   │   └── README.md                 # CDK documentation
│   ├── package.json                  # Angular dependencies
│   └── README.md                     # Angular documentation
```

## Two Separate Projects

### 1. Angular Application (Main Project)
- **Location**: Root directory (`frontend/`)
- **Purpose**: Frontend application with UI, components, services
- **Technology**: Angular 19, TypeScript, Tailwind CSS
- **Dependencies**: Angular, AWS SDK, UI libraries
- **Deployment**: Build and deploy to S3/CloudFront

### 2. CDK Infrastructure Project
- **Location**: `aws-cdk/` subdirectory
- **Purpose**: AWS infrastructure management
- **Technology**: AWS CDK, TypeScript, Node.js
- **Dependencies**: AWS CDK libraries, constructs
- **Deployment**: Deploy AWS resources via CloudFormation

## Why Separate Projects?

### ✅ **Benefits of Separation**

1. **Clear Separation of Concerns**
   - Infrastructure code separate from application code
   - Different teams can work on each independently

2. **Independent Deployment Cycles**
   - Deploy infrastructure changes without touching application
   - Deploy application updates without infrastructure changes

3. **Different Dependencies**
   - CDK project only needs AWS CDK libraries
   - Angular project only needs frontend dependencies

4. **Version Control**
   - Infrastructure changes tracked separately
   - Easier to review and approve infrastructure modifications

5. **Security**
   - Infrastructure code can have different access controls
   - Sensitive infrastructure configurations isolated

6. **CI/CD Flexibility**
   - Different pipelines for infrastructure vs application
   - Infrastructure changes can require additional approvals

## Workflow

### Infrastructure Development
```bash
cd aws-cdk                    # Navigate to CDK project
npm install                   # Install CDK dependencies
npm run build                 # Build CDK project
npm run deploy:dev           # Deploy infrastructure
```

### Application Development
```bash
cd ../                       # Back to main Angular project
npm install                  # Install Angular dependencies
ng serve                     # Develop application
ng build                     # Build application
```

### Integration
```bash
# 1. Deploy infrastructure first
cd aws-cdk
npm run deploy:dev

# 2. Get outputs and update Angular config
.\scripts\update-angular-config.ps1 -Environment dev

# 3. Test Angular application with new infrastructure
cd ../
ng serve
```

## Communication Between Projects

### CDK → Angular
- **Stack Outputs**: CDK exports resource IDs, ARNs, URLs
- **Configuration Scripts**: Automated scripts update Angular environment files
- **Manual Configuration**: Copy resource IDs to Angular environment files

### Angular → AWS Resources
- **Direct SDK Calls**: Angular uses AWS SDK to access DynamoDB, S3, Cognito
- **API Gateway**: Angular calls Lambda functions via REST API
- **Authentication**: Cognito tokens provide access to AWS resources

## Development Teams

### Infrastructure Team
- **Responsibilities**: AWS resources, security policies, cost optimization
- **Tools**: AWS CDK, CloudFormation, AWS CLI
- **Files**: Everything in `aws-cdk/` directory

### Frontend Team
- **Responsibilities**: UI/UX, business logic, user experience
- **Tools**: Angular CLI, TypeScript, AWS SDK
- **Files**: Everything in main directory except `aws-cdk/`

### DevOps Team
- **Responsibilities**: CI/CD pipelines, deployments, monitoring
- **Tools**: GitHub Actions, AWS CodePipeline, CloudWatch
- **Files**: Both projects, deployment scripts

## Deployment Strategy

### Infrastructure-First Approach
1. **Deploy Infrastructure**: Use CDK to create/update AWS resources
2. **Extract Outputs**: Get resource IDs from CloudFormation stacks
3. **Update Application**: Configure Angular app with new resource IDs
4. **Deploy Application**: Build and deploy Angular app to S3/CloudFront
5. **Test Integration**: Verify everything works together

### Environment Management
- **Development**: `aws-cdk` deploys to dev environment, Angular connects to dev resources
- **Production**: `aws-cdk` deploys to prod environment, Angular connects to prod resources
- **Staging**: Optional staging environment for testing

## Best Practices

### 1. **Version Synchronization**
- Tag both projects with same version when releasing
- Document which Angular version works with which infrastructure version

### 2. **Configuration Management**
- Use automated scripts to sync configurations
- Validate configurations before deployment

### 3. **Testing**
- Test infrastructure changes in dev environment first
- Test Angular app with new infrastructure before production deployment

### 4. **Documentation**
- Keep both project READMEs updated
- Document integration points and dependencies

### 5. **Security**
- Review infrastructure changes carefully
- Use least-privilege IAM policies
- Separate AWS accounts for dev/prod if needed

## Migration Path

### From Shell Scripts to CDK
1. **Keep shell scripts**: Don't delete until CDK is fully tested
2. **Deploy CDK alongside**: Create new resources with CDK
3. **Test thoroughly**: Verify all functionality works
4. **Migrate data**: Move data from old to new resources if needed
5. **Update Angular**: Point Angular to new CDK-created resources
6. **Clean up**: Remove old shell script-created resources

### Rollback Plan
- Keep old shell scripts until CDK is proven stable
- Document rollback procedures
- Test rollback in dev environment

## Getting Started

1. **Start with Infrastructure**:
   ```bash
   cd aws-cdk
   npm install
   npm run deploy:dev
   ```

2. **Configure Application**:
   ```bash
   .\scripts\update-angular-config.ps1 -Environment dev
   ```

3. **Test Integration**:
   ```bash
   cd ../
   ng serve
   ```

This separation provides a clean, maintainable architecture that scales well as your team and application grow.
