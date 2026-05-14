# Fix user group assignments for Cognito users
$profile = "harmonestadmin"
$userPoolId = "eu-central-1_oOMDUFanW"

Write-Host "Checking and fixing user group assignments..." -ForegroundColor Green

# Check support@harmonest.de groups
Write-Host "`nChecking support@harmonest.de groups..." -ForegroundColor Yellow
try {
    $supportGroups = aws cognito-idp admin-list-groups-for-user --user-pool-id $userPoolId --username "support@harmonest.de" --profile $profile --output json | ConvertFrom-Json
    Write-Host "Current groups for support@harmonest.de:" -ForegroundColor Cyan
    if ($supportGroups.Groups) {
        $supportGroups.Groups | ForEach-Object { Write-Host "  - $($_.GroupName)" }
    } else {
        Write-Host "  No groups assigned" -ForegroundColor Red
    }
} catch {
    Write-Host "User support@harmonest.de not found or error occurred" -ForegroundColor Red
}

# Check fnikcoder@gmail.com groups  
Write-Host "`nChecking fnikcoder@gmail.com groups..." -ForegroundColor Yellow
try {
    $superAdminGroups = aws cognito-idp admin-list-groups-for-user --user-pool-id $userPoolId --username "fnikcoder@gmail.com" --profile $profile --output json | ConvertFrom-Json
    Write-Host "Current groups for fnikcoder@gmail.com:" -ForegroundColor Cyan
    if ($superAdminGroups.Groups) {
        $superAdminGroups.Groups | ForEach-Object { Write-Host "  - $($_.GroupName)" }
    } else {
        Write-Host "  No groups assigned" -ForegroundColor Red
    }
} catch {
    Write-Host "User fnikcoder@gmail.com not found or error occurred" -ForegroundColor Red
}

# List all available groups
Write-Host "`nAvailable groups in user pool:" -ForegroundColor Yellow
try {
    $allGroups = aws cognito-idp list-groups --user-pool-id $userPoolId --profile $profile --output json | ConvertFrom-Json
    $allGroups.Groups | ForEach-Object { 
        Write-Host "  - $($_.GroupName): $($_.Description)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "Failed to list groups" -ForegroundColor Red
}

# Fix group assignments
Write-Host "`nFixing group assignments..." -ForegroundColor Green

# Add support@harmonest.de to admin group
Write-Host "Adding support@harmonest.de to admin group..." -ForegroundColor Yellow
try {
    aws cognito-idp admin-add-user-to-group --user-pool-id $userPoolId --username "support@harmonest.de" --group-name "admin" --profile $profile
    Write-Host "✅ Added support@harmonest.de to admin group" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to add support@harmonest.de to admin group" -ForegroundColor Red
}

# Add fnikcoder@gmail.com to super_admin group
Write-Host "Adding fnikcoder@gmail.com to super_admin group..." -ForegroundColor Yellow
try {
    aws cognito-idp admin-add-user-to-group --user-pool-id $userPoolId --username "fnikcoder@gmail.com" --group-name "super_admin" --profile $profile
    Write-Host "✅ Added fnikcoder@gmail.com to super_admin group" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to add fnikcoder@gmail.com to super_admin group" -ForegroundColor Red
}

# Verify the changes
Write-Host "`nVerifying changes..." -ForegroundColor Green

Write-Host "`nFinal groups for support@harmonest.de:" -ForegroundColor Yellow
try {
    $supportGroupsAfter = aws cognito-idp admin-list-groups-for-user --user-pool-id $userPoolId --username "support@harmonest.de" --profile $profile --output json | ConvertFrom-Json
    if ($supportGroupsAfter.Groups) {
        $supportGroupsAfter.Groups | ForEach-Object { Write-Host "  - $($_.GroupName)" -ForegroundColor Green }
    } else {
        Write-Host "  No groups assigned" -ForegroundColor Red
    }
} catch {
    Write-Host "Error checking groups" -ForegroundColor Red
}

Write-Host "`nFinal groups for fnikcoder@gmail.com:" -ForegroundColor Yellow
try {
    $superAdminGroupsAfter = aws cognito-idp admin-list-groups-for-user --user-pool-id $userPoolId --username "fnikcoder@gmail.com" --profile $profile --output json | ConvertFrom-Json
    if ($superAdminGroupsAfter.Groups) {
        $superAdminGroupsAfter.Groups | ForEach-Object { Write-Host "  - $($_.GroupName)" -ForegroundColor Green }
    } else {
        Write-Host "  No groups assigned" -ForegroundColor Red
    }
} catch {
    Write-Host "Error checking groups" -ForegroundColor Red
}

Write-Host "`n🎉 User group assignment complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Users need to sign out and sign back in for group changes to take effect"
Write-Host "2. Test the DynamoDB access again"
Write-Host "3. Check that the correct IAM role is being assumed"
