import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import { DYNAMODB_STRUCTURE } from '../config/constants';

export interface StorageStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class StorageStack extends cdk.Stack {
  public readonly dynamoTable: dynamodb.Table;
  public readonly s3Bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Create DynamoDB Table with single-table design
    this.dynamoTable = new dynamodb.Table(this, 'MainTable', {
      tableName: config.dynamodb.tableName,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: config.dynamodb.billingMode === 'PAY_PER_REQUEST' 
        ? dynamodb.BillingMode.PAY_PER_REQUEST 
        : dynamodb.BillingMode.PROVISIONED,
      pointInTimeRecovery: config.dynamodb.pointInTimeRecovery,
      deletionProtection: config.dynamodb.deletionProtection,
      removalPolicy: config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // Add Global Secondary Indexes
    this.dynamoTable.addGlobalSecondaryIndex({
      indexName: DYNAMODB_STRUCTURE.GSI.GSI1,
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.dynamoTable.addGlobalSecondaryIndex({
      indexName: DYNAMODB_STRUCTURE.GSI.GSI2,
      partitionKey: {
        name: 'GSI2PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI2SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.dynamoTable.addGlobalSecondaryIndex({
      indexName: DYNAMODB_STRUCTURE.GSI.GSI3,
      partitionKey: {
        name: 'GSI3PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI3SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Create S3 Bucket for file storage
    this.s3Bucket = new s3.Bucket(this, 'StorageBucket', {
      bucketName: config.s3.bucketName,
      versioned: config.s3.versioning,
      publicReadAccess: config.s3.publicReadAccess,
      blockPublicAccess: config.s3.blockPublicAccess ? s3.BlockPublicAccess.BLOCK_ALL : s3.BlockPublicAccess.BLOCK_ACLS,
      removalPolicy: config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: config.environment !== 'prod',
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT,
            s3.HttpMethods.DELETE,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: [
            `https://${config.domainName}`,
            'http://localhost:4200',
          ],
          allowedHeaders: ['*'],
          exposedHeaders: [
            'ETag',
            'x-amz-meta-custom-header',
          ],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          id: 'DeleteIncompleteMultipartUploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
          enabled: true,
        },
        {
          id: 'TransitionToIA',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
      // notificationConfiguration: {
      //   // We'll add Lambda triggers later if needed
      // },
    });

    // Add bucket policy for CloudFront access
    this.s3Bucket.addToResourcePolicy(
      new cdk.aws_iam.PolicyStatement({
        sid: 'AllowCloudFrontAccess',
        effect: cdk.aws_iam.Effect.ALLOW,
        principals: [new cdk.aws_iam.ServicePrincipal('cloudfront.amazonaws.com')],
        actions: ['s3:GetObject'],
        resources: [`${this.s3Bucket.bucketArn}/*`],
        conditions: {
          StringEquals: {
            'AWS:SourceAccount': this.account,
          },
        },
      })
    );

    // Create folder structure in S3 (optional - folders are created on first upload)
    // This is mainly for documentation purposes
    const folderStructure = [
      'users/profiles/',
      'properties/images/',
      'properties/documents/',
      'bookings/documents/',
      'verification/ids/',
      'payments/receipts/',
      'qr-codes/',
      'backups/',
      'logs/',
    ];

    // Add tags to resources
    cdk.Tags.of(this.dynamoTable).add('ResourceType', 'Database');
    cdk.Tags.of(this.s3Bucket).add('ResourceType', 'Storage');
    
    // Output important information
    new cdk.CfnOutput(this, 'DynamoTableArn', {
      value: this.dynamoTable.tableArn,
      description: 'DynamoDB Table ARN',
    });

    new cdk.CfnOutput(this, 'S3BucketArn', {
      value: this.s3Bucket.bucketArn,
      description: 'S3 Bucket ARN',
    });

    new cdk.CfnOutput(this, 'S3BucketDomainName', {
      value: this.s3Bucket.bucketDomainName,
      description: 'S3 Bucket Domain Name',
    });
  }
}
