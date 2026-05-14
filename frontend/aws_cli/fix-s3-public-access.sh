#!/bin/bash

# Fix S3 Public Access Settings for Harmonest
# This script disables block public access and sets the bucket policy

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

echo -e "${BLUE}=== Fix S3 Public Access Settings ===${NC}"
echo

# Prompt for environment
echo -e "${YELLOW}Select environment:${NC}"
echo "1) Development (dev.harmonest.de)"
echo "2) Production (harmonest.de)"
read -p "Enter choice (1-2): " env_choice

case $env_choice in
    1)
        BUCKET_NAME="dev.harmonest.de"
        ;;
    2)
        BUCKET_NAME="harmonest.de"
        ;;
    *)
        echo -e "${RED}Invalid choice. Exiting.${NC}"
        exit 1
        ;;
esac

echo -e "${BLUE}Bucket Name: ${BUCKET_NAME}${NC}"
echo

# Check if bucket exists
if ! aws s3api head-bucket --profile $AWS_PROFILE --bucket $BUCKET_NAME --region $AWS_REGION >/dev/null 2>&1; then
    echo -e "${RED}Bucket $BUCKET_NAME does not exist.${NC}"
    exit 1
fi

echo -e "${YELLOW}Disabling block public access settings...${NC}"

# Disable block public access
aws s3api put-public-access-block \
    --profile $AWS_PROFILE \
    --bucket $BUCKET_NAME \
    --public-access-block-configuration \
    "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

echo -e "${GREEN}✅ Block public access disabled${NC}"

# Wait a moment for the setting to take effect
echo -e "${YELLOW}Waiting for settings to take effect...${NC}"
sleep 5

# Create and apply bucket policy
echo -e "${YELLOW}Setting public read policy...${NC}"

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

aws s3api put-bucket-policy \
    --profile $AWS_PROFILE \
    --bucket $BUCKET_NAME \
    --policy file://bucket-policy.json

echo -e "${GREEN}✅ Public read policy applied${NC}"

# Configure static website hosting
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

echo -e "${GREEN}✅ Static website hosting configured${NC}"

# Configure CORS
echo -e "${YELLOW}Configuring CORS policy...${NC}"

cat > cors-policy.json << EOF
{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "POST", "PUT", "DELETE", "HEAD"],
            "AllowedOrigins": ["https://${BUCKET_NAME}", "https://www.${BUCKET_NAME}"],
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

echo -e "${GREEN}✅ CORS policy configured${NC}"

# Clean up temporary files
rm -f bucket-policy.json cors-policy.json

# Get website endpoint
WEBSITE_URL="http://${BUCKET_NAME}.s3-website-${AWS_REGION}.amazonaws.com"

echo
echo -e "${GREEN}=== S3 Configuration Complete ===${NC}"
echo -e "${BLUE}Bucket Name: ${BUCKET_NAME}${NC}"
echo -e "${BLUE}Website URL: ${WEBSITE_URL}${NC}"
echo -e "${BLUE}Region: ${AWS_REGION}${NC}"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Re-run your deployment script to upload files"
echo "2. Create CloudFront distribution for HTTPS"
echo "3. Configure DNS records"
echo
echo -e "${YELLOW}To test the website:${NC}"
echo "curl -I ${WEBSITE_URL}"
echo
echo -e "${GREEN}S3 bucket is now ready for static website hosting! 🚀${NC}"
