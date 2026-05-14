@echo off
echo Getting frontend configuration...
echo.

REM Get User Pool ID
echo Getting User Pool ID...
for /f "tokens=*" %%i in ('aws cloudformation describe-stack-resources --profile harmonestadmin --region eu-central-1 --stack-name HarmonestUserManagement-prod --query "StackResources[?ResourceType==`AWS::Cognito::UserPool`].PhysicalResourceId" --output text') do set USER_POOL_ID=%%i

REM Get User Pool Client ID
echo Getting User Pool Client ID...
for /f "tokens=*" %%i in ('aws cloudformation describe-stack-resources --profile harmonestadmin --region eu-central-1 --stack-name HarmonestUserManagement-prod --query "StackResources[?ResourceType==`AWS::Cognito::UserPoolClient`].PhysicalResourceId" --output text') do set CLIENT_ID=%%i

REM Get Identity Pool ID
echo Getting Identity Pool ID...
for /f "tokens=*" %%i in ('aws cloudformation describe-stack-resources --profile harmonestadmin --region eu-central-1 --stack-name HarmonestUserManagement-prod --query "StackResources[?ResourceType==`AWS::Cognito::IdentityPool`].PhysicalResourceId" --output text') do set IDENTITY_POOL_ID=%%i

REM Get API Gateway URL
echo Getting API Gateway URL...
for /f "tokens=*" %%i in ('aws cloudformation describe-stacks --profile harmonestadmin --region eu-central-1 --stack-name HarmonestUserManagement-prod --query "Stacks[0].Outputs[?OutputKey==`UserManagementApiprodEndpoint1D1F5C5C`].OutputValue" --output text') do set API_URL=%%i

echo.
echo ========================================
echo 🔐 FRONTEND CONFIGURATION
echo ========================================
echo.
echo 📋 AWS Cognito Configuration:
echo {
echo   "userPoolId": "%USER_POOL_ID%",
echo   "userPoolWebClientId": "%CLIENT_ID%",
echo   "region": "eu-central-1",
echo   "identityPoolId": "%IDENTITY_POOL_ID%"
echo }
echo.
echo 🌐 API Configuration:
echo {
echo   "apiGatewayUrl": "%API_URL%",
echo   "region": "eu-central-1"
echo }
echo.
echo 👥 Test Admin Credentials:
echo {
echo   "admin": {
echo     "email": "support@harmonest.de",
echo     "password": "HarmoNest2024!",
echo     "role": "admin"
echo   },
echo   "superAdmin": {
echo     "email": "fnikcoder@gmail.com", 
echo     "password": "HarmoNest2024!",
echo     "role": "super_admin"
echo   }
echo }
echo.
echo 🔗 OAuth Callback URLs (already configured):
echo - https://harmonest.de/auth/callback
echo - https://www.harmonest.de/auth/callback
echo - https://dev.harmonest.de/auth/callback
echo - http://localhost:4200/auth/callback
echo.
echo 🚪 OAuth Logout URLs (already configured):
echo - https://harmonest.de/auth/logout
echo - https://www.harmonest.de/auth/logout
echo - https://dev.harmonest.de/auth/logout
echo - http://localhost:4200/auth/logout
echo.
echo ========================================
echo.
pause
