#!/bin/bash

# Setup S3 Static Website Hosting for Harmonest
# This script creates and configures S3 bucket for static website hosting

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

echo -e "${BLUE}=== Harmonest S3 Static Website Hosting Setup ===${NC}"
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
        ;;
    2)
        ENVIRONMENT="prod"
        BUCKET_NAME="harmonest.de"
        DOMAIN="harmonest.de"
        ;;
    *)
        echo -e "${RED}Invalid choice. Exiting.${NC}"
        exit 1
        ;;
esac

echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Bucket Name: ${BUCKET_NAME}${NC}"
echo -e "${BLUE}Domain: ${DOMAIN}${NC}"
echo

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text)
echo -e "${BLUE}AWS Account ID: ${ACCOUNT_ID}${NC}"

# Check if bucket exists
if aws s3api head-bucket --profile $AWS_PROFILE --bucket $BUCKET_NAME --region $AWS_REGION >/dev/null 2>&1; then
    echo -e "${YELLOW}Bucket $BUCKET_NAME already exists. Configuring...${NC}"
else
    echo -e "${YELLOW}Creating S3 bucket: $BUCKET_NAME${NC}"

    # Create bucket
    aws s3api create-bucket \
        --profile $AWS_PROFILE \
        --bucket $BUCKET_NAME \
        --region $AWS_REGION \
        --create-bucket-configuration LocationConstraint=$AWS_REGION

    echo -e "${GREEN}Bucket created successfully!${NC}"
fi

# Configure bucket for static website hosting
echo -e "${YELLOW}Configuring static website hosting...${NC}"

aws s3api put-bucket-website \
    --profile $AWS_PROFILE \
    --bucket $BUCKET_NAME \
    --website-configuration '{
        "IndexDocument": {
            "Suffix": "index.html"
        },
        "ErrorDocument": {
            "Key": "index.html"
        }
    }'

# Create bucket policy for public read access
echo -e "${YELLOW}Creating bucket policy for public access...${NC}"

cat > bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::${BUCKET_NAME}/*"
        }
    ]
}
EOF

# Apply bucket policy
aws s3api put-bucket-policy \
    --profile $AWS_PROFILE \
    --bucket $BUCKET_NAME \
    --policy file://bucket-policy.json

# Disable block public access (required for static website hosting)
echo -e "${YELLOW}Configuring public access settings...${NC}"

aws s3api put-public-access-block \
    --profile $AWS_PROFILE \
    --bucket $BUCKET_NAME \
    --public-access-block-configuration \
    "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

# Configure CORS for API access
echo -e "${YELLOW}Configuring CORS policy...${NC}"

cat > cors-policy.json << EOF
{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "POST", "PUT", "DELETE", "HEAD"],
            "AllowedOrigins": ["https://${DOMAIN}", "https://www.${DOMAIN}"],
            "ExposeHeaders": ["ETag"],
            "MaxAgeSeconds": 3000
        }
    ]
}
EOF

aws s3api put-bucket-cors \
    --profile $AWS_PROFILE \
    --bucket $BUCKET_NAME \
    --cors-configuration file://cors-policy.json

# Get website endpoint
WEBSITE_ENDPOINT=$(aws s3api get-bucket-website \
    --profile $AWS_PROFILE \
    --bucket $BUCKET_NAME \
    --query 'IndexDocument.Suffix' \
    --output text 2>/dev/null || echo "")

if [ -n "$WEBSITE_ENDPOINT" ]; then
    WEBSITE_URL="http://${BUCKET_NAME}.s3-website.${AWS_REGION}.amazonaws.com"
else
    WEBSITE_URL="http://${BUCKET_NAME}.s3-website-${AWS_REGION}.amazonaws.com"
fi

# Clean up temporary files
rm -f bucket-policy.json cors-policy.json

echo
echo -e "${GREEN}=== S3 Static Website Hosting Setup Complete ===${NC}"
echo -e "${BLUE}Bucket Name: ${BUCKET_NAME}${NC}"
echo -e "${BLUE}Website URL: ${WEBSITE_URL}${NC}"
echo -e "${BLUE}Region: ${AWS_REGION}${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Build your Angular application: npm run build"
echo "2. Deploy files to S3: aws s3 sync dist/ s3://${BUCKET_NAME}/ --profile ${AWS_PROFILE}"
echo "3. Set up CloudFront distribution for HTTPS and custom domain"
echo "4. Configure Route 53 DNS records"
echo
echo -e "${YELLOW}To upload files manually:${NC}"
echo "aws s3 sync dist/ s3://${BUCKET_NAME}/ --profile ${AWS_PROFILE} --delete"
echo
echo -e "${YELLOW}To test the website:${NC}"
echo "curl -I ${WEBSITE_URL}"
