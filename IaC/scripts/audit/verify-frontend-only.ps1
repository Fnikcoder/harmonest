# Frontend-Only Verification Script
# This script verifies that only frontend resources remain after backend deletion

param(
    [string]$Environment = "dev",
    [string]$Profile = "harmonestadmin",
    [string]$Region = "eu-central-1"
)

Write-Host "✅ Frontend-Only Verification for Harmonest ($Environment)" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green
Write-Host ""

# Check AWS credentials
Write-Host "📋 Checking AWS credentials..." -ForegroundColor Yellow
try {
    $accountInfo = aws sts get-caller-identity --profile $Profile --output json | ConvertFrom-Json
    Write-Host "✅ Account: $($accountInfo.Account)" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to get AWS credentials. Please check your profile configuration." -ForegroundColor Red
    exit 1
}

$allGood = $true

Write-Host ""
Write-Host "🔍 Verifying backend services are deleted..." -ForegroundColor Yellow

# Check CloudFormation Stacks - should be empty
Write-Host ""
Write-Host "📦 CloudFormation Stacks:" -ForegroundColor Yellow
$stacks = aws cloudformation list-stacks --profile $Profile --region $Region --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query "StackSummaries[?contains(StackName, 'Harmonest-$Environment')].{Name:StackName,Status:StackStatus}" --output json | ConvertFrom-Json
if ($stacks -and $stacks.Count -gt 0) {
    Write-Host "❌ Found remaining CloudFormation stacks:" -ForegroundColor Red
    foreach ($stack in $stacks) {
        Write-Host "   - $($stack.Name) ($($stack.Status))" -ForegroundColor Red
    }
    $allGood = $false
} else {
    Write-Host "✅ No backend CloudFormation stacks found" -ForegroundColor Green
}

# Check DynamoDB Tables - should be empty
Write-Host ""
Write-Host "📊 DynamoDB Tables:" -ForegroundColor Yellow
$dynamoTables = aws dynamodb list-tables --profile $Profile --region $Region --query "TableNames[?contains(@, 'harmonest')]" --output json | ConvertFrom-Json
if ($dynamoTables -and $dynamoTables.Count -gt 0) {
    Write-Host "❌ Found remaining DynamoDB tables:" -ForegroundColor Red
    foreach ($table in $dynamoTables) {
        Write-Host "   - $table" -ForegroundColor Red
    }
    $allGood = $false
} else {
    Write-Host "✅ No DynamoDB tables found" -ForegroundColor Green
}

# Check Cognito User Pools - should be empty
Write-Host ""
Write-Host "🔐 Cognito User Pools:" -ForegroundColor Yellow
$userPools = aws cognito-idp list-user-pools --max-items 50 --profile $Profile --region $Region --query "UserPools[?contains(Name, 'harmonest')]" --output json | ConvertFrom-Json
if ($userPools -and $userPools.Count -gt 0) {
    Write-Host "❌ Found remaining Cognito User Pools:" -ForegroundColor Red
    foreach ($pool in $userPools) {
        Write-Host "   - $($pool.Name) ($($pool.Id))" -ForegroundColor Red
    }
    $allGood = $false
} else {
    Write-Host "✅ No Cognito User Pools found" -ForegroundColor Green
}

# Check API Gateway APIs - should be empty
Write-Host ""
Write-Host "🌐 API Gateway APIs:" -ForegroundColor Yellow
$apis = aws apigateway get-rest-apis --profile $Profile --region $Region --query "items[?contains(name, 'harmonest')].{Name:name,Id:id}" --output json | ConvertFrom-Json
if ($apis -and $apis.Count -gt 0) {
    Write-Host "❌ Found remaining API Gateway APIs:" -ForegroundColor Red
    foreach ($api in $apis) {
        Write-Host "   - $($api.Name) ($($api.Id))" -ForegroundColor Red
    }
    $allGood = $false
} else {
    Write-Host "✅ No API Gateway APIs found" -ForegroundColor Green
}

# Check Lambda Functions - should be empty
Write-Host ""
Write-Host "⚡ Lambda Functions:" -ForegroundColor Yellow
$lambdas = aws lambda list-functions --profile $Profile --region $Region --query "Functions[?contains(FunctionName, 'harmonest')].{Name:FunctionName,Runtime:Runtime}" --output json | ConvertFrom-Json
if ($lambdas -and $lambdas.Count -gt 0) {
    Write-Host "❌ Found remaining Lambda functions:" -ForegroundColor Red
    foreach ($lambda in $lambdas) {
        Write-Host "   - $($lambda.Name) ($($lambda.Runtime))" -ForegroundColor Red
    }
    $allGood = $false
} else {
    Write-Host "✅ No Lambda functions found" -ForegroundColor Green
}

# Check SQS Queues - should be empty
Write-Host ""
Write-Host "📬 SQS Queues:" -ForegroundColor Yellow
$queues = aws sqs list-queues --profile $Profile --region $Region --queue-name-prefix harmonest --output json 2>$null | ConvertFrom-Json
if ($queues -and $queues.QueueUrls -and $queues.QueueUrls.Count -gt 0) {
    Write-Host "❌ Found remaining SQS queues:" -ForegroundColor Red
    foreach ($queue in $queues.QueueUrls) {
        Write-Host "   - $queue" -ForegroundColor Red
    }
    $allGood = $false
} else {
    Write-Host "✅ No SQS queues found" -ForegroundColor Green
}

