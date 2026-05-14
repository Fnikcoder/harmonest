#!/bin/bash

# Setup CloudFront Distribution for Harmonest
# This script creates and configures CloudFront distribution with SSL certificate

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
CERT_REGION="us-east-1"  # ACM certificates for CloudFront must be in us-east-1

echo -e "${BLUE}=== Harmonest CloudFront Distribution Setup ===${NC}"
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
        CERT_ARN="arn:aws:acm:us-east-1:669597026882:certificate/95795cc3-cb98-4fd7-a862-1f0682fe3520"
        ;;
    2)
        ENVIRONMENT="prod"
        BUCKET_NAME="harmonest.de"
        DOMAIN="harmonest.de"
        CERT_ARN="arn:aws:acm:us-east-1:669597026882:certificate/95795cc3-cb98-4fd7-a862-1f0682fe3520"
        ;;
    *)
        echo -e "${RED}Invalid choice. Exiting.${NC}"
        exit 1
        ;;
esac

echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Bucket Name: ${BUCKET_NAME}${NC}"
echo -e "${BLUE}Domain: ${DOMAIN}${NC}"
echo -e "${BLUE}Certificate ARN: ${CERT_ARN}${NC}"
echo

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text)
echo -e "${BLUE}AWS Account ID: ${ACCOUNT_ID}${NC}"

# Verify certificate exists
echo -e "${YELLOW}Verifying SSL certificate...${NC}"
if aws acm describe-certificate --profile $AWS_PROFILE --certificate-arn $CERT_ARN --region $CERT_REGION >/dev/null 2>&1; then
    echo -e "${GREEN}Certificate verified!${NC}"
else
    echo -e "${RED}Certificate not found. Please create/verify the certificate first.${NC}"
    echo -e "${YELLOW}To create a certificate:${NC}"
    echo "aws acm request-certificate --profile $AWS_PROFILE --domain-name $DOMAIN --domain-name www.$DOMAIN --validation-method DNS --region $CERT_REGION"
    exit 1
fi

# Get S3 website endpoint
WEBSITE_ENDPOINT="${BUCKET_NAME}.s3-website.${AWS_REGION}.amazonaws.com"

# Create CloudFront distribution configuration
echo -e "${YELLOW}Creating CloudFront distribution configuration...${NC}"

cat > cloudfront-config.json << EOF
{
    "CallerReference": "$(date +%s)",
    "Aliases": {
        "Quantity": 2,
        "Items": [
            "${DOMAIN}",
            "www.${DOMAIN}"
        ]
    },
    "DefaultRootObject": "index.html",
    "Origins": {
        "Quantity": 1,
        "Items": [
            {
                "Id": "origin-${DOMAIN}",
                "DomainName": "${WEBSITE_ENDPOINT}",
                "OriginPath": "",
                "CustomHeaders": {
                    "Quantity": 0
                },
                "CustomOriginConfig": {
                    "HTTPPort": 80,
                    "HTTPSPort": 443,
                    "OriginProtocolPolicy": "http-only",
                    "OriginSslProtocols": {
                        "Quantity": 3,
                        "Items": [
                            "TLSv1.2"
                        ]
                    },
                    "OriginReadTimeout": 30,
                    "OriginKeepaliveTimeout": 5
                },
                "ConnectionAttempts": 3,
                "ConnectionTimeout": 10,
                "OriginShield": {
                    "Enabled": false
                }
            }
        ]
    },
    "OriginGroups": {
        "Quantity": 0
    },
    "DefaultCacheBehavior": {
        "TargetOriginId": "origin-${DOMAIN}",
        "TrustedSigners": {
            "Enabled": false,
            "Quantity": 0
        },
        "TrustedKeyGroups": {
            "Enabled": false,
            "Quantity": 0
        },
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {
            "Quantity": 7,
            "Items": [
                "DELETE",
                "GET",
                "HEAD",
                "OPTIONS",
                "PATCH",
                "POST",
                "PUT"
            ],
            "CachedMethods": {
                "Quantity": 2,
                "Items": [
                    "GET",
                    "HEAD"
                ]
            }
        },
        "SmoothStreaming": false,
        "Compress": true,
        "LambdaFunctionAssociations": {
            "Quantity": 0
        },
        "FunctionAssociations": {
            "Quantity": 0
        },
        "FieldLevelEncryptionId": "",
        "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
        "OriginRequestPolicyId": "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf",
        "ResponseHeadersPolicyId": "5cc3b908-e619-4b99-88e5-2cf7f45965bd"
    },
    "CacheBehaviors": {
        "Quantity": 0
    },
    "CustomErrorResponses": {
        "Quantity": 1,
        "Items": [
            {
                "ErrorCode": 404,
                "ResponsePagePath": "/index.html",
                "ResponseCode": "200",
                "ErrorCachingMinTTL": 300
            }
        ]
    },
    "Comment": "CloudFront distribution for ${DOMAIN}",
    "Logging": {
        "Enabled": false,
        "IncludeCookies": false,
        "Bucket": "",
        "Prefix": ""
    },
    "PriceClass": "PriceClass_100",
    "Enabled": true,
    "ViewerCertificate": {
        "CloudFrontDefaultCertificate": false,
        "ACMCertificateArn": "${CERT_ARN}",
        "SSLSupportMethod": "sni-only",
        "MinimumProtocolVersion": "TLSv1.2_2021",
        "Certificate": "${CERT_ARN}",
        "CertificateSource": "acm"
    },
    "Restrictions": {
        "GeoRestriction": {
            "RestrictionType": "none",
            "Quantity": 0
        }
    },
    "HttpVersion": "http2",
    "IsIPV6Enabled": true
}
EOF

