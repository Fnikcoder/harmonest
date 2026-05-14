# PowerShell script to test Email Verification API
# Usage: .\test_email_verification.ps1

$API_BASE_URL = "https://179a2g0pgk.execute-api.eu-central-1.amazonaws.com/prod"
$TEST_EMAIL = "test@harmonest.de"

Write-Host "🚀 Starting Email Verification API Tests" -ForegroundColor Green
Write-Host "=" * 50

# Test 1: Send verification email
Write-Host "`n📧 Test 1: Send Verification Email" -ForegroundColor Yellow
Write-Host "Testing send verification email to: $TEST_EMAIL"

$sendPayload = @{
    operation = "send-verification-email"
    email = $TEST_EMAIL
    type = "checkin"
} | ConvertTo-Json

try {
    $sendResponse = Invoke-RestMethod -Uri "$API_BASE_URL/email-verification" -Method Post -ContentType "application/json" -Body $sendPayload
    
    if ($sendResponse.success) {
        Write-Host "✅ Send verification email: SUCCESS" -ForegroundColor Green
        Write-Host "   Message: $($sendResponse.message)"
        Write-Host "   Expires in: $($sendResponse.data.expiresInMinutes) minutes"
    } else {
        Write-Host "❌ Send verification email: FAILED" -ForegroundColor Red
        Write-Host "   Error: $($sendResponse.message)"
        Write-Host "   Error Code: $($sendResponse.errorCode)"
    }
} catch {
    Write-Host "❌ Send verification email: EXCEPTION" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)"
    
    # Try to get more details from the response
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody"
    }
}

# Test 2: Verify with wrong code
Write-Host "`n🔐 Test 2: Verify with Wrong Code" -ForegroundColor Yellow

$verifyPayload = @{
    operation = "verify-email-code"
    email = $TEST_EMAIL
    verificationCode = "000000"
    type = "checkin"
} | ConvertTo-Json

try {
    $verifyResponse = Invoke-RestMethod -Uri "$API_BASE_URL/email-verification" -Method Post -ContentType "application/json" -Body $verifyPayload
    
    if ($verifyResponse.success) {
        Write-Host "❌ Verify wrong code: UNEXPECTED SUCCESS" -ForegroundColor Red
        Write-Host "   This should have failed!"
    } else {
        Write-Host "✅ Verify wrong code: CORRECTLY FAILED" -ForegroundColor Green
        Write-Host "   Error: $($verifyResponse.message)"
        Write-Host "   Error Code: $($verifyResponse.errorCode)"
    }
} catch {
    Write-Host "✅ Verify wrong code: CORRECTLY FAILED (Exception)" -ForegroundColor Green
    Write-Host "   Error: $($_.Exception.Message)"
}

# Test 3: Test invalid operation
Write-Host "`n❌ Test 3: Invalid Operation" -ForegroundColor Yellow

$invalidPayload = @{
    operation = "invalid-operation"
    email = $TEST_EMAIL
} | ConvertTo-Json

try {
    $invalidResponse = Invoke-RestMethod -Uri "$API_BASE_URL/email-verification" -Method Post -ContentType "application/json" -Body $invalidPayload
    
    if ($invalidResponse.errorCode -eq "INVALID_OPERATION") {
        Write-Host "✅ Invalid operation handling: SUCCESS" -ForegroundColor Green
    } else {
        Write-Host "❌ Invalid operation handling: FAILED" -ForegroundColor Red
        Write-Host "   Expected INVALID_OPERATION, got: $($invalidResponse.errorCode)"
    }
} catch {
    Write-Host "✅ Invalid operation handling: SUCCESS (Exception)" -ForegroundColor Green
    Write-Host "   Error: $($_.Exception.Message)"
}

# Test 4: Test CORS preflight
Write-Host "`n🌐 Test 4: CORS Preflight" -ForegroundColor Yellow

try {
    $corsResponse = Invoke-WebRequest -Uri "$API_BASE_URL/email-verification" -Method Options -Headers @{
        "Origin" = "https://harmonest.de"
        "Access-Control-Request-Method" = "POST"
        "Access-Control-Request-Headers" = "Content-Type"
    }
    
    if ($corsResponse.StatusCode -eq 200) {
        Write-Host "✅ CORS preflight: SUCCESS" -ForegroundColor Green
        Write-Host "   Status Code: $($corsResponse.StatusCode)"
        
        $allowOrigin = $corsResponse.Headers["Access-Control-Allow-Origin"]
        $allowMethods = $corsResponse.Headers["Access-Control-Allow-Methods"]
        
        if ($allowOrigin) {
            Write-Host "   Access-Control-Allow-Origin: $allowOrigin"
        }
        if ($allowMethods) {
            Write-Host "   Access-Control-Allow-Methods: $allowMethods"
        }
    } else {
        Write-Host "❌ CORS preflight: FAILED" -ForegroundColor Red
        Write-Host "   Status Code: $($corsResponse.StatusCode)"
    }
} catch {
    Write-Host "❌ CORS preflight: EXCEPTION" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)"
}

Write-Host "`n" + "=" * 50
Write-Host "✅ Email Verification API Tests Completed" -ForegroundColor Green

Write-Host "`n📝 Notes:" -ForegroundColor Cyan
Write-Host "   - If you see 'MessageRejected' errors, the harmonest.de domain needs to be verified in SES"
Write-Host "   - Check AWS SES Console to verify domain status"
Write-Host "   - For production testing, ensure SES is out of sandbox mode"
Write-Host "   - Check CloudWatch logs for detailed error information"

Write-Host "`n🔗 Useful Links:" -ForegroundColor Cyan
Write-Host "   - SES Console: https://console.aws.amazon.com/ses/"
Write-Host "   - CloudWatch Logs: https://console.aws.amazon.com/cloudwatch/home?region=eu-central-1#logsV2:log-groups/log-group/%2Faws%2Flambda%2Fharmonest-prod-lambda_email_verification"
Write-Host "   - API Gateway: https://console.aws.amazon.com/apigateway/main/apis/179a2g0pgk/resources"
