# Simple verification test
$API_BASE_URL = "https://179a2g0pgk.execute-api.eu-central-1.amazonaws.com/prod"
$TEST_EMAIL = "support@harmonest.de"
$VERIFICATION_CODE = "724289"

Write-Host "Testing Email Verification Code" -ForegroundColor Green
Write-Host "Email: $TEST_EMAIL"
Write-Host "Code: $VERIFICATION_CODE"
Write-Host ""

$payload = @{
    operation = "verify-email-code"
    email = $TEST_EMAIL
    verificationCode = $VERIFICATION_CODE
    type = "checkin"
} | ConvertTo-Json

Write-Host "Payload:" -ForegroundColor Yellow
Write-Host $payload
Write-Host ""

try {
    Write-Host "Verifying code..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri "$API_BASE_URL/email-verification" -Method Post -ContentType "application/json" -Body $payload
    
    Write-Host "SUCCESS!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10 | Write-Host
    
    if ($response.success) {
        Write-Host ""
        Write-Host "Email verified successfully!" -ForegroundColor Green
        Write-Host "Verified at: $($response.data.verifiedAt)" -ForegroundColor Yellow
    } else {
        Write-Host ""
        Write-Host "Verification failed: $($response.message)" -ForegroundColor Red
        Write-Host "Error code: $($response.errorCode)" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "FAILED!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
