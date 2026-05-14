# AWS Resources Audit Script - Check Before Deletion
# This script audits all AWS resources before deletion to ensure we preserve frontend resources

param(
    [string]$Environment = "dev",
    [string]$Profile = "harmonestadmin",
    [string]$Region = "eu-central-1"
)

Write-Host "🔍 AWS Resources Audit for Harmonest ($Environment)" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Check AWS credentials
Write-Host "📋 Checking AWS credentials..." -ForegroundColor Yellow
try {
    $accountInfo = aws sts get-caller-identity --profile $Profile --output json | ConvertFrom-Json
    Write-Host "✅ Account: $($accountInfo.Account)" -ForegroundColor Green
    Write-Host "✅ User: $($accountInfo.Arn)" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to get AWS credentials. Please check your profile configuration." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🏗️ BACKEND SERVICES (TO BE DELETED):" -ForegroundColor Red
Write-Host "=====================================" -ForegroundColor Red

# Check CloudFormation Stacks
Write-Host ""
Write-Host "📦 CloudFormation Stacks:" -ForegroundColor Yellow
$stackQuery = "StackSummaries[?contains(StackName, 'Harmonest-$Environment')].{Name:StackName,Status:StackStatus}"
$stacks = aws cloudformation list-stacks --profile $Profile --region $Region --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query $stackQuery --output table
if ($stacks) {
    Write-Host $stacks
} else {
    Write-Host "No CloudFormation stacks found" -ForegroundColor Gray
}

# Check DynamoDB Tables
Write-Host ""
Write-Host "📊 DynamoDB Tables:" -ForegroundColor Yellow
$dynamoTables = aws dynamodb list-tables --profile $Profile --region $Region --query "TableNames[?contains(@, 'harmonest')]" --output table
if ($dynamoTables) {
    Write-Host $dynamoTables
    
    # Get item counts for each table
    $tableNames = aws dynamodb list-tables --profile $Profile --region $Region --query "TableNames[?contains(@, 'harmonest')]" --output json | ConvertFrom-Json
    foreach ($tableName in $tableNames) {
        try {
            $itemCount = aws dynamodb scan --profile $Profile --region $Region --table-name $tableName --select COUNT --query "Count" --output text
            Write-Host "  📈 ${tableName}: $itemCount items" -ForegroundColor Cyan
        } catch {
            Write-Host "  ⚠️ Could not get item count for $tableName" -ForegroundColor Yellow
        }
    }
    }
} else {
    Write-Host "No DynamoDB tables found" -ForegroundColor Gray
}

# Check Cognito User Pools
Write-Host ""
Write-Host "🔐 Cognito User Pools:" -ForegroundColor Yellow
$userPools = aws cognito-idp list-user-pools --max-items 50 --profile $Profile --region $Region --query "UserPools[?contains(Name, 'harmonest')].{Name:Name,Id:Id}" --output table
if ($userPools) {
    Write-Host $userPools
    
    # Get user counts
    $poolData = aws cognito-idp list-user-pools --max-items 50 --profile $Profile --region $Region --query "UserPools[?contains(Name, 'harmonest')]" --output json | ConvertFrom-Json
    foreach ($pool in $poolData) {
        try {
            $userCount = aws cognito-idp list-users --profile $Profile --region $Region --user-pool-id $pool.Id --query "length(Users)" --output text
            Write-Host "  👥 $($pool.Name): $userCount users" -ForegroundColor Cyan
        } catch {
            Write-Host "  ⚠️ Could not get user count for $($pool.Name)" -ForegroundColor Yellow
        }
    }
    }
} else {
    Write-Host "No Cognito User Pools found" -ForegroundColor Gray
}

# Check API Gateway APIs
Write-Host ""
Write-Host "🌐 API Gateway APIs:" -ForegroundColor Yellow
$apis = aws apigateway get-rest-apis --profile $Profile --region $Region --query "items[?contains(name, 'harmonest')].{Name:name,Id:id}" --output table
if ($apis) {
    Write-Host $apis
} else {
    Write-Host "No API Gateway APIs found" -ForegroundColor Gray
}

# Check Lambda Functions
Write-Host ""
Write-Host "⚡ Lambda Functions:" -ForegroundColor Yellow
$lambdas = aws lambda list-functions --profile $Profile --region $Region --query "Functions[?contains(FunctionName, 'harmonest')].{Name:FunctionName,Runtime:Runtime}" --output table
if ($lambdas) {
    Write-Host $lambdas
} else {
    Write-Host "No Lambda functions found" -ForegroundColor Gray
}

