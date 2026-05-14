#!/bin/bash

# Verify Production Setup for Harmonest
# This script checks domain, SSL certificate, and AWS resources

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
CERT_REGION="us-east-1"
DOMAIN="harmonest.de"
DEV_DOMAIN="dev.harmonest.de"

echo -e "${BLUE}=== Harmonest Production Setup Verification ===${NC}"
echo

# Get AWS Account ID
echo -e "${YELLOW}Checking AWS credentials...${NC}"
ACCOUNT_ID=$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text 2>/dev/null || echo "ERROR")

if [ "$ACCOUNT_ID" = "ERROR" ]; then
    echo -e "${RED}❌ AWS credentials not configured properly${NC}"
    echo -e "${YELLOW}Please configure AWS CLI with: aws configure --profile harmonestadmin${NC}"
    exit 1
else
    echo -e "${GREEN}✅ AWS Account ID: ${ACCOUNT_ID}${NC}"
fi

# Check Route 53 hosted zones
echo -e "${YELLOW}Checking Route 53 hosted zones...${NC}"
HOSTED_ZONES=$(aws route53 list-hosted-zones --profile $AWS_PROFILE --query "HostedZones[?contains(Name, 'harmonest.de')].Name" --output text 2>/dev/null || echo "ERROR")

if [ "$HOSTED_ZONES" = "ERROR" ] || [ -z "$HOSTED_ZONES" ]; then
    echo -e "${RED}❌ No Route 53 hosted zone found for harmonest.de${NC}"
    echo -e "${YELLOW}Please create a hosted zone for your domain${NC}"
else
    echo -e "${GREEN}✅ Route 53 hosted zone found: ${HOSTED_ZONES}${NC}"
fi

# Check SSL certificates
echo -e "${YELLOW}Checking SSL certificates in us-east-1...${NC}"
CERTIFICATES=$(aws acm list-certificates --profile $AWS_PROFILE --region $CERT_REGION --query "CertificateSummaryList[?contains(DomainName, 'harmonest.de')].{Domain:DomainName,Arn:CertificateArn,Status:Status}" --output table 2>/dev/null || echo "ERROR")

if [ "$CERTIFICATES" = "ERROR" ]; then
    echo -e "${RED}❌ Error checking SSL certificates${NC}"
else
    echo -e "${GREEN}✅ SSL Certificates:${NC}"
    echo "$CERTIFICATES"
fi

# Check S3 buckets
echo -e "${YELLOW}Checking S3 buckets...${NC}"

# Production bucket
PROD_BUCKET="harmonest.de"
if aws s3api head-bucket --profile $AWS_PROFILE --bucket $PROD_BUCKET --region $AWS_REGION >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Production S3 bucket exists: ${PROD_BUCKET}${NC}"
else
    echo -e "${RED}❌ Production S3 bucket not found: ${PROD_BUCKET}${NC}"
fi

# Dev bucket
DEV_BUCKET="dev.harmonest.de"
if aws s3api head-bucket --profile $AWS_PROFILE --bucket $DEV_BUCKET --region $AWS_REGION >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Development S3 bucket exists: ${DEV_BUCKET}${NC}"
else
    echo -e "${RED}❌ Development S3 bucket not found: ${DEV_BUCKET}${NC}"
fi

# Check CloudFront distributions
echo -e "${YELLOW}Checking CloudFront distributions...${NC}"
DISTRIBUTIONS=$(aws cloudfront list-distributions --profile $AWS_PROFILE --query "DistributionList.Items[?Aliases.Items[?contains(@, 'harmonest.de')]].{Id:Id,Domain:DomainName,Status:Status,Aliases:Aliases.Items}" --output table 2>/dev/null || echo "ERROR")

if [ "$DISTRIBUTIONS" = "ERROR" ]; then
    echo -e "${RED}❌ Error checking CloudFront distributions${NC}"
else
    echo -e "${GREEN}✅ CloudFront Distributions:${NC}"
    echo "$DISTRIBUTIONS"
fi

# Check Cognito User Pool
echo -e "${YELLOW}Checking Cognito User Pool...${NC}"
USER_POOL_ID="eu-central-1_oOMDUFanW"
USER_POOL_INFO=$(aws cognito-idp describe-user-pool --profile $AWS_PROFILE --user-pool-id $USER_POOL_ID --region $AWS_REGION --query "UserPool.{Name:Name,Status:Status,CreationDate:CreationDate}" --output table 2>/dev/null || echo "ERROR")

if [ "$USER_POOL_INFO" = "ERROR" ]; then
    echo -e "${RED}❌ Error checking Cognito User Pool${NC}"
else
    echo -e "${GREEN}✅ Cognito User Pool:${NC}"
    echo "$USER_POOL_INFO"
fi

# Check DynamoDB table
echo -e "${YELLOW}Checking DynamoDB table...${NC}"
DYNAMODB_TABLE="harmonest-main"
TABLE_INFO=$(aws dynamodb describe-table --profile $AWS_PROFILE --table-name $DYNAMODB_TABLE --region $AWS_REGION --query "Table.{Name:TableName,Status:TableStatus,ItemCount:ItemCount}" --output table 2>/dev/null || echo "ERROR")

if [ "$TABLE_INFO" = "ERROR" ]; then
    echo -e "${RED}❌ Error checking DynamoDB table${NC}"
else
    echo -e "${GREEN}✅ DynamoDB Table:${NC}"
    echo "$TABLE_INFO"
fi

# Check API Gateway
echo -e "${YELLOW}Checking API Gateway...${NC}"
API_ENDPOINT="https://179a2g0pgk.execute-api.eu-central-1.amazonaws.com/prod"
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_ENDPOINT}/health" 2>/dev/null || echo "ERROR")

if [ "$API_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ API Gateway endpoint is responding: ${API_ENDPOINT}${NC}"
elif [ "$API_STATUS" = "ERROR" ]; then
    echo -e "${YELLOW}⚠️  Could not test API Gateway endpoint (curl not available)${NC}"
else
    echo -e "${RED}❌ API Gateway endpoint returned status: ${API_STATUS}${NC}"
fi

echo
echo -e "${BLUE}=== Summary ===${NC}"
echo -e "${YELLOW}Production Domain: ${DOMAIN}${NC}"
echo -e "${YELLOW}Development Domain: ${DEV_DOMAIN}${NC}"
echo -e "${YELLOW}AWS Region: ${AWS_REGION}${NC}"
echo -e "${YELLOW}Certificate Region: ${CERT_REGION}${NC}"
echo

echo -e "${YELLOW}Next steps for production deployment:${NC}"
echo "1. Ensure SSL certificate is validated and issued"
echo "2. Run setup-s3-hosting.sh to create/configure S3 bucket"
echo "3. Run setup-cloudfront.sh to create CloudFront distribution"
echo "4. Configure Route 53 DNS records to point to CloudFront"
echo "5. Run deploy-to-production.sh to build and deploy"
echo
echo -e "${YELLOW}To run deployment scripts on Windows:${NC}"
echo '& "C:\Program Files\Git\bin\bash.exe" aws_cli/setup-s3-hosting.sh'
echo '& "C:\Program Files\Git\bin\bash.exe" aws_cli/setup-cloudfront.sh'
echo '& "C:\Program Files\Git\bin\bash.exe" aws_cli/deploy-to-production.sh'