# Check SNS Topics - should be empty
Write-Host ""
Write-Host "📢 SNS Topics:" -ForegroundColor Yellow
$topics = aws sns list-topics --profile $Profile --region $Region --query "Topics[?contains(TopicArn, 'harmonest')]" --output json | ConvertFrom-Json
if ($topics -and $topics.Count -gt 0) {
    Write-Host "❌ Found remaining SNS topics:" -ForegroundColor Red
    foreach ($topic in $topics) {
        Write-Host "   - $($topic.TopicArn)" -ForegroundColor Red
    }
    $allGood = $false
} else {
    Write-Host "✅ No SNS topics found" -ForegroundColor Green
}

Write-Host ""
Write-Host "🌐 Verifying frontend resources are preserved..." -ForegroundColor Green

# Check Frontend S3 Buckets - should exist
Write-Host ""
Write-Host "🪣 Frontend S3 Buckets:" -ForegroundColor Yellow
$frontendBuckets = @("harmonest.de", "dev.harmonest.de")
foreach ($bucket in $frontendBuckets) {
    $exists = aws s3 ls s3://$bucket --profile $Profile 2>$null
    if ($exists) {
        Write-Host "✅ Frontend bucket exists: $bucket" -ForegroundColor Green
        # Get bucket size
        $size = aws s3 ls s3://$bucket --recursive --summarize --profile $Profile | Select-String "Total Size"
        if ($size) {
            Write-Host "   📊 $size" -ForegroundColor Cyan
        }
    } else {
        Write-Host "⚠️  Frontend bucket not found: $bucket" -ForegroundColor Yellow
        Write-Host "   This may be expected if the bucket was never created" -ForegroundColor Gray
    }
}

# Check Backend Storage Buckets - should be deleted
Write-Host ""
Write-Host "🗑️  Backend Storage Buckets (should be deleted):" -ForegroundColor Yellow
$backendBuckets = @("harmonest-$Environment-storage", "harmonest-dev-storage", "harmonest-prod-storage")
foreach ($bucket in $backendBuckets) {
    $exists = aws s3 ls s3://$bucket --profile $Profile 2>$null
    if ($exists) {
        Write-Host "❌ Backend storage bucket still exists: $bucket" -ForegroundColor Red
        $allGood = $false
    } else {
        Write-Host "✅ Backend storage bucket deleted: $bucket" -ForegroundColor Green
    }
}

# Check CloudFront Distributions - should exist for frontend
Write-Host ""
Write-Host "🌍 CloudFront Distributions:" -ForegroundColor Yellow
$distributions = aws cloudfront list-distributions --profile $Profile --query "DistributionList.Items[?contains(Comment, 'harmonest') || contains(Comment, 'Harmonest')].{Id:Id,DomainName:DomainName,Comment:Comment,Status:Status}" --output json | ConvertFrom-Json
if ($distributions -and $distributions.Count -gt 0) {
    Write-Host "✅ CloudFront distributions found (frontend preserved):" -ForegroundColor Green
    foreach ($dist in $distributions) {
        Write-Host "   - $($dist.Id): $($dist.DomainName) ($($dist.Status))" -ForegroundColor Green
        Write-Host "     Comment: $($dist.Comment)" -ForegroundColor Cyan
    }
} else {
    Write-Host "⚠️  No CloudFront distributions found" -ForegroundColor Yellow
    Write-Host "   This may be expected if CloudFront was never set up" -ForegroundColor Gray
}

Write-Host ""
Write-Host "📋 VERIFICATION SUMMARY:" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan

if ($allGood) {
    Write-Host "🎉 SUCCESS: Backend deletion completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "✅ All backend services have been removed:" -ForegroundColor Green
    Write-Host "   - CloudFormation stacks deleted" -ForegroundColor Green
    Write-Host "   - DynamoDB tables deleted" -ForegroundColor Green
    Write-Host "   - Cognito User Pools deleted" -ForegroundColor Green
    Write-Host "   - API Gateway APIs deleted" -ForegroundColor Green
    Write-Host "   - Lambda functions deleted" -ForegroundColor Green
    Write-Host "   - SQS queues deleted" -ForegroundColor Green
    Write-Host "   - SNS topics deleted" -ForegroundColor Green
    Write-Host "   - Backend storage buckets deleted" -ForegroundColor Green
    Write-Host ""
    Write-Host "✅ Frontend resources preserved:" -ForegroundColor Green
    Write-Host "   - Frontend S3 buckets (if they existed)" -ForegroundColor Green
    Write-Host "   - CloudFront distributions (if they existed)" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Your frontend should still be accessible!" -ForegroundColor Cyan
} else {
    Write-Host "⚠️  WARNING: Some backend resources may still exist!" -ForegroundColor Yellow
    Write-Host "   Please review the items marked with ❌ above" -ForegroundColor Yellow
    Write-Host "   You may need to manually delete these resources" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🔍 Verification completed." -ForegroundColor Cyan