# Check SQS Queues
Write-Host ""
Write-Host "📬 SQS Queues:" -ForegroundColor Yellow
$queues = aws sqs list-queues --profile $Profile --region $Region --queue-name-prefix harmonest --output table
if ($queues) {
    Write-Host $queues
} else {
    Write-Host "No SQS queues found" -ForegroundColor Gray
}

# Check SNS Topics
Write-Host ""
Write-Host "📢 SNS Topics:" -ForegroundColor Yellow
$topics = aws sns list-topics --profile $Profile --region $Region --query "Topics[?contains(TopicArn, 'harmonest')]" --output table
if ($topics) {
    Write-Host $topics
} else {
    Write-Host "No SNS topics found" -ForegroundColor Gray
}

Write-Host ""
Write-Host "🌐 FRONTEND SERVICES (TO BE PRESERVED):" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green

# Check S3 Buckets (both frontend and backend)
Write-Host ""
Write-Host "🪣 S3 Buckets:" -ForegroundColor Yellow
$buckets = aws s3 ls --profile $Profile | Select-String "harmonest"
if ($buckets) {
    Write-Host $buckets
    
    # Categorize buckets
    Write-Host ""
    Write-Host "📂 Frontend Buckets (TO PRESERVE):" -ForegroundColor Green
    $frontendBuckets = @("harmonest.de", "dev.harmonest.de")
    foreach ($bucket in $frontendBuckets) {
        $exists = aws s3 ls s3://$bucket --profile $Profile 2>$null
        if ($exists) {
            Write-Host "  ✅ $bucket (Frontend hosting)" -ForegroundColor Green
            $size = aws s3 ls s3://$bucket --recursive --summarize --profile $Profile | Select-String "Total Size"
            Write-Host "    $size" -ForegroundColor Cyan
        } else {
            Write-Host "  ❌ $bucket (Not found)" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "📂 Backend Storage Buckets (TO DELETE):" -ForegroundColor Red
    $storageBuckets = @("harmonest-dev-storage", "harmonest-prod-storage")
    foreach ($bucket in $storageBuckets) {
        $exists = aws s3 ls s3://$bucket --profile $Profile 2>$null
        if ($exists) {
            Write-Host "  🗑️ $bucket (Backend storage)" -ForegroundColor Red
            $size = aws s3 ls s3://$bucket --recursive --summarize --profile $Profile | Select-String "Total Size"
            Write-Host "    $size" -ForegroundColor Cyan
        } else {
            Write-Host "  ❌ $bucket (Not found)" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "No S3 buckets found" -ForegroundColor Gray
}

# Check CloudFront Distributions
Write-Host ""
Write-Host "🌍 CloudFront Distributions:" -ForegroundColor Yellow
$distributions = aws cloudfront list-distributions --profile $Profile --query "DistributionList.Items[?contains(Comment, 'harmonest') || contains(Comment, 'Harmonest')].{Id:Id,DomainName:DomainName,Comment:Comment,Status:Status}" --output table
if ($distributions) {
    Write-Host $distributions
    Write-Host "  ✅ These distributions serve your frontend and will be PRESERVED" -ForegroundColor Green
} else {
    Write-Host "No CloudFront distributions found" -ForegroundColor Gray
}

Write-Host ""
Write-Host "⚠️  DELETION IMPACT SUMMARY:" -ForegroundColor Yellow
Write-Host "============================" -ForegroundColor Yellow
Write-Host "🗑️  WILL BE DELETED:" -ForegroundColor Red
Write-Host "   - All DynamoDB tables and data" -ForegroundColor Red
Write-Host "   - All Cognito users and authentication" -ForegroundColor Red
Write-Host "   - All Lambda functions and APIs" -ForegroundColor Red
Write-Host "   - All SQS queues and SNS topics" -ForegroundColor Red
Write-Host "   - Backend S3 storage buckets" -ForegroundColor Red
Write-Host ""
Write-Host "✅ WILL BE PRESERVED:" -ForegroundColor Green
Write-Host "   - Frontend S3 buckets (harmonest.de, dev.harmonest.de)" -ForegroundColor Green
Write-Host "   - CloudFront distributions" -ForegroundColor Green
Write-Host ""
Write-Host "🔍 Audit completed. Review the above before proceeding with deletion." -ForegroundColor Cyan
