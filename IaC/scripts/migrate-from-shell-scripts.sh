#!/bin/bash

# Migration Script: Shell Scripts to AWS CDK
# This script helps migrate from the existing shell script infrastructure to AWS CDK

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CDK_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$CDK_DIR")"
AWS_CLI_DIR="$PROJECT_ROOT/aws_cli"
CONFIG_FILE="$AWS_CLI_DIR/aws_config.json"

echo -e "${BLUE}🔄 Harmonest Infrastructure Migration${NC}"
echo "======================================"
echo
echo "This script will help you migrate from shell script infrastructure to AWS CDK."
echo

# Check prerequisites
echo -e "${BLUE}📋 Checking Prerequisites...${NC}"

# Check if AWS CLI directory exists
if [ ! -d "$AWS_CLI_DIR" ]; then
    echo -e "${RED}❌ AWS CLI directory not found: $AWS_CLI_DIR${NC}"
    exit 1
fi

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}❌ AWS config file not found: $CONFIG_FILE${NC}"
    exit 1
fi

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    echo -e "${RED}❌ AWS CDK CLI not found. Please install it first:${NC}"
    echo "npm install -g aws-cdk"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18 or later.${NC}"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version 18 or later required. Current version: $(node --version)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"
echo

# Load AWS profile from config
AWS_PROFILE=$(jq -r '.aws_profile // "harmonestadmin"' "$CONFIG_FILE")
REGION=$(jq -r '.region // "eu-central-1"' "$CONFIG_FILE")

echo -e "${BLUE}📊 Current Configuration:${NC}"
echo "AWS Profile: $AWS_PROFILE"
echo "Region: $REGION"
echo "Config File: $CONFIG_FILE"
echo

# Prompt for environment
echo "Select environment to migrate:"
echo "1) dev"
echo "2) prod"
echo "3) both"
read -p "Enter choice (1-3): " env_choice

case $env_choice in
    1)
        ENVIRONMENTS=("dev")
        ;;
    2)
        ENVIRONMENTS=("prod")
        ;;
    3)
        ENVIRONMENTS=("dev" "prod")
        ;;
    *)
        echo -e "${RED}❌ Invalid choice. Exiting.${NC}"
        exit 1
        ;;
esac

echo

# Check existing resources
echo -e "${BLUE}🔍 Checking Existing Resources...${NC}"

for ENV in "${ENVIRONMENTS[@]}"; do
    echo "Environment: $ENV"
    
    # Check Cognito User Pool
    USER_POOL_ID=$(aws cognito-idp list-user-pools --max-items 50 --profile "$AWS_PROFILE" --region "$REGION" --query "UserPools[?Name=='harmonest-${ENV}-user-pool'].Id" --output text 2>/dev/null || echo "")
    if [ ! -z "$USER_POOL_ID" ]; then
        echo -e "  ${GREEN}✅ Cognito User Pool found: $USER_POOL_ID${NC}"
    else
        echo -e "  ${YELLOW}⚠️  Cognito User Pool not found${NC}"
    fi
    
    # Check DynamoDB Table
    TABLE_NAME="harmonest-${ENV}-main"
    if aws dynamodb describe-table --table-name "$TABLE_NAME" --profile "$AWS_PROFILE" --region "$REGION" >/dev/null 2>&1; then
        echo -e "  ${GREEN}✅ DynamoDB Table found: $TABLE_NAME${NC}"
    else
        echo -e "  ${YELLOW}⚠️  DynamoDB Table not found: $TABLE_NAME${NC}"
    fi
    
    # Check S3 Bucket
    BUCKET_NAME="harmonest-${ENV}-storage"
    if aws s3api head-bucket --bucket "$BUCKET_NAME" --profile "$AWS_PROFILE" >/dev/null 2>&1; then
        echo -e "  ${GREEN}✅ S3 Bucket found: $BUCKET_NAME${NC}"
    else
        echo -e "  ${YELLOW}⚠️  S3 Bucket not found: $BUCKET_NAME${NC}"
    fi
    
    echo
done

# Warning about migration
echo -e "${YELLOW}⚠️  IMPORTANT MIGRATION NOTES:${NC}"
echo
echo "1. This migration will create NEW resources using CDK"
echo "2. Existing resources created by shell scripts will NOT be automatically imported"
echo "3. You may have DUPLICATE resources after migration"
echo "4. You should manually delete old resources after verifying the new ones work"
echo "5. Make sure to backup any important data before proceeding"
echo
echo -e "${RED}🚨 DATA SAFETY WARNING:${NC}"
echo "- CDK will create new DynamoDB tables and S3 buckets"
echo "- Your existing data will NOT be automatically migrated"
echo "- Plan for data migration separately if needed"
echo

read -p "Do you understand and want to continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Migration cancelled.${NC}"
    exit 0
fi

echo

# Install CDK dependencies
echo -e "${BLUE}📦 Installing CDK Dependencies...${NC}"
cd "$CDK_DIR"

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found in CDK directory${NC}"
    exit 1
fi

npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo

# Build CDK project
echo -e "${BLUE}🔨 Building CDK Project...${NC}"
npm run build
echo -e "${GREEN}✅ CDK project built successfully${NC}"
echo

# Bootstrap CDK (if needed)
echo -e "${BLUE}🚀 Bootstrapping CDK...${NC}"

