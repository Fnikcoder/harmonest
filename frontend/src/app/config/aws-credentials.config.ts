// DEPRECATED: This file is deprecated. Use ConfigService instead.
// All AWS configuration is now centralized in master-config.json

import { Injectable } from '@angular/core';
import { ConfigService } from '../services/config.service';

/**
 * AWS Credentials Configuration for Cognito Admin Operations
 *
 * IMPORTANT: For security reasons, never hardcode AWS credentials in your frontend code.
 * This configuration is for development purposes only.
 *
 * For production, use one of these secure methods:
 * 1. AWS IAM roles (recommended for EC2/Lambda)
 * 2. AWS Cognito Identity Pool with proper permissions
 * 3. AWS STS temporary credentials
 * 4. Environment variables (for server-side applications)
 */

export interface AWSCredentialsConfig {
  region: string;
  // Add other configuration as needed
}

@Injectable({
  providedIn: 'root'
})
export class AWSCredentialsConfigService {
  constructor(private configService: ConfigService) {}

  getAWSCredentialsConfig(): AWSCredentialsConfig {
    const config = this.configService.getConfig();
    return {
      region: config?.technical?.aws?.region || 'eu-central-1'
    };
  }
}

// Legacy export - deprecated
export const awsCredentialsConfig: AWSCredentialsConfig = {
  region: 'eu-central-1', // fallback value
};

/**
 * Instructions for setting up AWS credentials for development:
 *
 * 1. Install AWS CLI: https://aws.amazon.com/cli/
 * 2. Configure AWS CLI with your credentials:
 *    aws configure --profile harmonestadmin
 * 3. Set the following environment variables in your system:
 *    - AWS_PROFILE=harmonestadmin
 *    - AWS_REGION=eu-central-1
 *
 * 4. Ensure your AWS user/role has the following permissions:
 *    - cognito-idp:ListUsers
 *    - cognito-idp:AdminGetUser
 *    - cognito-idp:AdminCreateUser
 *    - cognito-idp:AdminUpdateUserAttributes
 *    - cognito-idp:AdminDeleteUser
 *    - cognito-idp:AdminEnableUser
 *    - cognito-idp:AdminDisableUser
 *    - cognito-idp:AdminSetUserPassword
 *
 * 5. For production deployment, use AWS IAM roles or Cognito Identity Pool
 *    with appropriate permissions instead of hardcoded credentials.
 */

/**
 * Sample IAM Policy for Cognito User Management:
 *
 * {
 *   "Version": "2012-10-17",
 *   "Statement": [
 *     {
 *       "Effect": "Allow",
 *       "Action": [
 *         "cognito-idp:ListUsers",
 *         "cognito-idp:AdminGetUser",
 *         "cognito-idp:AdminCreateUser",
 *         "cognito-idp:AdminUpdateUserAttributes",
 *         "cognito-idp:AdminDeleteUser",
 *         "cognito-idp:AdminEnableUser",
 *         "cognito-idp:AdminDisableUser",
 *         "cognito-idp:AdminSetUserPassword"
 *       ],
 *       "Resource": "arn:aws:cognito-idp:eu-central-1:*:userpool/eu-central-1_3nRWgJleG"
 *     }
 *   ]
 * }
 */
