# Update Angular Environment Configuration with CDK Stack Outputs
# This script extracts CDK stack outputs and updates Angular environment files

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "prod")]
    [string]$Environment,
    
    [string]$AwsProfile = "harmonestadmin",
    [string]$Region = "eu-central-1"
)

# Colors for output
$Red = [System.ConsoleColor]::Red
$Green = [System.ConsoleColor]::Green
$Yellow = [System.ConsoleColor]::Yellow
$Blue = [System.ConsoleColor]::Blue
$White = [System.ConsoleColor]::White

function Write-ColorOutput {
    param(
        [string]$Message,
        [System.ConsoleColor]$Color = $White
    )
    Write-Host $Message -ForegroundColor $Color
}

function Get-StackOutput {
    param(
        [string]$StackName,
        [string]$OutputKey
    )
    
    try {
        $output = aws cloudformation describe-stacks --stack-name $StackName --profile $AwsProfile --region $Region --query "Stacks[0].Outputs[?OutputKey=='$OutputKey'].OutputValue" --output text 2>$null
        if ($output -and $output -ne "None") {
            return $output.Trim()
        }
        return $null
    } catch {
        return $null
    }
}

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CdkDir = Split-Path -Parent $ScriptDir
$ProjectRoot = Split-Path -Parent $CdkDir
$AngularSrcDir = Join-Path $ProjectRoot "src"
$EnvironmentsDir = Join-Path $AngularSrcDir "environments"

Write-ColorOutput "🔧 Updating Angular Configuration for $Environment Environment" $Blue
Write-ColorOutput "================================================================" $Blue
Write-Host ""

# Check if environments directory exists
if (-not (Test-Path $EnvironmentsDir)) {
    Write-ColorOutput "❌ Angular environments directory not found: $EnvironmentsDir" $Red
    exit 1
}

# Define stack names
$AuthStackName = "Harmonest-$Environment-Auth"
$StorageStackName = "Harmonest-$Environment-Storage"
$ApiStackName = "Harmonest-$Environment-Api"
$CdnStackName = "Harmonest-$Environment-Cdn"

Write-ColorOutput "📊 Extracting Stack Outputs..." $Blue

# Extract stack outputs
$UserPoolId = Get-StackOutput $AuthStackName "UserPoolId"
$UserPoolClientId = Get-StackOutput $AuthStackName "UserPoolClientId"
$IdentityPoolId = Get-StackOutput $AuthStackName "IdentityPoolId"
$DynamoTableName = Get-StackOutput $StorageStackName "DynamoTableName"
$S3BucketName = Get-StackOutput $StorageStackName "S3BucketName"
$ApiGatewayUrl = Get-StackOutput $ApiStackName "ApiGatewayUrl"
$CloudFrontDistributionId = Get-StackOutput $CdnStackName "CloudFrontDistributionId"
$CloudFrontDomainName = Get-StackOutput $CdnStackName "CloudFrontDomainName"

# Display extracted values
Write-Host "Extracted values:"
Write-Host "- User Pool ID: $UserPoolId"
Write-Host "- User Pool Client ID: $UserPoolClientId"
Write-Host "- Identity Pool ID: $IdentityPoolId"
Write-Host "- DynamoDB Table: $DynamoTableName"
Write-Host "- S3 Bucket: $S3BucketName"
Write-Host "- API Gateway URL: $ApiGatewayUrl"
Write-Host "- CloudFront Distribution ID: $CloudFrontDistributionId"
Write-Host "- CloudFront Domain: $CloudFrontDomainName"
Write-Host ""

# Validate required outputs
$requiredOutputs = @{
    "UserPoolId" = $UserPoolId
    "UserPoolClientId" = $UserPoolClientId
    "IdentityPoolId" = $IdentityPoolId
    "ApiGatewayUrl" = $ApiGatewayUrl
}

$missingOutputs = @()
foreach ($output in $requiredOutputs.GetEnumerator()) {
    if (-not $output.Value) {
        $missingOutputs += $output.Key
    }
}

if ($missingOutputs.Count -gt 0) {
    Write-ColorOutput "❌ Missing required stack outputs: $($missingOutputs -join ', ')" $Red
    Write-Host "Make sure all CDK stacks are deployed successfully."
    exit 1
}

# Determine environment file
$environmentFile = if ($Environment -eq "prod") {
    Join-Path $EnvironmentsDir "environment.prod.ts"
} else {
    Join-Path $EnvironmentsDir "environment.ts"
}

