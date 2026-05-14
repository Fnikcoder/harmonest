try {
    $response = Invoke-RestMethod -Uri 'https://k5ackrx9ga.execute-api.eu-central-1.amazonaws.com/prod/email-verification' -Method POST -ContentType 'application/json' -Body '{"operation":"send-verification-email","email":"fnikcoder@gmail.com","type":"checkin"}'
    Write-Host "Success:"
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error occurred:"
    Write-Host "Status Code:" $_.Exception.Response.StatusCode
    Write-Host "Status Description:" $_.Exception.Response.StatusDescription
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body:" $responseBody
        $reader.Close()
    }
    
    Write-Host "Full Exception:" $_.Exception.Message
}
