#!/bin/bash

# Create Production CloudFront Distribution for harmonest.de
# This script creates CloudFront distribution for production

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
ENVIRONMENT="prod"
BUCKET_NAME="harmonest.de"
DOMAIN="harmonest.de"
CERT_ARN="arn:aws:acm:us-east-1:669597026882:certificate/95795cc3-cb98-4fd7-a862-1f0682fe3520"

echo -e "${BLUE}=== Creating Production CloudFront Distribution ===${NC}"
echo -e "${BLUE}Domain: ${DOMAIN}${NC}"
echo -e "${BLUE}Bucket: ${BUCKET_NAME}${NC}"
echo -e "${BLUE}Certificate: ${CERT_ARN}${NC}"
echo

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text)
echo -e "${BLUE}AWS Account ID: ${ACCOUNT_ID}${NC}"

# Verify certificate exists
echo -e "${YELLOW}Verifying SSL certificate...${NC}"
if aws acm describe-certificate --profile $AWS_PROFILE --certificate-arn $CERT_ARN --region $CERT_REGION >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Certificate verified!${NC}"
else
    echo -e "${RED}❌ Certificate not found.${NC}"
    exit 1
fi

# Get S3 website endpoint
WEBSITE_ENDPOINT="${BUCKET_NAME}.s3-website.${AWS_REGION}.amazonaws.com"

# Create CloudFront distribution configuration
echo -e "${YELLOW}Creating CloudFront distribution...${NC}"

cat > cloudfront-config.json << EOF
{
    "CallerReference": "$(date +%s)",
    "Aliases": {
        "Quantity": 1,
        "Items": [
            "${DOMAIN}"
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
                        "Quantity": 1,
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
echo -e "${YELLOW}Creating CloudFront distribution (this may take a few minutes)...${NC}"

DISTRIBUTION_OUTPUT=$(aws cloudfront create-distribution \
    --profile $AWS_PROFILE \
    --distribution-config file://cloudfront-config.json \
    --output json)

DISTRIBUTION_ID=$(echo $DISTRIBUTION_OUTPUT | jq -r '.Distribution.Id')
DISTRIBUTION_DOMAIN=$(echo $DISTRIBUTION_OUTPUT | jq -r '.Distribution.DomainName')

echo -e "${GREEN}✅ CloudFront distribution created successfully!${NC}"
echo -e "${BLUE}Distribution ID: ${DISTRIBUTION_ID}${NC}"
echo -e "${BLUE}Distribution Domain: ${DISTRIBUTION_DOMAIN}${NC}"

# Update aws_config.json with the new distribution ID
echo -e "${YELLOW}Updating aws_config.json...${NC}"
CONFIG_FILE="$(dirname "$0")/aws_config.json"

if [ -f "$CONFIG_FILE" ]; then
    # Create a backup
    cp "$CONFIG_FILE" "${CONFIG_FILE}.backup"

    # Update the distribution ID using sed (since jq might not be available)
    sed -i.tmp "s/\"cloudfront_distribution_id\": \"\"/\"cloudfront_distribution_id\": \"$DISTRIBUTION_ID\"/" "$CONFIG_FILE"
    rm -f "${CONFIG_FILE}.tmp"
    echo -e "${GREEN}✅ Updated aws_config.json with distribution ID${NC}"
else
    echo -e "${YELLOW}⚠️  aws_config.json not found${NC}"
fi

# Clean up temporary files
rm -f cloudfront-config.json

echo
echo -e "${GREEN}=== CloudFront Distribution Created Successfully ===${NC}"
echo -e "${BLUE}Distribution ID: ${DISTRIBUTION_ID}${NC}"
echo -e "${BLUE}Distribution Domain: ${DISTRIBUTION_DOMAIN}${NC}"
echo -e "${BLUE}Custom Domain: https://${DOMAIN}${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Wait for distribution deployment (15-20 minutes)"
echo "2. Configure DNS records to point to CloudFront"
echo "3. Re-run deployment script to enable cache invalidation"
echo "4. Test at https://${DOMAIN}"
echo
echo -e "${YELLOW}To check deployment status:${NC}"
echo "aws cloudfront get-distribution --profile $AWS_PROFILE --id $DISTRIBUTION_ID --query 'Distribution.Status'"
echo
echo -e "${YELLOW}DNS Configuration:${NC}"
echo "Create CNAME records:"
echo "  ${DOMAIN} → ${DISTRIBUTION_DOMAIN}"
echo "  www.${DOMAIN} → ${DISTRIBUTION_DOMAIN}"
echo
echo -e "${GREEN}Production CloudFront distribution is being deployed! 🚀${NC}"