if (-not (Test-Path $environmentFile)) {
    Write-ColorOutput "❌ Environment file not found: $environmentFile" $Red
    exit 1
}

Write-ColorOutput "📝 Updating Environment File..." $Blue
Write-Host "File: $environmentFile"

# Create backup
$backupFile = "$environmentFile.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $environmentFile $backupFile
Write-Host "Backup created: $backupFile"

# Read current environment file
$content = Get-Content $environmentFile -Raw

# Update the configuration
$isProduction = if ($Environment -eq "prod") { "true" } else { "false" }

$newContent = @"
export const environment = {
  production: $isProduction,
  cognito: {
    region: '$Region',
    userPoolId: '$UserPoolId',
    userPoolWebClientId: '$UserPoolClientId',
    identityPoolId: '$IdentityPoolId',
    oauth: {
      domain: 'harmonest-$Environment-auth.auth.$Region.amazoncognito.com',
      scope: ['email', 'openid', 'profile'],
      redirectSignIn: 'http://localhost:4200/auth/callback',
      redirectSignOut: 'http://localhost:4200/auth/signout',
      responseType: 'code'
    }
  },
  api: {
    baseUrl: '$ApiGatewayUrl',
    timeout: 30000
  },
  aws: {
    region: '$Region',
    dynamodb: {
      tableName: '$DynamoTableName'
    },
    s3: {
      bucketName: '$S3BucketName'
    }
  }
"@

if ($CloudFrontDomainName) {
    $newContent += @"
,
  cdn: {
    distributionId: '$CloudFrontDistributionId',
    domainName: '$CloudFrontDomainName'
  }
"@
}

$newContent += @"
};
"@

# Write updated content
Set-Content -Path $environmentFile -Value $newContent -Encoding UTF8

Write-ColorOutput "✅ Environment file updated successfully!" $Green
Write-Host ""

# Update AWS config file as well
$awsConfigFile = Join-Path (Join-Path $AngularSrcDir "app") "config" | Join-Path -ChildPath "aws.config.ts"

if (Test-Path $awsConfigFile) {
    Write-ColorOutput "📝 Updating AWS Config File..." $Blue
    Write-Host "File: $awsConfigFile"
    
    # Create backup
    $awsConfigBackup = "$awsConfigFile.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $awsConfigFile $awsConfigBackup
    Write-Host "Backup created: $awsConfigBackup"
    
    # Read and update AWS config
    $awsConfigContent = Get-Content $awsConfigFile -Raw
    
    # Simple replacement approach - you might need to adjust this based on your actual file structure
    $awsConfigContent = $awsConfigContent -replace "userPoolId: '[^']*'", "userPoolId: '$UserPoolId'"
    $awsConfigContent = $awsConfigContent -replace "userPoolWebClientId: '[^']*'", "userPoolWebClientId: '$UserPoolClientId'"
    $awsConfigContent = $awsConfigContent -replace "identityPoolId: '[^']*'", "identityPoolId: '$IdentityPoolId'"
    $awsConfigContent = $awsConfigContent -replace "tableName: '[^']*'", "tableName: '$DynamoTableName'"
    $awsConfigContent = $awsConfigContent -replace "bucketName: '[^']*'", "bucketName: '$S3BucketName'"
    
    Set-Content -Path $awsConfigFile -Value $awsConfigContent -Encoding UTF8
    Write-ColorOutput "✅ AWS config file updated successfully!" $Green
} else {
    Write-ColorOutput "⚠️  AWS config file not found: $awsConfigFile" $Yellow
    Write-Host "You may need to update it manually."
}

Write-Host ""
Write-ColorOutput "🎉 Configuration Update Complete!" $Green
Write-Host ""
Write-ColorOutput "📋 Summary:" $Blue
Write-Host "- Environment: $Environment"
Write-Host "- Environment file: $environmentFile"
Write-Host "- Backup created: $backupFile"
if (Test-Path $awsConfigFile) {
    Write-Host "- AWS config file: $awsConfigFile"
    Write-Host "- AWS config backup: $awsConfigBackup"
}
Write-Host ""
Write-ColorOutput "⚠️  Next Steps:" $Yellow
Write-Host "1. Review the updated configuration files"
Write-Host "2. Test your Angular application"
Write-Host "3. Verify all AWS services are working correctly"
Write-Host "4. Remove backup files once everything is working"
Write-Host ""

Write-ColorOutput "Configuration update completed! 🚀" $Green
