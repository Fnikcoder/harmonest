#!/bin/bash

# Create AWS Services for Harmonest Data Storage
# Creates DynamoDB tables and S3 buckets for storing application data

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration file
CONFIG_FILE="$(dirname "$0")/aws_config.json"

# Extract AWS profile from config
AWS_PROFILE=$(awk '
  /"aws_profile"/ {
    match($0, /"aws_profile"[[:space:]]*:[[:space:]]*"([^"]+)"/, arr)
    if (arr[1]) {
      print arr[1]
      exit
    }
  }
' "$CONFIG_FILE")

if [ -z "$AWS_PROFILE" ]; then
  echo -e "${RED}❌ Could not find aws_profile in $CONFIG_FILE${NC}"
  exit 1
fi

echo -e "${BLUE}🚀 Harmonest AWS Services Setup${NC}"
echo "=================================="

# Ask for environment
read -p "Create services for [dev/prod]? " ENV

# Validate environment
if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
  echo -e "${RED}❌ Invalid environment: choose 'dev' or 'prod'${NC}"
  exit 1
fi

# Extract region from aws_config.json
REGION=$(awk '
  /"region"/ {
    match($0, /"region"[[:space:]]*:[[:space:]]*"([^"]+)"/, arr)
    if (arr[1]) {
      print arr[1]
      exit
    }
  }
' "$CONFIG_FILE")

if [ -z "$REGION" ]; then
  echo -e "${RED}❌ Could not find region in $CONFIG_FILE${NC}"
  exit 1
fi

echo -e "${BLUE}📍 Using region: $REGION${NC}"
echo -e "${BLUE}🔧 Using profile: $AWS_PROFILE${NC}"
echo -e "${BLUE}🌍 Environment: $ENV${NC}"
echo ""

# Test AWS credentials
echo -e "${YELLOW}🔍 Testing AWS credentials...${NC}"
if ! aws sts get-caller-identity --profile $AWS_PROFILE >/dev/null 2>&1; then
  echo -e "${RED}❌ AWS credentials test failed. Please check your profile configuration.${NC}"
  exit 1
fi
echo -e "${GREEN}✅ AWS credentials verified${NC}"
echo ""

# Define resource names based on environment
if [ "$ENV" == "prod" ]; then
  TABLE_PREFIX="harmonest"
  BUCKET_PREFIX="harmonest"
else
  TABLE_PREFIX="harmonest-dev"
  BUCKET_PREFIX="harmonest-dev"
fi

# DynamoDB Table Names
MAIN_TABLE="${TABLE_PREFIX}-main"
USER_MEDIA_BUCKET="${BUCKET_PREFIX}-user-media"
PROPERTY_MEDIA_BUCKET="${BUCKET_PREFIX}-property-media"
DOCUMENTS_BUCKET="${BUCKET_PREFIX}-documents"

echo -e "${BLUE}📋 Resources to be created:${NC}"
echo "  • DynamoDB Table: $MAIN_TABLE"
echo "  • S3 Bucket: $USER_MEDIA_BUCKET"
echo "  • S3 Bucket: $PROPERTY_MEDIA_BUCKET"
echo "  • S3 Bucket: $DOCUMENTS_BUCKET"
echo ""

read -p "Continue with creation? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}⚠️ Operation cancelled${NC}"
  exit 0
fi

echo ""
echo -e "${BLUE}🗄️ Creating DynamoDB Table...${NC}"

# Create main DynamoDB table with GSIs
echo -e "${YELLOW}📝 Creating table: $MAIN_TABLE${NC}"

