# AWS Backend Services Deletion Script
# This script safely deletes all backend services while preserving frontend infrastructure

param(
    [string]$Environment = "dev",
    [string]$Profile = "harmonestadmin",
    [string]$Region = "eu-central-1",
    [switch]$Force = $false
)

Write-Host "🗑️  AWS Backend Services Deletion for Harmonest ($Environment)" -ForegroundColor Red
Write-Host "=============================================================" -ForegroundColor Red
Write-Host ""

if (-not $Force) {
    Write-Host "⚠️  WARNING: This will permanently delete all backend services!" -ForegroundColor Yellow
    Write-Host "   - All user data in DynamoDB" -ForegroundColor Yellow
    Write-Host "   - All user accounts in Cognito" -ForegroundColor Yellow
    Write-Host "   - All API endpoints and Lambda functions" -ForegroundColor Yellow
    Write-Host "   - All messaging queues and topics" -ForegroundColor Yellow
    Write-Host "   - All backend storage in S3" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "✅ Frontend resources will be preserved:" -ForegroundColor Green
    Write-Host "   - S3 buckets: harmonest.de, dev.harmonest.de" -ForegroundColor Green
    Write-Host "   - CloudFront distributions" -ForegroundColor Green
    Write-Host ""
    
    $confirmation = Read-Host "Type 'DELETE-BACKEND' to confirm deletion"
    if ($confirmation -ne "DELETE-BACKEND") {
        Write-Host "❌ Deletion cancelled." -ForegroundColor Red
        exit 1
    }
}

