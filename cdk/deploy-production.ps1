# Deploy all CDK stacks to AWS PRODUCTION (account/region from client config).
# After: run frontend production deploy (see frontend/aws_cli/deploy-harmonest-production.md).
param(
    [string]$Client = "harmonest",
    [switch]$SkipConfirmation
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not $SkipConfirmation) {
    Write-Host ""
    Write-Host "This runs: cdk deploy --all --context client=$Client --context env=prod" -ForegroundColor Yellow
    Write-Host "Target account is defined in config/clients/$Client/config.json (aws.accountId)." -ForegroundColor Yellow
    Write-Host "Ensure AWS_PROFILE or credentials point at that account before continuing." -ForegroundColor Yellow
    Write-Host ""
    $answer = Read-Host "Type PRODUCTION to continue, or anything else to abort"
    if ($answer -cne "PRODUCTION") {
        Write-Host "Aborted." -ForegroundColor Gray
        exit 0
    }
}

& "$PSScriptRoot\deploy-all.ps1" -Env prod -Client $Client
