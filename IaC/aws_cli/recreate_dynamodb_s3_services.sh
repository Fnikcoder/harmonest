#!/bin/bash

# Recreate AWS Services for Harmonest Data Storage
# Deletes existing resources and creates fresh ones

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

echo -e "${BLUE}🔄 Harmonest AWS Services Recreation${NC}"
echo "====================================="
echo -e "${YELLOW}⚠️ This will delete existing resources and create fresh ones${NC}"
echo ""

# Ask for environment
read -p "Recreate services for [dev/prod]? " ENV

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

echo -e "${YELLOW}🔄 Resources to be RECREATED:${NC}"
echo "  • DynamoDB Table: $MAIN_TABLE"
echo "  • S3 Bucket: $USER_MEDIA_BUCKET"
echo "  • S3 Bucket: $PROPERTY_MEDIA_BUCKET"
echo "  • S3 Bucket: $DOCUMENTS_BUCKET"
echo ""
echo -e "${RED}⚠️ ALL EXISTING DATA WILL BE LOST!${NC}"
echo ""

# Confirmation
read -p "Continue with recreation? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}⚠️ Operation cancelled${NC}"
  exit 0
fi

# Additional confirmation for production
if [ "$ENV" == "prod" ]; then
  echo -e "${RED}🚨 PRODUCTION ENVIRONMENT DETECTED!${NC}"
  echo -e "${RED}This will delete ALL production data permanently!${NC}"
  echo ""
  read -p "Type 'RECREATE PRODUCTION' to confirm: " confirmation
  if [ "$confirmation" != "RECREATE PRODUCTION" ]; then
    echo -e "${YELLOW}⚠️ Operation cancelled - confirmation text did not match${NC}"
    exit 0
  fi
fi

echo ""
echo -e "${BLUE}🔄 Starting recreation process...${NC}"

# Get the directory of this script
SCRIPT_DIR="$(dirname "$0")"

# Step 1: Delete existing resources
echo -e "${RED}🗑️ Step 1: Deleting existing resources...${NC}"
echo ""

# Function to delete S3 bucket with all contents (silent version)
delete_s3_bucket_silent() {
  local bucket_name=$1

  # Check if bucket exists
  if aws s3api head-bucket --bucket "$bucket_name" --profile $AWS_PROFILE 2>/dev/null; then
    echo -e "${YELLOW}🗑️ Deleting bucket: $bucket_name${NC}"

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
    echo -e "${YELLOW}⚠️ Bucket $bucket_name does not exist${NC}"
  fi
}

# Delete S3 buckets
delete_s3_bucket_silent "$USER_MEDIA_BUCKET"
delete_s3_bucket_silent "$PROPERTY_MEDIA_BUCKET"
delete_s3_bucket_silent "$DOCUMENTS_BUCKET"

# Delete DynamoDB table
if aws dynamodb describe-table --table-name "$MAIN_TABLE" --region "$REGION" --profile $AWS_PROFILE >/dev/null 2>&1; then
  echo -e "${YELLOW}🗑️ Deleting table: $MAIN_TABLE${NC}"
  aws dynamodb delete-table \
    --table-name "$MAIN_TABLE" \
    --region "$REGION" \
    --profile $AWS_PROFILE

  echo -e "${YELLOW}⏳ Waiting for table deletion...${NC}"
  aws dynamodb wait table-not-exists --table-name "$MAIN_TABLE" --region "$REGION" --profile $AWS_PROFILE
  echo -e "${GREEN}✅ Table deleted${NC}"
else
  echo -e "${YELLOW}⚠️ Table $MAIN_TABLE does not exist${NC}"
fi

echo ""
echo -e "${GREEN}✅ Deletion completed${NC}"

# Step 2: Create fresh resources
echo ""
echo -e "${BLUE}🚀 Step 2: Creating fresh resources...${NC}"
echo ""

# Wait a moment to ensure AWS resources are fully cleaned up
echo -e "${YELLOW}⏳ Waiting for AWS cleanup to complete...${NC}"
sleep 10

# Call the create script with the same environment
echo -e "${BLUE}📞 Calling create_aws_services.sh...${NC}"
echo ""

# Export the environment variable so the create script doesn't ask again
export RECREATE_ENV="$ENV"

# Create a temporary script that auto-answers the environment question
cat > /tmp/auto_create.sh << EOF
#!/bin/bash
echo "$ENV" | "$SCRIPT_DIR/create_aws_services.sh"
EOF

chmod +x /tmp/auto_create.sh
/tmp/auto_create.sh
rm /tmp/auto_create.sh

echo ""
echo -e "${GREEN}🎉 Recreation completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Fresh resources created:${NC}"
echo "  • DynamoDB Table: $MAIN_TABLE"
echo "  • S3 Buckets:"
echo "    - $USER_MEDIA_BUCKET"
echo "    - $PROPERTY_MEDIA_BUCKET"
echo "    - $DOCUMENTS_BUCKET"
echo ""
echo -e "${YELLOW}💡 Next steps:${NC}"
echo "  • All data has been reset - you'll need to repopulate with fresh data"
echo "  • Update your application configuration if needed"
echo "  • Test your application with the fresh resources"
