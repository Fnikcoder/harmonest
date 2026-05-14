import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import { LAMBDA_FUNCTIONS, API_PATHS } from '../config/constants';

export interface ApiStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  userPool: cognito.UserPool;
  identityPool: cognito.CfnIdentityPool;
  dynamoTable: dynamodb.Table;
  s3Bucket: s3.Bucket;
  emailQueue: sqs.Queue;
  smsQueue: sqs.Queue;
  bookingTopic: sns.Topic;
  paymentTopic: sns.Topic;
}

export class ApiStack extends cdk.Stack {
  public readonly restApi: apigateway.RestApi;
  public readonly authorizer: apigateway.CognitoUserPoolsAuthorizer;
  public readonly lambdaFunctions: Record<string, lambda.Function> = {};

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { config, userPool, dynamoTable, s3Bucket, emailQueue, smsQueue, bookingTopic, paymentTopic } = props;

    // Create API Gateway
    this.restApi = new apigateway.RestApi(this, 'RestApi', {
      restApiName: config.apiGateway.restApiName,
      description: config.apiGateway.description,
      defaultCorsPreflightOptions: {
        allowOrigins: [
          `https://${config.domainName}`,
          'http://localhost:4200',
        ],
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Amz-User-Agent',
        ],
        allowCredentials: true,
      },
      deployOptions: {
        stageName: config.apiGateway.deployOptions.stageName,
        throttlingRateLimit: config.apiGateway.deployOptions.throttleRateLimit,
        throttlingBurstLimit: config.apiGateway.deployOptions.throttleBurstLimit,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      cloudWatchRole: true,
    });

