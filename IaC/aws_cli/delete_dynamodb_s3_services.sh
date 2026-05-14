#!/bin/bash

# Delete AWS Services for Harmonest Data Storage
# Deletes DynamoDB tables and S3 buckets (with all contents)

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

echo -e "${RED}🗑️ Harmonest AWS Services Deletion${NC}"
echo "===================================="
echo -e "${RED}⚠️ WARNING: This will permanently delete all data!${NC}"
echo ""

# Ask for environment
read -p "Delete services for [dev/prod]? " ENV

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

# Resource Names
MAIN_TABLE="${TABLE_PREFIX}-main"
USER_MEDIA_BUCKET="${BUCKET_PREFIX}-user-media"
PROPERTY_MEDIA_BUCKET="${BUCKET_PREFIX}-property-media"
DOCUMENTS_BUCKET="${BUCKET_PREFIX}-documents"

echo -e "${RED}🗑️ Resources to be DELETED:${NC}"
echo "  • DynamoDB Table: $MAIN_TABLE"
echo "  • S3 Bucket: $USER_MEDIA_BUCKET (and ALL contents)"
echo "  • S3 Bucket: $PROPERTY_MEDIA_BUCKET (and ALL contents)"
echo "  • S3 Bucket: $DOCUMENTS_BUCKET (and ALL contents)"
echo ""
echo -e "${RED}⚠️ THIS ACTION CANNOT BE UNDONE!${NC}"
echo ""

# First confirmation
read -p "Are you absolutely sure you want to delete these resources? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}⚠️ Operation cancelled${NC}"
  exit 0
fi

# Second confirmation for production
if [ "$ENV" == "prod" ]; then
  echo -e "${RED}🚨 PRODUCTION ENVIRONMENT DETECTED!${NC}"
  echo -e "${RED}This will delete ALL production data permanently!${NC}"
  echo ""
  read -p "Type 'DELETE PRODUCTION DATA' to confirm: " confirmation
  if [ "$confirmation" != "DELETE PRODUCTION DATA" ]; then
    echo -e "${YELLOW}⚠️ Operation cancelled - confirmation text did not match${NC}"
    exit 0
  fi
fi

echo ""
echo -e "${RED}🗑️ Starting deletion process...${NC}"

# Function to delete S3 bucket with all contents
delete_s3_bucket() {
  local bucket_name=$1

  echo -e "${YELLOW}🗑️ Deleting bucket: $bucket_name${NC}"

  # Check if bucket exists
  if aws s3api head-bucket --bucket "$bucket_name" --profile $AWS_PROFILE 2>/dev/null; then
    echo -e "${YELLOW}📦 Emptying bucket contents...${NC}"

    # Delete all objects and versions
    aws s3api delete-objects \
      --bucket "$bucket_name" \
      --delete "$(aws s3api list-object-versions \
        --bucket "$bucket_name" \
        --output json \
        --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' \
        --profile $AWS_PROFILE)" \
      --profile $AWS_PROFILE 2>/dev/null || true

    # Delete all delete markers
    aws s3api delete-objects \
      --bucket "$bucket_name" \
      --delete "$(aws s3api list-object-versions \
        --bucket "$bucket_name" \
        --output json \
        --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}' \
        --profile $AWS_PROFILE)" \
      --profile $AWS_PROFILE 2>/dev/null || true

    # Delete the bucket
    aws s3api delete-bucket \
      --bucket "$bucket_name" \
      --profile $AWS_PROFILE

    echo -e "${GREEN}✅ Bucket $bucket_name deleted${NC}"
  else
    echo -e "${YELLOW}⚠️ Bucket $bucket_name does not exist or is not accessible${NC}"
  fi
}

# Delete S3 buckets
echo -e "${BLUE}🪣 Deleting S3 Buckets...${NC}"
delete_s3_bucket "$USER_MEDIA_BUCKET"
delete_s3_bucket "$PROPERTY_MEDIA_BUCKET"
delete_s3_bucket "$DOCUMENTS_BUCKET"

echo ""
echo -e "${BLUE}🗄️ Deleting DynamoDB Table...${NC}"

# Delete DynamoDB table
echo -e "${YELLOW}🗑️ Deleting table: $MAIN_TABLE${NC}"

if aws dynamodb describe-table --table-name "$MAIN_TABLE" --region "$REGION" --profile $AWS_PROFILE >/dev/null 2>&1; then
  aws dynamodb delete-table \
    --table-name "$MAIN_TABLE" \
    --region "$REGION" \
    --profile $AWS_PROFILE

  echo -e "${YELLOW}⏳ Waiting for table deletion to complete...${NC}"
  aws dynamodb wait table-not-exists --table-name "$MAIN_TABLE" --region "$REGION" --profile $AWS_PROFILE

  echo -e "${GREEN}✅ DynamoDB table deleted successfully${NC}"
else
  echo -e "${YELLOW}⚠️ Table $MAIN_TABLE does not exist or is not accessible${NC}"
fi

echo ""
echo -e "${GREEN}🎉 All AWS services deleted successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Deleted resources:${NC}"
echo "  • DynamoDB Table: $MAIN_TABLE"
echo "  • S3 Buckets:"
echo "    - $USER_MEDIA_BUCKET"
echo "    - $PROPERTY_MEDIA_BUCKET"
echo "    - $DOCUMENTS_BUCKET"
echo ""
echo -e "${YELLOW}💡 Note:${NC}"
echo "  • All data has been permanently deleted"
echo "  • You can recreate the services using create_aws_services.sh"
echo "  • Remember to update your application configuration"
