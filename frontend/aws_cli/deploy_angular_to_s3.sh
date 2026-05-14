#!/bin/bash

# Ask for environment
read -p "Deploy to [prod/dev]? " ENV

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
  echo "❌ Could not find aws_profile in $CONFIG_FILE"
  exit 1
fi

# Validate environment exists in config
if ! grep -q "\"$ENV\"" "$CONFIG_FILE"; then
  echo "❌ Invalid environment: choose 'prod' or 'dev'."
  exit 1
fi

# Extract bucket name from aws_config.json
BUCKET_NAME=$(awk -v env="$ENV" '
  BEGIN {in_env=0}
  {
    if ($0 ~ "\""env"\"[[:space:]]*:[[:space:]]*{") in_env=1
    else if ($0 ~ "}") in_env=0
    if (in_env && /bucket/) {
      match($0, /"bucket"[[:space:]]*:[[:space:]]*"([^"]+)"/, arr)
      if (arr[1]) {
        print arr[1]
        exit
      }
    }
  }
' "$CONFIG_FILE")

# Extract region from aws_config.json (top-level)
REGION=$(awk '
  /"region"/ {
    match($0, /"region"[[:space:]]*:[[:space:]]*"([^"]+)"/, arr)
    if (arr[1]) {
      print arr[1]
      exit
    }
  }
' "$CONFIG_FILE")

# Map environment to Angular build config name
if [ "$ENV" == "prod" ]; then
  CONFIG="production"
elif [ "$ENV" == "dev" ]; then
  CONFIG="development"
else
  echo "❌ Unknown environment $ENV"
  exit 1
fi

echo "Using BUCKET_NAME=$BUCKET_NAME, REGION=$REGION and CONFIG=$CONFIG"

BUILD_DIR="dist/$(ls dist | head -n 1)/browser"

echo "🚧 Building Angular app for $ENV..."
ng build --configuration "$CONFIG"

echo "📦 Creating S3 bucket ($BUCKET_NAME) if it doesn't exist..."
aws s3api create-bucket \
  --bucket "$BUCKET_NAME" \
  --region "$REGION" \
  --create-bucket-configuration LocationConstraint="$REGION" \
  --profile $AWS_PROFILE 2>/dev/null

echo "🌐 Enabling static website hosting..."
aws s3 website s3://"$BUCKET_NAME"/ \
  --index-document index.html \
  --error-document index.html \
  --profile $AWS_PROFILE

echo "📤 Uploading to S3..."
aws s3 sync "$BUILD_DIR" s3://"$BUCKET_NAME"/ --delete --profile $AWS_PROFILE

EXISTS=$(aws s3api get-bucket-policy --bucket "$BUCKET_NAME" --profile $AWS_PROFILE 2>/dev/null)
if [ -z "$EXISTS" ]; then
  echo "🔓 Setting public read policy..."
  aws s3api put-bucket-policy --bucket "$BUCKET_NAME" --profile $AWS_PROFILE --policy '{
    "Version":"2012-10-17",
    "Statement":[{
      "Sid":"PublicReadGetObject",
      "Effect":"Allow",
      "Principal": "*",
      "Action":["s3:GetObject"],
      "Resource":["arn:aws:s3:::'"$BUCKET_NAME"'/*"]
    }]
  }'
else
  echo "🔒 Bucket policy already exists. Skipping."
fi

# Read CloudFront distribution ID from aws_config.json based on environment
CONFIG_FILE="$(dirname "$0")/aws_config.json"
DISTRIBUTION_ID=$(awk -v env="$ENV" '
  BEGIN {in_env=0}
  {
    if ($0 ~ "\""env"\"[[:space:]]*:[[:space:]]*{") in_env=1
    else if ($0 ~ "}") in_env=0
    if (in_env && /cloudfront_distribution_id/) {
      match($0, /"cloudfront_distribution_id"[[:space:]]*:[[:space:]]*"([^"]+)"/, arr)
      if (arr[1]) {
        print arr[1]
        exit
      }
    }
  }
' "$CONFIG_FILE")

if [ -n "$DISTRIBUTION_ID" ]; then
  echo "⚡ Invalidating CloudFront cache for distribution ID $DISTRIBUTION_ID ..."
  INVALIDATION_ID=$(aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*" --query 'Invalidation.Id' --output text --profile $AWS_PROFILE)
  echo "🧹 Invalidation started, ID: $INVALIDATION_ID"
else
  echo "⚠️ No CloudFront distribution ID found for environment '$ENV'. Skipping cache invalidation."
fi

#invalidate the cach based on envirement
echo "✅ Deployment complete!"
echo "🌍 Visit for checking S3 bucket: http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"

# If you have a custom domain for CloudFront in your config:
echo "🌍 Visit your CloudFront distribution: https://$DOMAIN_NAME"
echo "If cloudFront is not created please create it with running create_CloudFront.sh"

