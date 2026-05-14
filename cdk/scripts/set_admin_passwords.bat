@echo off
echo Setting admin user passwords...
echo.

REM Get User Pool ID from CloudFormation stack
echo Getting User Pool ID...
for /f "tokens=*" %%i in ('aws cloudformation describe-stack-resources --profile harmonestadmin --region eu-central-1 --stack-name HarmonestUserManagement-prod --query "StackResources[?ResourceType==`AWS::Cognito::UserPool`].PhysicalResourceId" --output text') do set USER_POOL_ID=%%i

echo User Pool ID: %USER_POOL_ID%
echo.

REM Set password for support@harmonest.de
echo Setting password for support@harmonest.de...
aws cognito-idp admin-set-user-password --profile harmonestadmin --region eu-central-1 --user-pool-id %USER_POOL_ID% --username support@harmonest.de --password "HarmoNest2024!" --permanent

REM Set password for fnikcoder@gmail.com  
echo Setting password for fnikcoder@gmail.com...
aws cognito-idp admin-set-user-password --profile harmonestadmin --region eu-central-1 --user-pool-id %USER_POOL_ID% --username fnikcoder@gmail.com --password "HarmoNest2024!" --permanent

echo.
echo ✅ Admin passwords have been set!
echo.
echo 📋 Login Information:
echo - User Pool ID: %USER_POOL_ID%
echo - support@harmonest.de (admin): HarmoNest2024!
echo - fnikcoder@gmail.com (super_admin): HarmoNest2024!
echo.
echo 🌐 API Gateway Endpoint:
echo   https://8y8k22wgzj.execute-api.eu-central-1.amazonaws.com/prod/
echo.
pause
