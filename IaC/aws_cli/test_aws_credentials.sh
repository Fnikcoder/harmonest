#!/bin/bash

# Test AWS Profile Configuration
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

echo "🔍 Testing AWS profile: $AWS_PROFILE"
echo "=================================="

# Test 1: Check if profile exists
echo "1️⃣ Checking if profile exists..."
aws configure list --profile $AWS_PROFILE

if [ $? -ne 0 ]; then
    echo "❌ Profile '$AWS_PROFILE' not found!"
    echo "💡 Run: aws configure --profile $AWS_PROFILE"
    exit 1
fi

echo "✅ Profile found!"
echo ""

# Test 2: Test credentials
echo "2️⃣ Testing credentials..."
IDENTITY=$(aws sts get-caller-identity --profile $AWS_PROFILE 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "❌ Invalid credentials for profile '$AWS_PROFILE'"
    echo "💡 Check your access keys with: aws configure --profile $AWS_PROFILE"
    exit 1
fi

echo "✅ Credentials valid!"
echo "User: $(echo $IDENTITY | jq -r '.Arn // "Unknown"')"
echo "Account: $(echo $IDENTITY | jq -r '.Account // "Unknown"')"
echo ""

# Test 3: Test S3 access
echo "3️⃣ Testing S3 access..."
aws s3 ls --profile $AWS_PROFILE >/dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "❌ No S3 access with profile '$AWS_PROFILE'"
    echo "💡 Check IAM permissions for S3"
    exit 1
fi

echo "✅ S3 access confirmed!"
echo ""

# Test 4: Test specific bucket access
echo "4️⃣ Testing bucket access..."
BUCKET_NAME="dev.harmonest.de"
aws s3 ls s3://$BUCKET_NAME --profile $AWS_PROFILE >/dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "⚠️ Cannot access bucket '$BUCKET_NAME' (may not exist yet)"
else
    echo "✅ Bucket '$BUCKET_NAME' accessible!"
fi
echo ""

# Test 5: Test CloudFront access
echo "5️⃣ Testing CloudFront access..."
aws cloudfront list-distributions --profile $AWS_PROFILE >/dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "⚠️ No CloudFront access (may not have permissions)"
else
    echo "✅ CloudFront access confirmed!"
fi
echo ""

echo "🎉 All tests passed! Your AWS profile '$AWS_PROFILE' is ready for deployment."
echo ""
echo "🚀 You can now run the deployment script:"
echo "   ./deploy_s3_angular.sh"
