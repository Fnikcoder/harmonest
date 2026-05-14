# Simple test to send verification email
$API_BASE_URL = "https://179a2g0pgk.execute-api.eu-central-1.amazonaws.com/prod"
$TEST_EMAIL = "support@harmonest.de"

Write-Host "🚀 Testing Send Verification Email" -ForegroundColor Green
Write-Host "Email: $TEST_EMAIL"
Write-Host "API: $API_BASE_URL/email-verification"
Write-Host ""

$payload = @{
    operation = "send-verification-email"
    email = $TEST_EMAIL
    type = "checkin"
} | ConvertTo-Json

Write-Host "Payload:" -ForegroundColor Yellow
Write-Host $payload
Write-Host ""

try {
    Write-Host "Sending request..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri "$API_BASE_URL/email-verification" -Method Post -ContentType "application/json" -Body $payload

    Write-Host "SUCCESS!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10 | Write-Host

    if ($response.success) {
        Write-Host ""
        Write-Host "Email should be sent to: $TEST_EMAIL" -ForegroundColor Green
        Write-Host "Code expires in: $($response.data.expiresInMinutes) minutes" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Check your email for the verification code!" -ForegroundColor Cyan
    }

} catch {
    Write-Host "FAILED!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red

    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Yellow
    }
}
