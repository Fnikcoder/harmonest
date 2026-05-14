#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuthStack } from '../lib/stacks/auth-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { MessagingStack } from '../lib/stacks/messaging-stack';
import { CdnStack } from '../lib/stacks/cdn-stack';
import { getEnvironmentConfig } from '../lib/config/environments';
import { RESOURCE_TAGS } from '../lib/config/constants';

const app = new cdk.App();

// Get environment from context
const environment = app.node.tryGetContext('environment') || 'dev';
const config = getEnvironmentConfig(environment);

// Define the AWS environment
const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: config.region,
};

// Common stack props
const commonProps = {
  env,
  config,
  tags: {
    ...RESOURCE_TAGS,
    Environment: config.environment,
  },
};

// Create stacks in dependency order
const authStack = new AuthStack(app, `Harmonest-${config.environment}-Auth`, {
  ...commonProps,
  description: `Authentication stack for Harmonest ${config.environment} environment`,
});

const storageStack = new StorageStack(app, `Harmonest-${config.environment}-Storage`, {
  ...commonProps,
  description: `Storage stack for Harmonest ${config.environment} environment`,
});

const messagingStack = new MessagingStack(app, `Harmonest-${config.environment}-Messaging`, {
  ...commonProps,
  description: `Messaging stack for Harmonest ${config.environment} environment`,
});

const apiStack = new ApiStack(app, `Harmonest-${config.environment}-Api`, {
  ...commonProps,
  userPool: authStack.userPool,
  identityPool: authStack.identityPool,
  dynamoTable: storageStack.dynamoTable,
  s3Bucket: storageStack.s3Bucket,
  emailQueue: messagingStack.emailQueue,
  smsQueue: messagingStack.smsQueue,
  bookingTopic: messagingStack.bookingTopic,
  paymentTopic: messagingStack.paymentTopic,
  description: `API stack for Harmonest ${config.environment} environment`,
});

const cdnStack = new CdnStack(app, `Harmonest-${config.environment}-Cdn`, {
  ...commonProps,
  s3Bucket: storageStack.s3Bucket,
  apiGateway: apiStack.restApi,
  description: `CDN stack for Harmonest ${config.environment} environment`,
});

// Add dependencies
storageStack.addDependency(authStack);
apiStack.addDependency(authStack);
apiStack.addDependency(storageStack);
apiStack.addDependency(messagingStack);
cdnStack.addDependency(storageStack);
cdnStack.addDependency(apiStack);

// Output important information
new cdk.CfnOutput(authStack, 'UserPoolId', {
  value: authStack.userPool.userPoolId,
  description: 'Cognito User Pool ID',
  exportName: `Harmonest-${config.environment}-UserPoolId`,
});

new cdk.CfnOutput(authStack, 'UserPoolClientId', {
  value: authStack.userPoolClient.userPoolClientId,
  description: 'Cognito User Pool Client ID',
  exportName: `Harmonest-${config.environment}-UserPoolClientId`,
});

new cdk.CfnOutput(authStack, 'IdentityPoolId', {
  value: authStack.identityPool.attrId,
  description: 'Cognito Identity Pool ID',
  exportName: `Harmonest-${config.environment}-IdentityPoolId`,
});

new cdk.CfnOutput(storageStack, 'DynamoTableName', {
  value: storageStack.dynamoTable.tableName,
  description: 'DynamoDB Table Name',
  exportName: `Harmonest-${config.environment}-DynamoTableName`,
});

new cdk.CfnOutput(storageStack, 'S3BucketName', {
  value: storageStack.s3Bucket.bucketName,
  description: 'S3 Bucket Name',
  exportName: `Harmonest-${config.environment}-S3BucketName`,
});

new cdk.CfnOutput(apiStack, 'ApiGatewayUrl', {
  value: apiStack.restApi.url,
  description: 'API Gateway URL',
  exportName: `Harmonest-${config.environment}-ApiGatewayUrl`,
});

if (cdnStack.distribution) {
  new cdk.CfnOutput(cdnStack, 'CloudFrontDistributionId', {
    value: cdnStack.distribution.distributionId,
    description: 'CloudFront Distribution ID',
    exportName: `Harmonest-${config.environment}-CloudFrontDistributionId`,
  });

  new cdk.CfnOutput(cdnStack, 'CloudFrontDomainName', {
    value: cdnStack.distribution.distributionDomainName,
    description: 'CloudFront Distribution Domain Name',
    exportName: `Harmonest-${config.environment}-CloudFrontDomainName`,
  });
}
