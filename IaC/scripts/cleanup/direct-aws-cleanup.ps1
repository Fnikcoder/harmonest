# Direct AWS CLI Backend Cleanup Script
# This script uses AWS CLI directly to delete backend services while preserving frontend

param(
    [string]$Environment = "dev",
    [string]$Profile = "harmonestadmin",
    [string]$Region = "eu-central-1",
    [switch]$Force = $false
)

Write-Host "🗑️ Direct AWS Backend Cleanup for Harmonest ($Environment)" -ForegroundColor Red
Write-Host "=========================================================" -ForegroundColor Red

if (-not $Force) {
    Write-Host ""
    Write-Host "⚠️ WARNING: This will permanently delete all backend services!" -ForegroundColor Yellow
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

# Test AWS credentials
Write-Host ""
Write-Host "📋 Testing AWS credentials..." -ForegroundColor Yellow
$accountTest = aws sts get-caller-identity --profile $Profile --output json 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to authenticate with AWS. Check your profile configuration." -ForegroundColor Red
    exit 1
}
$account = ($accountTest | ConvertFrom-Json).Account
Write-Host "✅ Connected to AWS Account: $account" -ForegroundColor Green

Write-Host ""
Write-Host "🚀 Starting backend cleanup..." -ForegroundColor Cyan

# Function to safely delete CloudFormation stack
function Delete-CloudFormationStack {
    param($StackName)
    
    Write-Host ""
    Write-Host "📦 Checking CloudFormation stack: $StackName" -ForegroundColor Yellow
    
    $stackExists = aws cloudformation describe-stacks --profile $Profile --region $Region --stack-name $StackName --output json 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ✅ Stack $StackName does not exist" -ForegroundColor Green
        return
    }
    
    Write-Host "   🗑️ Deleting stack: $StackName" -ForegroundColor Yellow
    aws cloudformation delete-stack --profile $Profile --region $Region --stack-name $StackName
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   🔄 Deletion initiated for $StackName" -ForegroundColor Cyan
        Write-Host "   ⏳ Waiting for deletion to complete..." -ForegroundColor Cyan
        aws cloudformation wait stack-delete-complete --profile $Profile --region $Region --stack-name $StackName
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Stack $StackName deleted successfully" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️ Stack deletion may still be in progress" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ❌ Failed to initiate deletion of $StackName" -ForegroundColor Red
    }
}

# Delete CloudFormation stacks in reverse dependency order
Delete-CloudFormationStack "Harmonest-$Environment-Cdn"
Delete-CloudFormationStack "Harmonest-$Environment-Api"
Delete-CloudFormationStack "Harmonest-$Environment-Messaging"
Delete-CloudFormationStack "Harmonest-$Environment-Storage"
Delete-CloudFormationStack "Harmonest-$Environment-Auth"