# Create DynamoDB table using JSON configuration for better parameter handling
# Use current directory for temporary file to ensure cross-platform compatibility
cat > ./dynamodb-table-config.json << EOF
{
  "TableName": "$MAIN_TABLE",
  "AttributeDefinitions": [
    {"AttributeName": "PK", "AttributeType": "S"},
    {"AttributeName": "SK", "AttributeType": "S"},
    {"AttributeName": "GSI1PK", "AttributeType": "S"},
    {"AttributeName": "GSI1SK", "AttributeType": "S"},
    {"AttributeName": "GSI2PK", "AttributeType": "S"},
    {"AttributeName": "GSI2SK", "AttributeType": "S"},
    {"AttributeName": "GSI3PK", "AttributeType": "S"},
    {"AttributeName": "GSI3SK", "AttributeType": "S"},
    {"AttributeName": "GSI4PK", "AttributeType": "S"},
    {"AttributeName": "GSI4SK", "AttributeType": "S"}
  ],
  "KeySchema": [
    {"AttributeName": "PK", "KeyType": "HASH"},
    {"AttributeName": "SK", "KeyType": "RANGE"}
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "GSI1",
      "KeySchema": [
        {"AttributeName": "GSI1PK", "KeyType": "HASH"},
        {"AttributeName": "GSI1SK", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    },
    {
      "IndexName": "GSI2",
      "KeySchema": [
        {"AttributeName": "GSI2PK", "KeyType": "HASH"},
        {"AttributeName": "GSI2SK", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    },
    {
      "IndexName": "GSI3",
      "KeySchema": [
        {"AttributeName": "GSI3PK", "KeyType": "HASH"},
        {"AttributeName": "GSI3SK", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    },
    {
      "IndexName": "GSI4",
      "KeySchema": [
        {"AttributeName": "GSI4PK", "KeyType": "HASH"},
        {"AttributeName": "GSI4SK", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
      }
    }
  ],
  "ProvisionedThroughput": {
    "ReadCapacityUnits": 10,
    "WriteCapacityUnits": 10
  }
}
EOF

aws dynamodb create-table \
  --cli-input-json file://./dynamodb-table-config.json \
  --region "$REGION" \
  --profile $AWS_PROFILE

# Clean up temporary file
rm -f ./dynamodb-table-config.json

echo -e "${YELLOW}⏳ Waiting for table to become active...${NC}"
aws dynamodb wait table-exists --table-name "$MAIN_TABLE" --region "$REGION" --profile $AWS_PROFILE

echo -e "${GREEN}✅ DynamoDB table created successfully${NC}"
echo ""

echo -e "${BLUE}🪣 Creating S3 Buckets...${NC}"
#
## Function to create S3 bucket
#create_s3_bucket() {
#  local bucket_name=$1
#  local bucket_purpose=$2
#
#  echo -e "${YELLOW}📦 Creating bucket: $bucket_name ($bucket_purpose)${NC}"
#
#  # Create bucket
#  if [ "$REGION" == "us-east-1" ]; then
#    aws s3api create-bucket \
#      --bucket "$bucket_name" \
#      --region "$REGION" \
#      --profile $AWS_PROFILE 2>/dev/null || echo "Bucket may already exist"
#  else
#    aws s3api create-bucket \
#      --bucket "$bucket_name" \
#      --region "$REGION" \
#      --create-bucket-configuration LocationConstraint="$REGION" \
#      --profile $AWS_PROFILE 2>/dev/null || echo "Bucket may already exist"
#  fi
#
#  # Enable versioning
#  aws s3api put-bucket-versioning \
#    --bucket "$bucket_name" \
#    --versioning-configuration Status=Enabled \
#    --profile $AWS_PROFILE
#
#  # Set up CORS for media buckets
#  if [[ "$bucket_name" == *"media"* ]]; then
#    aws s3api put-bucket-cors \
#      --bucket "$bucket_name" \
#      --cors-configuration '{
#        "CORSRules": [{
#          "AllowedHeaders": ["*"],
#          "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
#          "AllowedOrigins": ["*"],
#          "ExposeHeaders": ["ETag"],
#          "MaxAgeSeconds": 3000
#        }]
#      }' \
#      --profile $AWS_PROFILE
#  fi
#
#  # Set up lifecycle policy for cost optimization
#  aws s3api put-bucket-lifecycle-configuration \
#    --bucket "$bucket_name" \
#    --lifecycle-configuration '{
#      "Rules": [{
#        "ID": "OptimizeStorage",
#        "Status": "Enabled",
#        "Filter": {"Prefix": ""},
#        "Transitions": [{
#          "Days": 30,
#          "StorageClass": "STANDARD_IA"
#        }, {
#          "Days": 90,
#          "StorageClass": "GLACIER"
#        }],
#        "AbortIncompleteMultipartUpload": {
#          "DaysAfterInitiation": 7
#        }
#      }]
#    }' \
#    --profile $AWS_PROFILE
#
#  echo -e "${GREEN}✅ Bucket $bucket_name created and configured${NC}"
#}
#
## Create S3 buckets
#create_s3_bucket "$USER_MEDIA_BUCKET" "User avatars and documents"
#create_s3_bucket "$PROPERTY_MEDIA_BUCKET" "Property images and videos"
#create_s3_bucket "$DOCUMENTS_BUCKET" "Booking documents and receipts"
#
#echo ""
#echo -e "${GREEN}🎉 All AWS services created successfully!${NC}"
#echo ""
#echo -e "${BLUE}📋 Summary:${NC}"
#echo "  • DynamoDB Table: $MAIN_TABLE"
#echo "  • S3 Buckets:"
#echo "    - $USER_MEDIA_BUCKET"
#echo "    - $PROPERTY_MEDIA_BUCKET"
#echo "    - $DOCUMENTS_BUCKET"
#echo ""
#echo -e "${BLUE}🔗 Useful commands:${NC}"
#echo "  • List DynamoDB tables: aws dynamodb list-tables --profile $AWS_PROFILE"
#echo "  • List S3 buckets: aws s3 ls --profile $AWS_PROFILE"
#echo "  • View table details: aws dynamodb describe-table --table-name $MAIN_TABLE --profile $AWS_PROFILE"
#echo ""
#echo -e "${YELLOW}💡 Next steps:${NC}"
#echo "  • Update your application configuration with the new resource names"
#echo "  • Configure IAM policies for your application to access these resources"
#echo "  • Set up monitoring and alerts for the resources"
