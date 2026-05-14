# Deploy all Harmonest CDK stacks (Guesty layer + Lambdas + deps).
# Requires AWS credentials (e.g. set AWS_PROFILE to the profile in client JSON, e.g. harmonestadmin).
param(
    [ValidateSet("dev", "staging", "prod")]
    [string]$Env = "dev",
    [string]$Client = "harmonest",
    # Use only for local synth without Docker; do NOT use for real deploys (layer wheels must be Linux).
    [switch]$SkipLayerDocker
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path .venv)) {
    python -m venv .venv
}
& .\.venv\Scripts\pip.exe install -q -r requirements.txt

$env:Path = "$PWD\.venv\Scripts;" + $env:Path

Write-Host "Deploying client=$Client env=$Env (ensure AWS credentials / profile are set)" -ForegroundColor Cyan
if ($SkipLayerDocker) {
    Write-Host "WARNING: skipLayerDocker=true - layer zip may be wrong for Lambda. Use Docker for prod/CI." -ForegroundColor Yellow
}

$ctxArgs = @(
    "--context", "client=$Client",
    "--context", "env=$Env"
)
if ($SkipLayerDocker) {
    $ctxArgs += @("--context", "skipLayerDocker=true")
}

npx --yes aws-cdk@2.147.0 deploy --all @ctxArgs --require-approval never
