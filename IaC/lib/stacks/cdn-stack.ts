import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface CdnStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  s3Bucket: s3.Bucket;
  apiGateway: apigateway.RestApi;
}

export class CdnStack extends cdk.Stack {
  public distribution?: cloudfront.Distribution;
  public certificate?: certificatemanager.Certificate;
  public hostedZone?: route53.IHostedZone;

  constructor(scope: Construct, id: string, props: CdnStackProps) {
    super(scope, id, props);

    const { config, s3Bucket, apiGateway } = props;

    // Only create CloudFront distribution for production or if explicitly configured
    if (config.environment === 'prod' || config.domainName !== 'localhost') {
      this.createCloudFrontDistribution(config, s3Bucket, apiGateway);
    }
  }

  private createCloudFrontDistribution(
    config: EnvironmentConfig,
    s3Bucket: s3.Bucket,
    apiGateway: apigateway.RestApi
  ) {
    // Create Origin Access Control for S3
    const originAccessControl = new cloudfront.S3OriginAccessControl(this, 'OriginAccessControl', {
      description: `OAC for ${config.domainName}`,
    });

    // Create cache policies
    const staticAssetsCachePolicy = new cloudfront.CachePolicy(this, 'StaticAssetsCachePolicy', {
      cachePolicyName: `${config.appName}-${config.environment}-static-assets`,
      comment: 'Cache policy for static assets (CSS, JS, images)',
      defaultTtl: cdk.Duration.days(1),
      maxTtl: cdk.Duration.days(365),
      minTtl: cdk.Duration.seconds(0),
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
    });

    const apiCachePolicy = new cloudfront.CachePolicy(this, 'ApiCachePolicy', {
      cachePolicyName: `${config.appName}-${config.environment}-api`,
      comment: 'Cache policy for API requests',
      defaultTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.seconds(1),
      minTtl: cdk.Duration.seconds(0),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
        'Authorization',
        'Content-Type',
        'X-Api-Key'
      ),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
    });

    // Create origin request policy for API
    const apiOriginRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'ApiOriginRequestPolicy', {
      originRequestPolicyName: `${config.appName}-${config.environment}-api-origin`,
      comment: 'Origin request policy for API Gateway',
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
        'Content-Type',
        'X-Api-Key',
        'X-Amz-Date',
        'X-Amz-Security-Token'
      ),
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
    });

    // Create CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `CloudFront distribution for ${config.domainName}`,
      defaultRootObject: 'index.html',
      priceClass: config.cloudfront.priceClass as cloudfront.PriceClass,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      
      // Default behavior for S3 (Angular app)
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(s3Bucket, {
          originAccessControl,
        }),
        viewerProtocolPolicy: config.cloudfront.viewerProtocolPolicy as cloudfront.ViewerProtocolPolicy,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
      },

      additionalBehaviors: {
        // API Gateway behavior
        '/api/*': {
          origin: new origins.RestApiOrigin(apiGateway),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: apiCachePolicy,
          originRequestPolicy: apiOriginRequestPolicy,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        },
        
        // Static assets behavior
        '*.css': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(s3Bucket, {
            originAccessControl,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: staticAssetsCachePolicy,
          compress: true,
        },
        
        '*.js': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(s3Bucket, {
            originAccessControl,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: staticAssetsCachePolicy,
          compress: true,
        },
        
        '*.png': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(s3Bucket, {
            originAccessControl,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: staticAssetsCachePolicy,
          compress: false,
        },
        
        '*.jpg': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(s3Bucket, {
            originAccessControl,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: staticAssetsCachePolicy,
          compress: false,
        },
        
        '*.svg': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(s3Bucket, {
            originAccessControl,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: staticAssetsCachePolicy,
          compress: true,
        },
      },

      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],

      enableLogging: true,
      logBucket: s3Bucket,
      logFilePrefix: 'cloudfront-logs/',
      logIncludesCookies: false,
    });

    // Update S3 bucket policy to allow CloudFront access
    s3Bucket.addToResourcePolicy(
      new cdk.aws_iam.PolicyStatement({
        sid: 'AllowCloudFrontServicePrincipal',
        effect: cdk.aws_iam.Effect.ALLOW,
        principals: [new cdk.aws_iam.ServicePrincipal('cloudfront.amazonaws.com')],
        actions: ['s3:GetObject'],
        resources: [`${s3Bucket.bucketArn}/*`],
        conditions: {
          StringEquals: {
            'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${this.distribution.distributionId}`,
          },
        },
      })
    );

    // Add tags to resources
    cdk.Tags.of(this.distribution).add('ResourceType', 'CDN');
  }
}