# Create CloudFront distribution
echo -e "${YELLOW}Creating CloudFront distribution...${NC}"
echo -e "${YELLOW}This may take several minutes...${NC}"

DISTRIBUTION_OUTPUT=$(aws cloudfront create-distribution \
    --profile $AWS_PROFILE \
    --distribution-config file://cloudfront-config.json \
    --output json)

DISTRIBUTION_ID=$(echo $DISTRIBUTION_OUTPUT | jq -r '.Distribution.Id')
DISTRIBUTION_DOMAIN=$(echo $DISTRIBUTION_OUTPUT | jq -r '.Distribution.DomainName')

echo -e "${GREEN}CloudFront distribution created successfully!${NC}"
echo -e "${BLUE}Distribution ID: ${DISTRIBUTION_ID}${NC}"
echo -e "${BLUE}Distribution Domain: ${DISTRIBUTION_DOMAIN}${NC}"

# Wait for distribution to be deployed
echo -e "${YELLOW}Waiting for distribution to be deployed...${NC}"
echo -e "${YELLOW}This can take 15-20 minutes. You can check status with:${NC}"
echo "aws cloudfront get-distribution --profile $AWS_PROFILE --id $DISTRIBUTION_ID"

# Update aws_config.json with the new distribution ID
echo -e "${YELLOW}Updating aws_config.json with distribution ID...${NC}"
CONFIG_FILE="$(dirname "$0")/aws_config.json"

if [ -f "$CONFIG_FILE" ]; then
    # Create a backup
    cp "$CONFIG_FILE" "${CONFIG_FILE}.backup"

    # Update the distribution ID using jq
    if command -v jq >/dev/null 2>&1; then
        jq --arg env "$ENVIRONMENT" --arg dist_id "$DISTRIBUTION_ID" \
           '.[$env].cloudfront_distribution_id = $dist_id' \
           "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
        echo -e "${GREEN}✅ Updated aws_config.json with distribution ID${NC}"
    else
        echo -e "${YELLOW}⚠️  jq not found. Please manually add distribution ID to aws_config.json:${NC}"
        echo "\"cloudfront_distribution_id\": \"$DISTRIBUTION_ID\""
    fi
else
    echo -e "${YELLOW}⚠️  aws_config.json not found. Please manually save distribution ID: $DISTRIBUTION_ID${NC}"
fi

# Clean up temporary files
rm -f cloudfront-config.json

echo
echo -e "${GREEN}=== CloudFront Distribution Setup Complete ===${NC}"
echo -e "${BLUE}Distribution ID: ${DISTRIBUTION_ID}${NC}"
echo -e "${BLUE}Distribution Domain: ${DISTRIBUTION_DOMAIN}${NC}"
echo -e "${BLUE}Custom Domain: ${DOMAIN}${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Wait for distribution deployment to complete (15-20 minutes)"
echo "2. Configure Route 53 DNS records to point to CloudFront"
echo "3. Test the website at https://${DOMAIN}"
echo "4. Set up automated deployment script"
echo
echo -e "${YELLOW}To check deployment status:${NC}"
echo "aws cloudfront get-distribution --profile $AWS_PROFILE --id $DISTRIBUTION_ID --query 'Distribution.Status'"
echo
echo -e "${YELLOW}To invalidate cache after updates:${NC}"
echo "aws cloudfront create-invalidation --profile $AWS_PROFILE --distribution-id $DISTRIBUTION_ID --paths '/*'"
