# Deploy all Harmonest CDK stacks (Guesty layer + Lambdas + deps).
# Requires AWS credentials (e.g. set AWS_PROFILE to the profile in client JSON, e.g. harmonestadmin).
param(
    [ValidateSet("dev", "staging", "prod")]
    [string]$Env = "dev",
    [string]$Client = "harmonest"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path .venv)) {
    python -m venv .venv
}
& .\.venv\Scripts\pip.exe install -q -r requirements.txt

$env:Path = "$PWD\.venv\Scripts;" + $env:Path

Write-Host "Deploying client=$Client env=$Env (ensure AWS credentials / profile are set)" -ForegroundColor Cyan

npx --yes aws-cdk@2.147.0 deploy --all `
    --context client=$Client `
    --context env=$Env `
    --require-approval never
