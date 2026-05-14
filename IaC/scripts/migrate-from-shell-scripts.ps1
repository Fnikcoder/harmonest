# Migration Script: Shell Scripts to AWS CDK (PowerShell version)
# This script helps migrate from the existing shell script infrastructure to AWS CDK

param(
    [string]$Environment = "",
    [switch]$SkipConfirmation = $false
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

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CdkDir = Split-Path -Parent $ScriptDir
$ProjectRoot = Split-Path -Parent $CdkDir
$AwsCliDir = Join-Path $ProjectRoot "aws_cli"
$ConfigFile = Join-Path $AwsCliDir "aws_config.json"

Write-ColorOutput "🔄 Harmonest Infrastructure Migration" $Blue
Write-ColorOutput "======================================" $Blue
Write-Host ""
Write-Host "This script will help you migrate from shell script infrastructure to AWS CDK."
Write-Host ""

# Check prerequisites
Write-ColorOutput "📋 Checking Prerequisites..." $Blue

# Check if AWS CLI directory exists
if (-not (Test-Path $AwsCliDir)) {
    Write-ColorOutput "❌ AWS CLI directory not found: $AwsCliDir" $Red
    exit 1
}

# Check if config file exists
if (-not (Test-Path $ConfigFile)) {
    Write-ColorOutput "❌ AWS config file not found: $ConfigFile" $Red
    exit 1
}

# Check if CDK is installed
try {
    $cdkVersion = cdk --version 2>$null
    if (-not $cdkVersion) {
        throw "CDK not found"
    }
} catch {
    Write-ColorOutput "❌ AWS CDK CLI not found. Please install it first:" $Red
    Write-Host "npm install -g aws-cdk"
    exit 1
}

# Check if Node.js is installed
try {
    $nodeVersion = node --version 2>$null
    if (-not $nodeVersion) {
        throw "Node.js not found"
    }
    $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($majorVersion -lt 18) {
        Write-ColorOutput "❌ Node.js version 18 or later required. Current version: $nodeVersion" $Red
        exit 1
    }
} catch {
    Write-ColorOutput "❌ Node.js not found. Please install Node.js 18 or later." $Red
    exit 1
}

Write-ColorOutput "✅ Prerequisites check passed" $Green
Write-Host ""

# Load AWS profile from config
$configContent = Get-Content $ConfigFile | ConvertFrom-Json
$AwsProfile = $configContent.aws_profile
if (-not $AwsProfile) {
    $AwsProfile = "harmonestadmin"
}
$Region = $configContent.region
if (-not $Region) {
    $Region = "eu-central-1"
}

Write-ColorOutput "📊 Current Configuration:" $Blue
Write-Host "AWS Profile: $AwsProfile"
Write-Host "Region: $Region"
Write-Host "Config File: $ConfigFile"
Write-Host ""

# Prompt for environment if not provided
if (-not $Environment) {
    Write-Host "Select environment to migrate:"
    Write-Host "1) dev"
    Write-Host "2) prod"
    Write-Host "3) both"
    $envChoice = Read-Host "Enter choice (1-3)"
    
    switch ($envChoice) {
        "1" { $Environments = @("dev") }
        "2" { $Environments = @("prod") }
        "3" { $Environments = @("dev", "prod") }
        default {
            Write-ColorOutput "❌ Invalid choice. Exiting." $Red
            exit 1
        }
    }
} else {
    $Environments = @($Environment)
}

Write-Host ""

# Warning about migration
if (-not $SkipConfirmation) {
    Write-ColorOutput "⚠️  IMPORTANT MIGRATION NOTES:" $Yellow
    Write-Host ""
    Write-Host "1. This migration will create NEW resources using CDK"
    Write-Host "2. Existing resources created by shell scripts will NOT be automatically imported"
    Write-Host "3. You may have DUPLICATE resources after migration"
    Write-Host "4. You should manually delete old resources after verifying the new ones work"
    Write-Host "5. Make sure to backup any important data before proceeding"
    Write-Host ""
    Write-ColorOutput "🚨 DATA SAFETY WARNING:" $Red
    Write-Host "- CDK will create new DynamoDB tables and S3 buckets"
    Write-Host "- Your existing data will NOT be automatically migrated"
    Write-Host "- Plan for data migration separately if needed"
    Write-Host ""
    
    $confirm = Read-Host "Do you understand and want to continue? (yes/no)"
    if ($confirm -ne "yes") {
        Write-ColorOutput "Migration cancelled." $Yellow
        exit 0
    }
}

Write-Host ""

# Install CDK dependencies
Write-ColorOutput "📦 Installing CDK Dependencies..." $Blue
Set-Location $CdkDir

if (-not (Test-Path "package.json")) {
    Write-ColorOutput "❌ package.json not found in CDK directory" $Red
    exit 1
}

try {
    npm install
    Write-ColorOutput "✅ Dependencies installed" $Green
} catch {
    Write-ColorOutput "❌ Failed to install dependencies" $Red
    exit 1
}

Write-Host ""

# Build CDK project
Write-ColorOutput "🔨 Building CDK Project..." $Blue
try {
    npm run build
    Write-ColorOutput "✅ CDK project built successfully" $Green
} catch {
    Write-ColorOutput "❌ Failed to build CDK project" $Red
    exit 1
}

Write-Host ""

# Bootstrap CDK (if needed)
Write-ColorOutput "🚀 Bootstrapping CDK..." $Blue

foreach ($env in $Environments) {
    Write-Host "Bootstrapping environment: $env"
    
    # Check if already bootstrapped
    $bootstrapStack = "CDKToolkit"
    try {
        aws cloudformation describe-stacks --stack-name $bootstrapStack --profile $AwsProfile --region $Region 2>$null | Out-Null
        Write-ColorOutput "  ✅ CDK already bootstrapped" $Green
    } catch {
        Write-Host "  Bootstrapping CDK..."
        try {
            cdk bootstrap --profile $AwsProfile --context environment=$env
            Write-ColorOutput "  ✅ CDK bootstrapped for $env" $Green
        } catch {
            Write-ColorOutput "  ❌ Failed to bootstrap CDK for $env" $Red
            exit 1
        }
    }
}

Write-Host ""

# Deploy CDK stacks
Write-ColorOutput "🚀 Deploying CDK Stacks..." $Blue

foreach ($env in $Environments) {
    Write-Host "Deploying to environment: $env"
    
    Write-Host "  Deploying all stacks..."
    try {
        if ($env -eq "dev") {
            npm run deploy:dev
        } else {
            npm run deploy:prod
        }
        Write-ColorOutput "  ✅ All stacks deployed for $env" $Green
    } catch {
        Write-ColorOutput "  ❌ Failed to deploy stacks for $env" $Red
        exit 1
    }
}

Write-Host ""

# Generate migration report
Write-ColorOutput "📋 Generating Migration Report..." $Blue

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$reportFile = Join-Path $CdkDir "migration-report-$timestamp.md"

$reportContent = @"
# Harmonest Infrastructure Migration Report

**Migration Date**: $(Get-Date)
**Environments**: $($Environments -join ', ')
**AWS Profile**: $AwsProfile
**Region**: $Region

## CDK Stacks Deployed

"@

foreach ($env in $Environments) {
    $reportContent += @"

### $env Environment

- **Auth Stack**: Harmonest-$env-Auth
- **Storage Stack**: Harmonest-$env-Storage
- **Messaging Stack**: Harmonest-$env-Messaging
- **API Stack**: Harmonest-$env-Api
- **CDN Stack**: Harmonest-$env-Cdn

#### Stack Outputs

``````bash
# View stack outputs
aws cloudformation describe-stacks --stack-name Harmonest-$env-Auth --profile $AwsProfile --region $Region --query 'Stacks[0].Outputs'
aws cloudformation describe-stacks --stack-name Harmonest-$env-Storage --profile $AwsProfile --region $Region --query 'Stacks[0].Outputs'
aws cloudformation describe-stacks --stack-name Harmonest-$env-Api --profile $AwsProfile --region $Region --query 'Stacks[0].Outputs'
``````

"@
}

$reportContent += @"

## Next Steps

1. **Verify New Resources**: Check that all CDK-created resources are working correctly
2. **Update Application Configuration**: Update your Angular app to use new resource IDs/ARNs
3. **Data Migration**: Plan and execute data migration from old to new resources
4. **Test Thoroughly**: Test all application functionality with new infrastructure
5. **Clean Up Old Resources**: After verification, delete old shell script-created resources

## Configuration Updates Needed

Update the following files in your Angular application:

- ``src/environments/environment.ts``
- ``src/environments/environment.prod.ts``
- ``src/app/config/aws.config.ts``

Use the stack outputs to get the correct resource IDs and ARNs.

## Useful Commands

``````powershell
# View CDK stack outputs
cd $CdkDir
cdk list --profile $AwsProfile --context environment=dev

# Update CDK stacks
npm run deploy:dev  # or deploy:prod

# Destroy CDK stacks (if needed)
npm run destroy:dev  # or destroy:prod
``````
"@

Set-Content -Path $reportFile -Value $reportContent -Encoding UTF8

Write-ColorOutput "✅ Migration report generated: $reportFile" $Green
Write-Host ""

# Final summary
Write-ColorOutput "🎉 Migration Completed Successfully!" $Green
Write-Host ""
Write-ColorOutput "📋 Summary:" $Blue
Write-Host "- CDK infrastructure deployed for: $($Environments -join ', ')"
Write-Host "- Migration report: $reportFile"
Write-Host "- CDK project location: $CdkDir"
Write-Host ""
Write-ColorOutput "⚠️  Next Steps:" $Yellow
Write-Host "1. Review the migration report"
Write-Host "2. Update your Angular application configuration"
Write-Host "3. Test all functionality thoroughly"
Write-Host "4. Plan data migration if needed"
Write-Host "5. Clean up old resources after verification"
Write-Host ""

Write-ColorOutput "Migration completed! 🚀" $Green
