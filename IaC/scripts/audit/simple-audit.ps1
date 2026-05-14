# Simple AWS Resources Audit Script
param(
    [string]$Environment = "dev",
    [string]$Profile = "harmonestadmin",
    [string]$Region = "eu-central-1"
)

Write-Host "🔍 AWS Resources Audit for Harmonest ($Environment)" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Check AWS credentials
Write-Host "📋 Checking AWS credentials..." -ForegroundColor Yellow
$accountInfo = aws sts get-caller-identity --profile $Profile --output json 2>$null
if ($LASTEXITCODE -eq 0) {
    $account = ($accountInfo | ConvertFrom-Json).Account
    Write-Host "✅ Account: $account" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to get AWS credentials" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🏗️ BACKEND SERVICES (TO BE DELETED):" -ForegroundColor Red
Write-Host "=====================================" -ForegroundColor Red

# Check CloudFormation Stacks
Write-Host ""
Write-Host "📦 CloudFormation Stacks:" -ForegroundColor Yellow
$stackName = "Harmonest-$Environment"
$stacks = aws cloudformation list-stacks --profile $Profile --region $Region --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --output json 2>$null
if ($LASTEXITCODE -eq 0 -and $stacks) {
    $stackList = ($stacks | ConvertFrom-Json).StackSummaries | Where-Object { $_.StackName -like "*$stackName*" }
    if ($stackList) {
        foreach ($stack in $stackList) {
            Write-Host "  📦 $($stack.StackName) - $($stack.StackStatus)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ✅ No CloudFormation stacks found" -ForegroundColor Green
    }
} else {
    Write-Host "  ⚠️ Could not list CloudFormation stacks" -ForegroundColor Yellow
}

# Check DynamoDB Tables
Write-Host ""
Write-Host "📊 DynamoDB Tables:" -ForegroundColor Yellow
$tables = aws dynamodb list-tables --profile $Profile --region $Region --output json 2>$null
if ($LASTEXITCODE -eq 0 -and $tables) {
    $tableList = ($tables | ConvertFrom-Json).TableNames | Where-Object { $_ -like "*harmonest*" }
    if ($tableList) {
        foreach ($table in $tableList) {
            Write-Host "  📊 $table" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ✅ No DynamoDB tables found" -ForegroundColor Green
    }
} else {
    Write-Host "  ⚠️ Could not list DynamoDB tables" -ForegroundColor Yellow
}

# Check Cognito User Pools
Write-Host ""
Write-Host "🔐 Cognito User Pools:" -ForegroundColor Yellow
$pools = aws cognito-idp list-user-pools --max-items 50 --profile $Profile --region $Region --output json 2>$null
if ($LASTEXITCODE -eq 0 -and $pools) {
    $poolList = ($pools | ConvertFrom-Json).UserPools | Where-Object { $_.Name -like "*harmonest*" }
    if ($poolList) {
        foreach ($pool in $poolList) {
            Write-Host "  🔐 $($pool.Name) - $($pool.Id)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ✅ No Cognito User Pools found" -ForegroundColor Green
    }
} else {
    Write-Host "  ⚠️ Could not list Cognito User Pools" -ForegroundColor Yellow
}

# Check Lambda Functions
Write-Host ""
Write-Host "⚡ Lambda Functions:" -ForegroundColor Yellow
$functions = aws lambda list-functions --profile $Profile --region $Region --output json 2>$null
if ($LASTEXITCODE -eq 0 -and $functions) {
    $functionList = ($functions | ConvertFrom-Json).Functions | Where-Object { $_.FunctionName -like "*harmonest*" }
    if ($functionList) {
        foreach ($func in $functionList) {
            Write-Host "  ⚡ $($func.FunctionName) - $($func.Runtime)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ✅ No Lambda functions found" -ForegroundColor Green
    }
} else {
    Write-Host "  ⚠️ Could not list Lambda functions" -ForegroundColor Yellow
}

# Check S3 Buckets
Write-Host ""
Write-Host "🌐 FRONTEND SERVICES (TO BE PRESERVED):" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green

Write-Host ""
Write-Host "🪣 S3 Buckets:" -ForegroundColor Yellow
$buckets = aws s3 ls --profile $Profile 2>$null
if ($LASTEXITCODE -eq 0 -and $buckets) {
    $harmonestBuckets = $buckets | Select-String "harmonest"
    if ($harmonestBuckets) {
        Write-Host "  Found buckets:" -ForegroundColor Cyan
        foreach ($bucket in $harmonestBuckets) {
            $bucketName = ($bucket -split '\s+')[-1]
            if ($bucketName -eq "harmonest.de" -or $bucketName -eq "dev.harmonest.de") {
                Write-Host "  ✅ $bucketName (Frontend - PRESERVE)" -ForegroundColor Green
            } else {
                Write-Host "  🗑️ $bucketName (Backend - DELETE)" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "  ⚠️ No harmonest buckets found" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⚠️ Could not list S3 buckets" -ForegroundColor Yellow
}

# Check CloudFront Distributions
Write-Host ""
Write-Host "🌍 CloudFront Distributions:" -ForegroundColor Yellow
$distributions = aws cloudfront list-distributions --profile $Profile --output json 2>$null
if ($LASTEXITCODE -eq 0 -and $distributions) {
    $distList = ($distributions | ConvertFrom-Json).DistributionList.Items | Where-Object { $_.Comment -like "*harmonest*" -or $_.Comment -like "*Harmonest*" }
    if ($distList) {
        foreach ($dist in $distList) {
            Write-Host "  ✅ $($dist.Id) - $($dist.DomainName) (PRESERVE)" -ForegroundColor Green
        }
    } else {
        Write-Host "  ⚠️ No CloudFront distributions found" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⚠️ Could not list CloudFront distributions" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "⚠️ DELETION IMPACT SUMMARY:" -ForegroundColor Yellow
Write-Host "============================" -ForegroundColor Yellow
Write-Host "🗑️ WILL BE DELETED:" -ForegroundColor Red
Write-Host "   - All DynamoDB tables and data" -ForegroundColor Red
Write-Host "   - All Cognito users and authentication" -ForegroundColor Red
Write-Host "   - All Lambda functions and APIs" -ForegroundColor Red
Write-Host "   - Backend S3 storage buckets" -ForegroundColor Red
Write-Host ""
Write-Host "✅ WILL BE PRESERVED:" -ForegroundColor Green
Write-Host "   - Frontend S3 buckets (harmonest.de, dev.harmonest.de)" -ForegroundColor Green
Write-Host "   - CloudFront distributions" -ForegroundColor Green
Write-Host ""
Write-Host "🔍 Audit completed. Review the above before proceeding with deletion." -ForegroundColor Cyan
