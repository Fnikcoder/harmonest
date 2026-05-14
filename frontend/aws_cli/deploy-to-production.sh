#!/bin/bash

# Deploy Harmonest to Production
# This script builds the Angular app and deploys to S3 with CloudFront invalidation

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

echo -e "${BLUE}=== Harmonest Production Deployment ===${NC}"
echo

# Prompt for environment
echo -e "${YELLOW}Select environment:${NC}"
echo "1) Development (dev)"
echo "2) Production (prod)"
read -p "Enter choice (1-2): " env_choice

case $env_choice in
    1)
        ENVIRONMENT="dev"
        BUCKET_NAME="dev.harmonest.de"
        DOMAIN="dev.harmonest.de"
        BUILD_CONFIG="development"
        ;;
    2)
        ENVIRONMENT="prod"
        BUCKET_NAME="harmonest.de"
        DOMAIN="harmonest.de"
        BUILD_CONFIG="production"
        ;;
    *)
        echo -e "${RED}Invalid choice. Exiting.${NC}"
        exit 1
        ;;
esac

echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Bucket Name: ${BUCKET_NAME}${NC}"
echo -e "${BLUE}Domain: ${DOMAIN}${NC}"
echo -e "${BLUE}Build Configuration: ${BUILD_CONFIG}${NC}"
echo

# Confirm deployment
echo -e "${YELLOW}Are you sure you want to deploy to ${ENVIRONMENT}? (y/N)${NC}"
read -p "Confirm: " confirm
if [[ ! $confirm =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Deployment cancelled.${NC}"
    exit 0
fi

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text)
echo -e "${BLUE}AWS Account ID: ${ACCOUNT_ID}${NC}"

# Check if bucket exists
if ! aws s3api head-bucket --profile $AWS_PROFILE --bucket $BUCKET_NAME --region $AWS_REGION >/dev/null 2>&1; then
    echo -e "${RED}Bucket $BUCKET_NAME does not exist. Please run setup-s3-hosting.sh first.${NC}"
    exit 1
fi

# Check if we're in the correct directory
if [ ! -f "package.json" ] || [ ! -f "angular.json" ]; then
    echo -e "${RED}Error: Not in Angular project root directory.${NC}"
    echo -e "${YELLOW}Please run this script from the project root where package.json is located.${NC}"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Update build date in master-config.json
echo -e "${YELLOW}Updating build date in configuration...${NC}"
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TEMP_CONFIG=$(mktemp)

# Use jq to update the build date
jq --arg date "$BUILD_DATE" '.deployment.buildDate = $date' src/assets/config/master-config.json > "$TEMP_CONFIG"
mv "$TEMP_CONFIG" src/assets/config/master-config.json

echo -e "${BLUE}Build date updated to: ${BUILD_DATE}${NC}"

# Build the application
echo -e "${YELLOW}Building Angular application for ${BUILD_CONFIG}...${NC}"

if [ "$BUILD_CONFIG" = "production" ]; then
    npm run build -- --configuration=production
else
    npm run build -- --configuration=development
fi

# Check if build was successful
if [ ! -d "dist" ]; then
    echo -e "${RED}Build failed. dist directory not found.${NC}"
    exit 1
fi

echo -e "${GREEN}Build completed successfully!${NC}"

# Get build size
BUILD_SIZE=$(du -sh dist/ | cut -f1)
echo -e "${BLUE}Build size: ${BUILD_SIZE}${NC}"

# Deploy to S3
echo -e "${YELLOW}Deploying to S3 bucket: ${BUCKET_NAME}...${NC}"

# Sync files to S3 with appropriate cache headers
aws s3 sync dist/ s3://$BUCKET_NAME/ \
    --profile $AWS_PROFILE \
    --region $AWS_REGION \
    --delete \
    --cache-control "public, max-age=31536000" \
    --exclude "*.html" \
    --exclude "*.json"

# Upload HTML and JSON files with no-cache headers
aws s3 sync dist/ s3://$BUCKET_NAME/ \
    --profile $AWS_PROFILE \
    --region $AWS_REGION \
    --cache-control "no-cache, no-store, must-revalidate" \
    --include "*.html" \
    --include "*.json"

echo -e "${GREEN}Files uploaded to S3 successfully!${NC}"

# Get CloudFront distribution ID
echo -e "${YELLOW}Finding CloudFront distribution...${NC}"

DISTRIBUTION_ID=$(aws cloudfront list-distributions \
    --profile $AWS_PROFILE \
    --query "DistributionList.Items[?Aliases.Items[?contains(@, '$DOMAIN')]].Id" \
    --output text)

if [ -n "$DISTRIBUTION_ID" ] && [ "$DISTRIBUTION_ID" != "None" ]; then
    echo -e "${BLUE}Found CloudFront distribution: ${DISTRIBUTION_ID}${NC}"

    # Create invalidation
    echo -e "${YELLOW}Creating CloudFront invalidation...${NC}"

    INVALIDATION_OUTPUT=$(aws cloudfront create-invalidation \
        --profile $AWS_PROFILE \
        --distribution-id $DISTRIBUTION_ID \
        --paths "/*" \
        --output json)

    INVALIDATION_ID=$(echo $INVALIDATION_OUTPUT | jq -r '.Invalidation.Id')

    echo -e "${GREEN}CloudFront invalidation created: ${INVALIDATION_ID}${NC}"
    echo -e "${YELLOW}Invalidation may take 5-15 minutes to complete.${NC}"
else
    echo -e "${YELLOW}CloudFront distribution not found for domain ${DOMAIN}.${NC}"
    echo -e "${YELLOW}Please set up CloudFront distribution using setup-cloudfront.sh${NC}"
fi

# Generate deployment report
echo
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Domain: https://${DOMAIN}${NC}"
echo -e "${BLUE}S3 Bucket: ${BUCKET_NAME}${NC}"
echo -e "${BLUE}Build Size: ${BUILD_SIZE}${NC}"
echo -e "${BLUE}Build Date: ${BUILD_DATE}${NC}"
if [ -n "$DISTRIBUTION_ID" ] && [ "$DISTRIBUTION_ID" != "None" ]; then
    echo -e "${BLUE}CloudFront Distribution: ${DISTRIBUTION_ID}${NC}"
    echo -e "${BLUE}Invalidation ID: ${INVALIDATION_ID}${NC}"
fi
echo
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Wait for CloudFront invalidation to complete (5-15 minutes)"
echo "2. Test the website at https://${DOMAIN}"
echo "3. Verify all functionality works correctly"
echo "4. Monitor CloudWatch logs for any issues"
echo
echo -e "${YELLOW}To check invalidation status:${NC}"
if [ -n "$INVALIDATION_ID" ]; then
    echo "aws cloudfront get-invalidation --profile $AWS_PROFILE --distribution-id $DISTRIBUTION_ID --id $INVALIDATION_ID"
fi
echo
echo -e "${YELLOW}To check website status:${NC}"
echo "curl -I https://${DOMAIN}"
echo
echo -e "${GREEN}Deployment completed successfully! 🚀${NC}"