# Check AWS credentials
Write-Host "📋 Checking AWS credentials..." -ForegroundColor Yellow
try {
    $accountInfo = aws sts get-caller-identity --profile $Profile --output json | ConvertFrom-Json
    Write-Host "✅ Account: $($accountInfo.Account)" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to get AWS credentials. Please check your profile configuration." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🚀 Starting backend services deletion..." -ForegroundColor Cyan

# Function to safely delete CloudFormation stack
function Delete-Stack {
    param($StackName)
    
    Write-Host "🗑️  Deleting stack: $StackName" -ForegroundColor Yellow
    
    # Check if stack exists
    $stackExists = aws cloudformation describe-stacks --profile $Profile --region $Region --stack-name $StackName 2>$null
    if (-not $stackExists) {
        Write-Host "   ⚠️  Stack $StackName does not exist, skipping..." -ForegroundColor Gray
        return
    }
    
    try {
        # Delete the stack
        aws cloudformation delete-stack --profile $Profile --region $Region --stack-name $StackName
        Write-Host "   🔄 Deletion initiated for $StackName" -ForegroundColor Cyan
        
        # Wait for deletion to complete
        Write-Host "   ⏳ Waiting for stack deletion to complete..." -ForegroundColor Cyan
        aws cloudformation wait stack-delete-complete --profile $Profile --region $Region --stack-name $StackName
        Write-Host "   ✅ Stack $StackName deleted successfully" -ForegroundColor Green
        
    } catch {
        Write-Host "   ❌ Failed to delete stack $StackName" -ForegroundColor Red
        Write-Host "   Error: $_" -ForegroundColor Red
    }
}

# Delete stacks in reverse dependency order
Write-Host ""
Write-Host "📦 Deleting CloudFormation stacks..." -ForegroundColor Yellow

# 1. Delete CDN Stack (but preserve CloudFront for frontend)
Write-Host ""
Write-Host "⚠️  Skipping CDN stack deletion to preserve frontend CloudFront..." -ForegroundColor Yellow

# 2. Delete API Stack
Delete-Stack "Harmonest-$Environment-Api"

# 3. Delete Messaging Stack  
Delete-Stack "Harmonest-$Environment-Messaging"

# 4. Delete Storage Stack
Delete-Stack "Harmonest-$Environment-Storage"

# 5. Delete Auth Stack
Delete-Stack "Harmonest-$Environment-Auth"

Write-Host ""
Write-Host "🧹 Cleaning up any remaining resources..." -ForegroundColor Yellow

# Clean up any orphaned Lambda functions
Write-Host ""
Write-Host "⚡ Checking for orphaned Lambda functions..." -ForegroundColor Yellow
$lambdas = aws lambda list-functions --profile $Profile --region $Region --query "Functions[?contains(FunctionName, 'harmonest-$Environment')].FunctionName" --output text
if ($lambdas) {
    $lambdaList = $lambdas -split "`t"
    foreach ($lambda in $lambdaList) {
        if ($lambda.Trim()) {
            Write-Host "   🗑️  Deleting Lambda function: $lambda" -ForegroundColor Yellow
            try {
                aws lambda delete-function --profile $Profile --region $Region --function-name $lambda
                Write-Host "   ✅ Deleted Lambda function: $lambda" -ForegroundColor Green
            } catch {
                Write-Host "   ❌ Failed to delete Lambda function: $lambda" -ForegroundColor Red
            }
        }
    }
} else {
    Write-Host "   ✅ No orphaned Lambda functions found" -ForegroundColor Green
}

# Clean up any orphaned API Gateway APIs
Write-Host ""
Write-Host "🌐 Checking for orphaned API Gateway APIs..." -ForegroundColor Yellow
$apis = aws apigateway get-rest-apis --profile $Profile --region $Region --query "items[?contains(name, 'harmonest-$Environment')].id" --output text
if ($apis) {
    $apiList = $apis -split "`t"
    foreach ($apiId in $apiList) {
        if ($apiId.Trim()) {
            Write-Host "   🗑️  Deleting API Gateway: $apiId" -ForegroundColor Yellow
            try {
                aws apigateway delete-rest-api --profile $Profile --region $Region --rest-api-id $apiId
                Write-Host "   ✅ Deleted API Gateway: $apiId" -ForegroundColor Green
            } catch {
                Write-Host "   ❌ Failed to delete API Gateway: $apiId" -ForegroundColor Red
            }
        }
    }
} else {
    Write-Host "   ✅ No orphaned API Gateway APIs found" -ForegroundColor Green
}

# Clean up backend S3 storage buckets (NOT frontend buckets)
Write-Host ""
Write-Host "🪣 Cleaning up backend S3 storage buckets..." -ForegroundColor Yellow
$backendBuckets = @("harmonest-$Environment-storage")

foreach ($bucketName in $backendBuckets) {
    $bucketExists = aws s3 ls s3://$bucketName --profile $Profile 2>$null
    if ($bucketExists) {
        Write-Host "   🗑️  Deleting backend storage bucket: $bucketName" -ForegroundColor Yellow
        try {
            # Empty the bucket first
            aws s3 rm s3://$bucketName --recursive --profile $Profile
            # Delete the bucket
            aws s3 rb s3://$bucketName --profile $Profile
            Write-Host "   ✅ Deleted backend storage bucket: $bucketName" -ForegroundColor Green
        } catch {
            Write-Host "   ❌ Failed to delete backend storage bucket: $bucketName" -ForegroundColor Red
        }
    } else {
        Write-Host "   ⚠️  Backend storage bucket $bucketName does not exist" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "✅ FRONTEND PRESERVATION CHECK:" -ForegroundColor Green
Write-Host "===============================" -ForegroundColor Green

# Verify frontend buckets are still intact
$frontendBuckets = @("harmonest.de", "dev.harmonest.de")
foreach ($bucket in $frontendBuckets) {
    $exists = aws s3 ls s3://$bucket --profile $Profile 2>$null
    if ($exists) {
        Write-Host "✅ Frontend bucket preserved: $bucket" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Frontend bucket not found: $bucket" -ForegroundColor Yellow
    }
}

# Verify CloudFront distributions are still intact
Write-Host ""
Write-Host "🌍 Checking CloudFront distributions..." -ForegroundColor Yellow
$distributions = aws cloudfront list-distributions --profile $Profile --query "DistributionList.Items[?contains(Comment, 'harmonest') || contains(Comment, 'Harmonest')].{Id:Id,Status:Status}" --output table
if ($distributions) {
    Write-Host "✅ CloudFront distributions preserved:" -ForegroundColor Green
    Write-Host $distributions
} else {
    Write-Host "⚠️  No CloudFront distributions found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Backend deletion completed!" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Green
Write-Host "✅ All backend services have been deleted" -ForegroundColor Green
Write-Host "✅ Frontend infrastructure has been preserved" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Summary:" -ForegroundColor Cyan
Write-Host "   🗑️  Deleted: DynamoDB, Cognito, Lambda, API Gateway, SQS, SNS, backend S3" -ForegroundColor Red
Write-Host "   ✅ Preserved: Frontend S3 buckets, CloudFront distributions" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Your frontend should still be accessible at:" -ForegroundColor Cyan
Write-Host "   - Production: https://harmonest.de" -ForegroundColor Cyan
Write-Host "   - Development: https://dev.harmonest.de" -ForegroundColor Cyan
