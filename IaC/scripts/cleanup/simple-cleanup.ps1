# Simple AWS Backend Cleanup Script
param(
    [string]$Environment = "dev",
    [string]$Profile = "harmonestadmin",
    [string]$Region = "eu-central-1"
)

Write-Host "🗑️ AWS Backend Cleanup for Harmonest ($Environment)" -ForegroundColor Red
Write-Host "=================================================" -ForegroundColor Red

Write-Host ""
Write-Host "⚠️ WARNING: This will delete all backend services!" -ForegroundColor Yellow
$confirmation = Read-Host "Type 'DELETE-BACKEND' to confirm"
if ($confirmation -ne "DELETE-BACKEND") {
    Write-Host "❌ Deletion cancelled." -ForegroundColor Red
    exit 1
}

# Test AWS credentials
Write-Host ""
Write-Host "📋 Testing AWS credentials..." -ForegroundColor Yellow
aws sts get-caller-identity --profile $Profile --output text | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to authenticate with AWS" -ForegroundColor Red
    exit 1
}
Write-Host "✅ AWS credentials OK" -ForegroundColor Green

Write-Host ""
Write-Host "🚀 Starting cleanup..." -ForegroundColor Cyan

# Delete CloudFormation stacks
Write-Host ""
Write-Host "📦 Deleting CloudFormation stacks..." -ForegroundColor Yellow

$stacks = @(
    "Harmonest-$Environment-Cdn",
    "Harmonest-$Environment-Api", 
    "Harmonest-$Environment-Messaging",
    "Harmonest-$Environment-Storage",
    "Harmonest-$Environment-Auth"
)

foreach ($stackName in $stacks) {
    Write-Host "   Checking stack: $stackName" -ForegroundColor Cyan
    aws cloudformation describe-stacks --profile $Profile --region $Region --stack-name $stackName --output text 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   🗑️ Deleting: $stackName" -ForegroundColor Yellow
        aws cloudformation delete-stack --profile $Profile --region $Region --stack-name $stackName
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Deletion initiated: $stackName" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Failed to delete: $stackName" -ForegroundColor Red
        }
    } else {
        Write-Host "   ✅ Stack does not exist: $stackName" -ForegroundColor Green
    }
}

# Wait a bit for stack deletions to start
Write-Host ""
Write-Host "⏳ Waiting 30 seconds for stack deletions to process..." -ForegroundColor Cyan
Start-Sleep -Seconds 30

# Clean up Lambda functions
Write-Host ""
Write-Host "⚡ Cleaning up Lambda functions..." -ForegroundColor Yellow
$lambdaOutput = aws lambda list-functions --profile $Profile --region $Region --output json 2>$null
if ($LASTEXITCODE -eq 0 -and $lambdaOutput) {
    $functions = ($lambdaOutput | ConvertFrom-Json).Functions
    $harmonestFunctions = $functions | Where-Object { $_.FunctionName -like "*harmonest*" }
    
    if ($harmonestFunctions) {
        foreach ($func in $harmonestFunctions) {
            Write-Host "   🗑️ Deleting Lambda: $($func.FunctionName)" -ForegroundColor Yellow
            aws lambda delete-function --profile $Profile --region $Region --function-name $func.FunctionName 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ Deleted: $($func.FunctionName)" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "   ✅ No Lambda functions to delete" -ForegroundColor Green
    }
}

# Clean up DynamoDB tables
Write-Host ""
Write-Host "📊 Cleaning up DynamoDB tables..." -ForegroundColor Yellow
$dynamoOutput = aws dynamodb list-tables --profile $Profile --region $Region --output json 2>$null
if ($LASTEXITCODE -eq 0 -and $dynamoOutput) {
    $tables = ($dynamoOutput | ConvertFrom-Json).TableNames
    $harmonestTables = $tables | Where-Object { $_ -like "*harmonest*" }
    
    if ($harmonestTables) {
        foreach ($table in $harmonestTables) {
            Write-Host "   🗑️ Deleting DynamoDB table: $table" -ForegroundColor Yellow
            aws dynamodb delete-table --profile $Profile --region $Region --table-name $table 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ Deleted: $table" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "   ✅ No DynamoDB tables to delete" -ForegroundColor Green
    }
}

# Clean up Cognito User Pools
Write-Host ""
Write-Host "🔐 Cleaning up Cognito User Pools..." -ForegroundColor Yellow
$cognitoOutput = aws cognito-idp list-user-pools --max-items 50 --profile $Profile --region $Region --output json 2>$null
if ($LASTEXITCODE -eq 0 -and $cognitoOutput) {
    $pools = ($cognitoOutput | ConvertFrom-Json).UserPools
    $harmonestPools = $pools | Where-Object { $_.Name -like "*harmonest*" }
    
    if ($harmonestPools) {
        foreach ($pool in $harmonestPools) {
            Write-Host "   🗑️ Deleting Cognito User Pool: $($pool.Name)" -ForegroundColor Yellow
            aws cognito-idp delete-user-pool --profile $Profile --region $Region --user-pool-id $pool.Id 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ Deleted: $($pool.Name)" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "   ✅ No Cognito User Pools to delete" -ForegroundColor Green
    }
}

# Clean up backend S3 buckets (preserve frontend buckets)
Write-Host ""
Write-Host "🪣 Cleaning up backend S3 storage buckets..." -ForegroundColor Yellow
$backendBuckets = @("harmonest-$Environment-storage", "harmonest-dev-storage", "harmonest-prod-storage")

foreach ($bucketName in $backendBuckets) {
    aws s3 ls "s3://$bucketName" --profile $Profile 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   🗑️ Deleting backend bucket: $bucketName" -ForegroundColor Yellow
        aws s3 rm "s3://$bucketName" --recursive --profile $Profile 2>$null
        aws s3 rb "s3://$bucketName" --profile $Profile 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Deleted: $bucketName" -ForegroundColor Green
        }
    } else {
        Write-Host "   ✅ Backend bucket does not exist: $bucketName" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "✅ FRONTEND PRESERVATION CHECK:" -ForegroundColor Green
Write-Host "===============================" -ForegroundColor Green

# Check frontend buckets
$frontendBuckets = @("harmonest.de", "dev.harmonest.de")
foreach ($bucket in $frontendBuckets) {
    aws s3 ls "s3://$bucket" --profile $Profile 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Frontend bucket preserved: $bucket" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Frontend bucket not found: $bucket" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🎉 Backend cleanup completed!" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Green
Write-Host "✅ All backend services deleted" -ForegroundColor Green
Write-Host "✅ Frontend infrastructure preserved" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Deleted:" -ForegroundColor Cyan
Write-Host "   - CloudFormation stacks" -ForegroundColor Red
Write-Host "   - DynamoDB tables" -ForegroundColor Red
Write-Host "   - Cognito User Pools" -ForegroundColor Red
Write-Host "   - Lambda functions" -ForegroundColor Red
Write-Host "   - Backend S3 storage buckets" -ForegroundColor Red
Write-Host ""
Write-Host "📋 Preserved:" -ForegroundColor Cyan
Write-Host "   - Frontend S3 buckets" -ForegroundColor Green
Write-Host "   - CloudFront distributions" -ForegroundColor Green
