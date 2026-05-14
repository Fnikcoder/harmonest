@echo off
echo Checking Cognito User Pool setup...
echo.

set USER_POOL_ID=eu-central-1_oOMDUFanW
set AWS_PROFILE=harmonestadmin

echo 1. Listing all users in the User Pool:
aws cognito-idp list-users --user-pool-id %USER_POOL_ID% --profile %AWS_PROFILE% --output table --query "Users[*].[Username,UserStatus,Enabled]"

echo.
echo 2. Listing all groups in the User Pool:
aws cognito-idp list-groups --user-pool-id %USER_POOL_ID% --profile %AWS_PROFILE% --output table --query "Groups[*].[GroupName,Description,Precedence]"

echo.
echo 3. If you need to create a super_admin user, run:
echo aws cognito-idp admin-create-user --user-pool-id %USER_POOL_ID% --username "your-email@example.com" --user-attributes Name=email,Value="your-email@example.com" Name=email_verified,Value=true --temporary-password "TempPass123!" --message-action SUPPRESS --profile %AWS_PROFILE%

echo.
echo 4. If you need to add user to super_admin group, run:
echo aws cognito-idp admin-add-user-to-group --user-pool-id %USER_POOL_ID% --username "your-email@example.com" --group-name "super_admin" --profile %AWS_PROFILE%

echo.
echo 5. To check groups for a specific user, run:
echo aws cognito-idp admin-list-groups-for-user --user-pool-id %USER_POOL_ID% --username "your-email@example.com" --profile %AWS_PROFILE%

pause
