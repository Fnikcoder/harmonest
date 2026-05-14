# PowerShell script to configure Cognito Identity Pool role mappings
$profile = "harmonestadmin"
$identityPoolId = "eu-central-1:434a4973-03f1-4074-929b-de185a7cd4ac"
$userPoolId = "eu-central-1_oOMDUFanW"
$userPoolClientId = "4jm7vgta4tc7r5chltr4eb4kqj"

Write-Host "🔧 Configuring Cognito Identity Pool role mappings..." -ForegroundColor Green
Write-Host ""

# Get IAM role ARNs
Write-Host "📋 Getting IAM role ARNs..." -ForegroundColor Yellow

$ownerRoleArn = aws iam get-role --role-name "harmonest-prod-owner-role" --query "Role.Arn" --output text --profile $profile
$superAdminRoleArn = aws iam get-role --role-name "harmonest-prod-super-admin-role" --query "Role.Arn" --output text --profile $profile
$adminRoleArn = aws iam get-role --role-name "harmonest-prod-admin-role" --query "Role.Arn" --output text --profile $profile
$supportRoleArn = aws iam get-role --role-name "harmonest-prod-support-role" --query "Role.Arn" --output text --profile $profile
$guestRoleArn = aws iam get-role --role-name "harmonest-prod-guest-role" --query "Role.Arn" --output text --profile $profile

Write-Host "✅ Owner Role: $ownerRoleArn" -ForegroundColor Green
Write-Host "✅ Super Admin Role: $superAdminRoleArn" -ForegroundColor Green
Write-Host "✅ Admin Role: $adminRoleArn" -ForegroundColor Green
Write-Host "✅ Support Role: $supportRoleArn" -ForegroundColor Green
Write-Host "✅ Guest Role: $guestRoleArn" -ForegroundColor Green
Write-Host ""

# Create role mapping JSON
$providerName = "cognito-idp.eu-central-1.amazonaws.com/$userPoolId`:$userPoolClientId"

$roleMappingJson = @"
{
  "IdentityPoolId": "$identityPoolId",
  "Roles": {
    "authenticated": "$guestRoleArn"
  },
  "RoleMappings": {
    "$providerName": {
      "Type": "Rules",
      "AmbiguousRoleResolution": "AuthenticatedRole",
      "RulesConfiguration": {
        "Rules": [
          {
            "Claim": "cognito:groups",
            "MatchType": "Equals",
            "Value": "owner",
            "RoleARN": "$ownerRoleArn"
          },
          {
            "Claim": "cognito:groups",
            "MatchType": "Equals",
            "Value": "super_admin",
            "RoleARN": "$superAdminRoleArn"
          },
          {
            "Claim": "cognito:groups",
            "MatchType": "Equals",
            "Value": "admin",
            "RoleARN": "$adminRoleArn"
          },
          {
            "Claim": "cognito:groups",
            "MatchType": "Equals",
            "Value": "support",
            "RoleARN": "$supportRoleArn"
          }
        ]
      }
    }
  }
}
"@

# Save to temporary file
$tempFile = "role-mapping-config.json"
$roleMappingJson | Out-File -FilePath $tempFile -Encoding UTF8

Write-Host "🔧 Applying role mappings..." -ForegroundColor Yellow

# Apply role mappings
try {
    aws cognito-identity set-identity-pool-roles --cli-input-json file://$tempFile --profile $profile
    Write-Host "✅ Role mappings configured successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to configure role mappings: $_" -ForegroundColor Red
}

# Clean up temporary file
Remove-Item $tempFile -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "🎉 Configuration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Role mappings configured:" -ForegroundColor Yellow
Write-Host "- owner group -> Owner IAM role (full access)"
Write-Host "- super_admin group -> Super Admin IAM role (full access)"
Write-Host "- admin group -> Admin IAM role (limited access)"
Write-Host "- support group -> Support IAM role (read-only)"
Write-Host "- Default -> Guest IAM role (own data only)"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Test with different user roles"
Write-Host "2. Verify permissions work as expected"
Write-Host "3. Check CloudTrail logs for access patterns"