    // Create Cognito Authorizer
    this.authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: `${config.appName}-${config.environment}-authorizer`,
      identitySource: 'method.request.header.Authorization',
    });

    // Create common Lambda execution role
    const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
      roleName: `${config.appName}-${config.environment}-lambda-execution-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
                'dynamodb:Scan',
                'dynamodb:BatchGetItem',
                'dynamodb:BatchWriteItem',
              ],
              resources: [
                dynamoTable.tableArn,
                `${dynamoTable.tableArn}/index/*`,
              ],
            }),
          ],
        }),
        S3Access: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:GetObjectVersion',
              ],
              resources: [`${s3Bucket.bucketArn}/*`],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:ListBucket',
              ],
              resources: [s3Bucket.bucketArn],
            }),
          ],
        }),
        CognitoAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cognito-idp:AdminGetUser',
                'cognito-idp:AdminUpdateUserAttributes',
                'cognito-idp:AdminCreateUser',
                'cognito-idp:AdminDeleteUser',
                'cognito-idp:ListUsers',
                'cognito-idp:AdminListGroupsForUser',
                'cognito-idp:AdminAddUserToGroup',
                'cognito-idp:AdminRemoveUserFromGroup',
              ],
              resources: [userPool.userPoolArn],
            }),
          ],
        }),
        SQSAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'sqs:SendMessage',
                'sqs:ReceiveMessage',
                'sqs:DeleteMessage',
                'sqs:GetQueueAttributes',
              ],
              resources: [
                emailQueue.queueArn,
                smsQueue.queueArn,
              ],
            }),
          ],
        }),
        SNSAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'sns:Publish',
              ],
              resources: [
                bookingTopic.topicArn,
                paymentTopic.topicArn,
              ],
            }),
          ],
        }),
      },
    });

    // Common Lambda environment variables
    const commonEnvironment = {
      ...config.lambda.environment,
      DYNAMODB_TABLE_NAME: dynamoTable.tableName,
      S3_BUCKET_NAME: s3Bucket.bucketName,
      USER_POOL_ID: userPool.userPoolId,
      EMAIL_QUEUE_URL: emailQueue.queueUrl,
      SMS_QUEUE_URL: smsQueue.queueUrl,
      BOOKING_TOPIC_ARN: bookingTopic.topicArn,
      PAYMENT_TOPIC_ARN: paymentTopic.topicArn,
      REGION: config.region,
    };

    // Create minimal Lambda functions (only for operations requiring secret credentials)
    this.createEssentialLambdas(lambdaExecutionRole, commonEnvironment, config);

    // Create API Gateway resources and methods (minimal set)
    this.createApiResources();

    // Add tags to resources
    cdk.Tags.of(this.restApi).add('ResourceType', 'API');
    Object.values(this.lambdaFunctions).forEach(func => {
      cdk.Tags.of(func).add('ResourceType', 'Lambda');
    });
  }

  private createEssentialLambdas(role: iam.Role, environment: Record<string, string>, config: EnvironmentConfig) {
    // Only create Lambda functions for operations that require secret credentials
    const essentialFunctions = [
      LAMBDA_FUNCTIONS.CHECKIN_GENERATE_QR,    // QR code generation with 3rd party API
      LAMBDA_FUNCTIONS.PAYMENT_PROCESS,        // Payment processing with secret keys
      LAMBDA_FUNCTIONS.PAYMENT_WEBHOOK,        // Payment webhook handling
      LAMBDA_FUNCTIONS.PAYMENT_REFUND,         // Payment refund processing
      LAMBDA_FUNCTIONS.NOTIFICATION_SEND_EMAIL, // Optional: if using 3rd party email service
      LAMBDA_FUNCTIONS.NOTIFICATION_SEND_SMS,   // Optional: if using 3rd party SMS service
      LAMBDA_FUNCTIONS.AUTH_POST_CONFIRMATION,  // Optional: Cognito trigger for user creation
    ];

    essentialFunctions.forEach(funcName => {
      // Add environment variables specific to each function
      const functionEnvironment = {
        ...environment,
        ...(funcName === LAMBDA_FUNCTIONS.CHECKIN_GENERATE_QR && {
          QR_API_KEY: 'your-qr-api-key', // Replace with actual secret from AWS Secrets Manager
          QR_API_URL: 'https://api.qr-server.com/v1/create-qr-code/', // Example QR API
        }),
        ...(funcName.includes('payment') && {
          STRIPE_SECRET_KEY: 'your-stripe-secret-key', // Replace with actual secret
          PAYPAL_CLIENT_SECRET: 'your-paypal-secret', // Replace with actual secret
        }),
        ...(funcName.includes('notification') && {
          SENDGRID_API_KEY: 'your-sendgrid-key', // Replace with actual secret
          TWILIO_AUTH_TOKEN: 'your-twilio-token', // Replace with actual secret
        }),
      };

      this.lambdaFunctions[funcName] = new lambda.Function(this, `${funcName}Function`, {
        functionName: `${config.appName}-${config.environment}-${funcName}`,
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline(this.getLambdaCode(funcName, config.environment)),
        timeout: cdk.Duration.seconds(config.lambda.timeout),
        memorySize: config.lambda.memorySize,
        environment: functionEnvironment,
        role,
      });
    });
  }

  private getLambdaCode(funcName: string, environment: string): string {
    // Return specific implementation based on function name
    switch (funcName) {
      case LAMBDA_FUNCTIONS.CHECKIN_GENERATE_QR:
        return `
          exports.handler = async (event) => {
            console.log('QR Generation Event:', JSON.stringify(event, null, 2));

            try {
              // Parse request body
              const { bookingId, guestName, checkInDate, roomNumber } = JSON.parse(event.body || '{}');

              // Generate QR code data
              const qrData = JSON.stringify({
                bookingId,
                guestName,
                checkInDate,
                roomNumber,
                timestamp: new Date().toISOString(),
                property: 'harmonest'
              });

              // Call 3rd party QR API (example)
              const qrApiUrl = process.env.QR_API_URL;
              const qrApiKey = process.env.QR_API_KEY;

              // TODO: Implement actual QR generation with your preferred service
              const qrCodeUrl = qrApiUrl + '?size=200x200&data=' + encodeURIComponent(qrData);

              return {
                statusCode: 200,
                headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                  success: true,
                  qrCodeUrl,
                  qrData,
                  bookingId,
                }),
              };
            } catch (error) {
              console.error('QR Generation Error:', error);
              return {
                statusCode: 500,
                headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                  success: false,
                  error: 'Failed to generate QR code',
                }),
              };
            }
          };
        `;

      case LAMBDA_FUNCTIONS.PAYMENT_WEBHOOK:
        return `
          exports.handler = async (event) => {
            console.log('Payment Webhook Event:', JSON.stringify(event, null, 2));

            try {
              // Handle payment provider webhooks (Stripe, PayPal, etc.)
              const body = event.body;
              const headers = event.headers;

              // TODO: Implement webhook signature verification
              // TODO: Process payment status updates
              // TODO: Update booking status in DynamoDB
              // TODO: Send notifications via SNS

              return {
                statusCode: 200,
                body: JSON.stringify({ received: true }),
              };
            } catch (error) {
              console.error('Webhook Error:', error);
              return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Webhook processing failed' }),
              };
            }
          };
        `;

      default:
        return `
          exports.handler = async (event) => {
            console.log('Event:', JSON.stringify(event, null, 2));
            return {
              statusCode: 200,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
              },
              body: JSON.stringify({
                message: 'Function ${funcName} - Implementation pending',
                function: '${funcName}',
                environment: '${environment}',
                note: 'This function handles operations requiring secret credentials'
              }),
            };
          };
        `;
    }
  }



  private createApiResources() {
    // Only create API endpoints for operations that require Lambda functions
    // Most operations will be handled directly from frontend using AWS SDK

    // QR Code generation endpoint (requires 3rd party API credentials)
    const checkinResource = this.restApi.root.addResource('checkin');
    const qrResource = checkinResource.addResource('qr');
    qrResource.addMethod('POST', new apigateway.LambdaIntegration(this.lambdaFunctions[LAMBDA_FUNCTIONS.CHECKIN_GENERATE_QR]), {
      operationName: 'GenerateQRCode',
      authorizer: this.authorizer, // Require authentication for QR generation
    });

    // Payment endpoints (require secret API keys)
    const paymentsResource = this.restApi.root.addResource('payments');

    // Payment processing endpoint
    paymentsResource.addMethod('POST', new apigateway.LambdaIntegration(this.lambdaFunctions[LAMBDA_FUNCTIONS.PAYMENT_PROCESS]), {
      operationName: 'ProcessPayment',
      authorizer: this.authorizer,
    });

    // Payment webhook endpoint (public - no auth required for webhooks)
    const webhookResource = paymentsResource.addResource('webhook');
    webhookResource.addMethod('POST', new apigateway.LambdaIntegration(this.lambdaFunctions[LAMBDA_FUNCTIONS.PAYMENT_WEBHOOK]), {
      operationName: 'PaymentWebhook',
    });

    // Payment refund endpoint
    const refundResource = paymentsResource.addResource('refund');
    refundResource.addMethod('POST', new apigateway.LambdaIntegration(this.lambdaFunctions[LAMBDA_FUNCTIONS.PAYMENT_REFUND]), {
      operationName: 'ProcessRefund',
      authorizer: this.authorizer,
    });

    // Optional: Notification endpoints (if using 3rd party services)
    const notificationsResource = this.restApi.root.addResource('notifications');

    const emailResource = notificationsResource.addResource('email');
    emailResource.addMethod('POST', new apigateway.LambdaIntegration(this.lambdaFunctions[LAMBDA_FUNCTIONS.NOTIFICATION_SEND_EMAIL]), {
      operationName: 'SendEmail',
      authorizer: this.authorizer,
    });

    const smsResource = notificationsResource.addResource('sms');
    smsResource.addMethod('POST', new apigateway.LambdaIntegration(this.lambdaFunctions[LAMBDA_FUNCTIONS.NOTIFICATION_SEND_SMS]), {
      operationName: 'SendSMS',
      authorizer: this.authorizer,
    });

    // CORS is handled by defaultCorsPreflightOptions in RestApi configuration
  }
}
