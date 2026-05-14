export interface EnvironmentConfig {
  account?: string;
  region: string;
  environment: 'dev' | 'prod';
  
  // Domain configuration
  domainName: string;
  bucketName: string;
  
  // Resource naming
  appName: string;
  
  // Cognito configuration
  cognito: {
    userPoolName: string;
    identityPoolName: string;
    userPoolClientName: string;
    allowUnauthenticatedIdentities: boolean;
    mfaConfiguration: 'OFF' | 'OPTIONAL' | 'REQUIRED';
    passwordPolicy: {
      minLength: number;
      requireLowercase: boolean;
      requireUppercase: boolean;
      requireNumbers: boolean;
      requireSymbols: boolean;
    };
  };
  
  // DynamoDB configuration
  dynamodb: {
    tableName: string;
    billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
    pointInTimeRecovery: boolean;
    deletionProtection: boolean;
  };
  
  // S3 configuration
  s3: {
    bucketName: string;
    versioning: boolean;
    publicReadAccess: boolean;
    blockPublicAccess: boolean;
  };
  
  // Lambda configuration
  lambda: {
    runtime: string;
    timeout: number;
    memorySize: number;
    environment: Record<string, string>;
  };
  
  // API Gateway configuration
  apiGateway: {
    restApiName: string;
    description: string;
    deployOptions: {
      stageName: string;
      throttleRateLimit: number;
      throttleBurstLimit: number;
    };
  };
  
  // SQS configuration
  sqs: {
    visibilityTimeoutSeconds: number;
    messageRetentionPeriodSeconds: number;
    maxReceiveCount: number;
  };
  
  // SNS configuration
  sns: {
    displayName: string;
  };
  
  // CloudFront configuration
  cloudfront: {
    priceClass: 'PriceClass_All' | 'PriceClass_100' | 'PriceClass_200';
    minimumProtocolVersion: string;
    viewerProtocolPolicy: 'allow-all' | 'redirect-to-https' | 'https-only';
  };
}

export const environments: Record<string, EnvironmentConfig> = {
  dev: {
    region: 'eu-central-1',
    environment: 'dev',
    domainName: 'dev.harmonest.de',
    bucketName: 'dev.harmonest.de',
    appName: 'harmonest',
    
    cognito: {
      userPoolName: 'harmonest-dev-user-pool',
      identityPoolName: 'harmonest-dev-identity-pool',
      userPoolClientName: 'harmonest-dev-web-client',
      allowUnauthenticatedIdentities: true,
      mfaConfiguration: 'OPTIONAL',
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSymbols: true,
      },
    },
    
    dynamodb: {
      tableName: 'harmonest-dev-main',
      billingMode: 'PAY_PER_REQUEST',
      pointInTimeRecovery: true,
      deletionProtection: false,
    },
    
    s3: {
      bucketName: 'harmonest-dev-storage',
      versioning: true,
      publicReadAccess: false,
      blockPublicAccess: true,
    },
    
    lambda: {
      runtime: 'nodejs20.x',
      timeout: 30,
      memorySize: 256,
      environment: {
        NODE_ENV: 'development',
        LOG_LEVEL: 'debug',
      },
    },
    
    apiGateway: {
      restApiName: 'harmonest-dev-api',
      description: 'Harmonest Development API',
      deployOptions: {
        stageName: 'dev',
        throttleRateLimit: 100,
        throttleBurstLimit: 200,
      },
    },
    
    sqs: {
      visibilityTimeoutSeconds: 300,
      messageRetentionPeriodSeconds: 1209600, // 14 days
      maxReceiveCount: 3,
    },
    
    sns: {
      displayName: 'Harmonest Dev Notifications',
    },
    
    cloudfront: {
      priceClass: 'PriceClass_100',
      minimumProtocolVersion: 'TLSv1.2_2021',
      viewerProtocolPolicy: 'redirect-to-https',
    },
  },
  
  prod: {
    region: 'eu-central-1',
    environment: 'prod',
    domainName: 'harmonest.de',
    bucketName: 'harmonest.de',
    appName: 'harmonest',
    
    cognito: {
      userPoolName: 'harmonest-prod-user-pool',
      identityPoolName: 'harmonest-prod-identity-pool',
      userPoolClientName: 'harmonest-prod-web-client',
      allowUnauthenticatedIdentities: true,
      mfaConfiguration: 'OPTIONAL',
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSymbols: true,
      },
    },
    
    dynamodb: {
      tableName: 'harmonest-prod-main',
      billingMode: 'PAY_PER_REQUEST',
      pointInTimeRecovery: true,
      deletionProtection: true,
    },
    
    s3: {
      bucketName: 'harmonest-prod-storage',
      versioning: true,
      publicReadAccess: false,
      blockPublicAccess: true,
    },
    
    lambda: {
      runtime: 'nodejs20.x',
      timeout: 30,
      memorySize: 512,
      environment: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
      },
    },
    
    apiGateway: {
      restApiName: 'harmonest-prod-api',
      description: 'Harmonest Production API',
      deployOptions: {
        stageName: 'prod',
        throttleRateLimit: 1000,
        throttleBurstLimit: 2000,
      },
    },
    
    sqs: {
      visibilityTimeoutSeconds: 300,
      messageRetentionPeriodSeconds: 1209600, // 14 days
      maxReceiveCount: 3,
    },
    
    sns: {
      displayName: 'Harmonest Prod Notifications',
    },
    
    cloudfront: {
      priceClass: 'PriceClass_All',
      minimumProtocolVersion: 'TLSv1.2_2021',
      viewerProtocolPolicy: 'redirect-to-https',
    },
  },
};

export function getEnvironmentConfig(environment: string): EnvironmentConfig {
  const config = environments[environment];
  if (!config) {
    throw new Error(`Environment configuration not found for: ${environment}`);
  }
  return config;
}