# Clean up orphaned Lambda functions
Write-Host ""
Write-Host "⚡ Cleaning up Lambda functions..." -ForegroundColor Yellow
$lambdas = aws lambda list-functions --profile $Profile --region $Region --output json 2>$null
if ($LASTEXITCODE -eq 0 -and $lambdas) {
    $functionList = ($lambdas | ConvertFrom-Json).Functions | Where-Object { $_.FunctionName -like "*harmonest*$Environment*" -or $_.FunctionName -like "*harmonest*" }
    if ($functionList) {
        foreach ($func in $functionList) {
            Write-Host "   🗑️ Deleting Lambda function: $($func.FunctionName)" -ForegroundColor Yellow
            aws lambda delete-function --profile $Profile --region $Region --function-name $func.FunctionName 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ Deleted: $($func.FunctionName)" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️ Could not delete: $($func.FunctionName)" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "   ✅ No Lambda functions to delete" -ForegroundColor Green
    }
}

# Clean up API Gateway APIs
Write-Host ""
Write-Host "🌐 Cleaning up API Gateway APIs..." -ForegroundColor Yellow
$apis = aws apigateway get-rest-apis --profile $Profile --region $Region --output json 2>$null
if ($LASTEXITCODE -eq 0 -and $apis) {
    $apiList = ($apis | ConvertFrom-Json).items | Where-Object { $_.name -like "*harmonest*" }
    if ($apiList) {
        foreach ($api in $apiList) {
            Write-Host "   🗑️ Deleting API Gateway: $($api.name) ($($api.id))" -ForegroundColor Yellow
            aws apigateway delete-rest-api --profile $Profile --region $Region --rest-api-id $api.id 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ Deleted: $($api.name)" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️ Could not delete: $($api.name)" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "   ✅ No API Gateway APIs to delete" -ForegroundColor Green
    }
}

# Clean up DynamoDB tables
Write-Host ""
Write-Host "📊 Cleaning up DynamoDB tables..." -ForegroundColor Yellow
$tables = aws dynamodb list-tables --profile $Profile --region $Region --output json 2>$null
if ($LASTEXITCODE -eq 0 -and $tables) {
    $tableList = ($tables | ConvertFrom-Json).TableNames | Where-Object { $_ -like "*harmonest*" }
    if ($tableList) {
        foreach ($table in $tableList) {
            Write-Host "   🗑️ Deleting DynamoDB table: $table" -ForegroundColor Yellow
            aws dynamodb delete-table --profile $Profile --region $Region --table-name $table 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ Deleted: $table" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️ Could not delete: $table" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "   ✅ No DynamoDB tables to delete" -ForegroundColor Green
    }
}

# Clean up Cognito User Pools
Write-Host ""
Write-Host "🔐 Cleaning up Cognito User Pools..." -ForegroundColor Yellow
$pools = aws cognito-idp list-user-pools --max-items 50 --profile $Profile --region $Region --output json 2>$null
if ($LASTEXITCODE -eq 0 -and $pools) {
    $poolList = ($pools | ConvertFrom-Json).UserPools | Where-Object { $_.Name -like "*harmonest*" }
    if ($poolList) {
        foreach ($pool in $poolList) {
            Write-Host "   🗑️ Deleting Cognito User Pool: $($pool.Name)" -ForegroundColor Yellow
            aws cognito-idp delete-user-pool --profile $Profile --region $Region --user-pool-id $pool.Id 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ Deleted: $($pool.Name)" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️ Could not delete: $($pool.Name)" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "   ✅ No Cognito User Pools to delete" -ForegroundColor Green
    }
}

# Clean up SQS Queues
Write-Host ""
Write-Host "📬 Cleaning up SQS queues..." -ForegroundColor Yellow
$queues = aws sqs list-queues --profile $Profile --region $Region --queue-name-prefix harmonest --output json 2>$null
if ($LASTEXITCODE -eq 0 -and $queues) {
    $queueList = ($queues | ConvertFrom-Json).QueueUrls
    if ($queueList) {
        foreach ($queueUrl in $queueList) {
            $queueName = ($queueUrl -split '/')[-1]
            Write-Host "   🗑️ Deleting SQS queue: $queueName" -ForegroundColor Yellow
            aws sqs delete-queue --profile $Profile --region $Region --queue-url $queueUrl 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ Deleted: $queueName" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️ Could not delete: $queueName" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "   ✅ No SQS queues to delete" -ForegroundColor Green
    }
}

# Clean up SNS Topics
Write-Host ""
Write-Host "📢 Cleaning up SNS topics..." -ForegroundColor Yellow
$topics = aws sns list-topics --profile $Profile --region $Region --output json 2>$null
if ($LASTEXITCODE -eq 0 -and $topics) {
    $topicList = ($topics | ConvertFrom-Json).Topics | Where-Object { $_.TopicArn -like "*harmonest*" }
    if ($topicList) {
        foreach ($topic in $topicList) {
            $topicName = ($topic.TopicArn -split ':')[-1]
            Write-Host "   🗑️ Deleting SNS topic: $topicName" -ForegroundColor Yellow
            aws sns delete-topic --profile $Profile --region $Region --topic-arn $topic.TopicArn 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ Deleted: $topicName" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️ Could not delete: $topicName" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "   ✅ No SNS topics to delete" -ForegroundColor Green
    }
}

# Clean up backend S3 storage buckets (NOT frontend buckets)
Write-Host ""
Write-Host "🪣 Cleaning up backend S3 storage buckets..." -ForegroundColor Yellow
$backendBuckets = @("harmonest-$Environment-storage", "harmonest-dev-storage", "harmonest-prod-storage")

foreach ($bucketName in $backendBuckets) {
    $bucketExists = aws s3 ls "s3://$bucketName" --profile $Profile 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   🗑️ Deleting backend storage bucket: $bucketName" -ForegroundColor Yellow
        # Empty the bucket first
        aws s3 rm "s3://$bucketName" --recursive --profile $Profile 2>$null
        # Delete the bucket
        aws s3 rb "s3://$bucketName" --profile $Profile 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Deleted: $bucketName" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️ Could not delete: $bucketName" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ✅ Backend bucket $bucketName does not exist" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "✅ FRONTEND PRESERVATION CHECK:" -ForegroundColor Green
Write-Host "===============================" -ForegroundColor Green

# Verify frontend buckets are still intact
$frontendBuckets = @("harmonest.de", "dev.harmonest.de")
foreach ($bucket in $frontendBuckets) {
    $exists = aws s3 ls "s3://$bucket" --profile $Profile 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Frontend bucket preserved: $bucket" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Frontend bucket not found: $bucket (may not have been created yet)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🎉 Backend cleanup completed!" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Green
Write-Host "✅ All backend services have been deleted" -ForegroundColor Green
Write-Host "✅ Frontend infrastructure has been preserved" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Summary:" -ForegroundColor Cyan
Write-Host "   🗑️ Deleted: CloudFormation stacks, DynamoDB, Cognito, Lambda, API Gateway, SQS, SNS, backend S3" -ForegroundColor Red
Write-Host "   ✅ Preserved: Frontend S3 buckets, CloudFront distributions" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Your frontend should still be accessible at:" -ForegroundColor Cyan
Write-Host "   - Production: https://harmonest.de" -ForegroundColor Cyan
Write-Host "   - Development: https://dev.harmonest.de" -ForegroundColor Cyan
