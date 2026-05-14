#!/bin/bash
echo "🔍 AWS Services Audit for Harmonest"
echo "=================================="

AWS_PROFILE="harmonestadmin"
REGION="eu-central-1"

echo "📋 Account: $(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text)"
echo "🌍 Region: $REGION"
echo ""

echo "📊 DynamoDB Tables:"
aws dynamodb list-tables --profile $AWS_PROFILE --region $REGION --query 'TableNames[?contains(@, `harmonest`)]' --output table

echo "🪣 S3 Buckets:"
aws s3 ls --profile $AWS_PROFILE | grep harmonest

echo "🔐 Cognito User Pools:"
aws cognito-idp list-user-pools --max-items 50 --profile $AWS_PROFILE --region $REGION --query 'UserPools[?contains(Name, `harmonest`)].Name' --output table

echo "☁️ CloudFront Distributions:"
aws cloudfront list-distributions --profile $AWS_PROFILE --query 'DistributionList.Items[?contains(Comment, `harmonest`) || contains(Comment, `Harmonest`)].Id' --output table