for ENV in "${ENVIRONMENTS[@]}"; do
    echo "Bootstrapping environment: $ENV"
    
    # Check if already bootstrapped
    BOOTSTRAP_STACK="CDKToolkit"
    if aws cloudformation describe-stacks --stack-name "$BOOTSTRAP_STACK" --profile "$AWS_PROFILE" --region "$REGION" >/dev/null 2>&1; then
        echo -e "  ${GREEN}✅ CDK already bootstrapped${NC}"
    else
        echo "  Bootstrapping CDK..."
        cdk bootstrap --profile "$AWS_PROFILE" --context environment="$ENV"
        echo -e "  ${GREEN}✅ CDK bootstrapped for $ENV${NC}"
    fi
done

echo

# Deploy CDK stacks
echo -e "${BLUE}🚀 Deploying CDK Stacks...${NC}"

for ENV in "${ENVIRONMENTS[@]}"; do
    echo "Deploying to environment: $ENV"
    
    echo "  Deploying all stacks..."
    if [ "$ENV" = "dev" ]; then
        npm run deploy:dev
    else
        npm run deploy:prod
    fi
    
    echo -e "  ${GREEN}✅ All stacks deployed for $ENV${NC}"
done

echo

# Generate migration report
echo -e "${BLUE}📋 Generating Migration Report...${NC}"

REPORT_FILE="$CDK_DIR/migration-report-$(date +%Y%m%d-%H%M%S).md"

cat > "$REPORT_FILE" << EOF
# Harmonest Infrastructure Migration Report

**Migration Date**: $(date)
**Environments**: ${ENVIRONMENTS[*]}
**AWS Profile**: $AWS_PROFILE
**Region**: $REGION

## CDK Stacks Deployed

EOF

for ENV in "${ENVIRONMENTS[@]}"; do
    cat >> "$REPORT_FILE" << EOF
### $ENV Environment

- **Auth Stack**: Harmonest-$ENV-Auth
- **Storage Stack**: Harmonest-$ENV-Storage
- **Messaging Stack**: Harmonest-$ENV-Messaging
- **API Stack**: Harmonest-$ENV-Api
- **CDN Stack**: Harmonest-$ENV-Cdn

#### Stack Outputs

\`\`\`bash
# View stack outputs
aws cloudformation describe-stacks --stack-name Harmonest-$ENV-Auth --profile $AWS_PROFILE --region $REGION --query 'Stacks[0].Outputs'
aws cloudformation describe-stacks --stack-name Harmonest-$ENV-Storage --profile $AWS_PROFILE --region $REGION --query 'Stacks[0].Outputs'
aws cloudformation describe-stacks --stack-name Harmonest-$ENV-Api --profile $AWS_PROFILE --region $REGION --query 'Stacks[0].Outputs'
\`\`\`

EOF
done

cat >> "$REPORT_FILE" << EOF

## Next Steps

1. **Verify New Resources**: Check that all CDK-created resources are working correctly
2. **Update Application Configuration**: Update your Angular app to use new resource IDs/ARNs
3. **Data Migration**: Plan and execute data migration from old to new resources
4. **Test Thoroughly**: Test all application functionality with new infrastructure
5. **Clean Up Old Resources**: After verification, delete old shell script-created resources

## Old Resources to Clean Up

After verifying the new infrastructure works correctly, you can clean up old resources:

\`\`\`bash
# List old resources (created by shell scripts)
# Check for resources with different naming patterns
# Manually delete them through AWS Console or CLI
\`\`\`

## Configuration Updates Needed

Update the following files in your Angular application:

- \`src/environments/environment.ts\`
- \`src/environments/environment.prod.ts\`
- \`src/app/config/aws.config.ts\`

Use the stack outputs to get the correct resource IDs and ARNs.

## Rollback Plan

If you need to rollback to shell script infrastructure:

1. Keep the old shell scripts until migration is fully verified
2. The old resources should still be available (unless manually deleted)
3. Update application configuration back to old resource IDs

## Support

For issues with this migration:

1. Check CDK deployment logs
2. Verify AWS permissions
3. Check resource naming and configuration
4. Review the CDK README.md for troubleshooting
EOF

echo -e "${GREEN}✅ Migration report generated: $REPORT_FILE${NC}"
echo

# Final summary
echo -e "${GREEN}🎉 Migration Completed Successfully!${NC}"
echo
echo -e "${BLUE}📋 Summary:${NC}"
echo "- CDK infrastructure deployed for: ${ENVIRONMENTS[*]}"
echo "- Migration report: $REPORT_FILE"
echo "- CDK project location: $CDK_DIR"
echo
echo -e "${YELLOW}⚠️  Next Steps:${NC}"
echo "1. Review the migration report"
echo "2. Update your Angular application configuration"
echo "3. Test all functionality thoroughly"
echo "4. Plan data migration if needed"
echo "5. Clean up old resources after verification"
echo
echo -e "${BLUE}💡 Useful Commands:${NC}"
echo "# View CDK stack outputs"
echo "cd $CDK_DIR"
echo "cdk list --profile $AWS_PROFILE --context environment=dev"
echo
echo "# Update CDK stacks"
echo "npm run deploy:dev  # or deploy:prod"
echo
echo "# Destroy CDK stacks (if needed)"
echo "npm run destroy:dev  # or destroy:prod"
echo

echo -e "${GREEN}Migration completed! 🚀${NC}"
