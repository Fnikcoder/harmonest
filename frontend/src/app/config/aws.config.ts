import { Injectable } from '@angular/core';
import { ConfigService } from '../services/config.service';

export interface AWSConfig {
  region: string;
  cognito: {
    userPoolId: string;
    userPoolWebClientId: string;
    identityPoolId?: string;
    domain: string;
    oauth?: {
      domain: string;
      scope: string[];
      redirectSignIn: string;
      redirectSignOut: string;
      responseType: string;
    };
  };
  dynamodb: {
    tableName: string;
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    endpoint?: string; // For local development
  };
  s3: {
    bucketName: string;
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
  apiGateway: {
    baseUrl: string;
    region: string;
    stage: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AWSConfigService {
  constructor(private configService: ConfigService) {}

  /**
   * Get AWS configuration from centralized config
   */
  getAWSConfig(): AWSConfig | null {
    const config = this.configService.getConfig();
    if (!config?.technical?.aws) {
      console.warn('AWS configuration not found in master config');
      return null;
    }

    const awsConfig = config.technical.aws;
    const isProduction = config.environment.type === 'prod';

    return {
      region: awsConfig.region,
      cognito: {
        userPoolId: awsConfig.cognito.userPoolId,
        userPoolWebClientId: awsConfig.cognito.userPoolWebClientId,
        identityPoolId: awsConfig.cognito.identityPoolId,
        domain: awsConfig.cognito.domain || '',
        oauth: awsConfig.cognito.oauth
      },
      dynamodb: {
        tableName: awsConfig.dynamodb.tableName,
        region: awsConfig.dynamodb.region,
        endpoint: awsConfig.dynamodb.endpoint || undefined
      },
      s3: {
        bucketName: awsConfig.s3.bucketName,
        region: awsConfig.s3.region
      },
      apiGateway: {
        baseUrl: config.technical.apis.checkin?.baseUrl || '',
        region: awsConfig.region,
        stage: isProduction ? 'prod' : 'dev'
      }
    };
  }

  /**
   * Get Cognito configuration
   */
  getCognitoConfig() {
    const awsConfig = this.getAWSConfig();
    return awsConfig?.cognito || null;
  }

  /**
   * Get DynamoDB configuration
   */
  getDynamoDBConfig() {
    const awsConfig = this.getAWSConfig();
    return awsConfig?.dynamodb || null;
  }

  /**
   * Get S3 configuration
   */
  getS3Config() {
    const awsConfig = this.getAWSConfig();
    return awsConfig?.s3 || null;
  }
}

// Legacy export for backward compatibility
// Use AWSConfigService instead for new code
export function getAWSConfig(): AWSConfig | null {
  // This is a fallback function - inject AWSConfigService in your components instead
  console.warn('getAWSConfig() is deprecated. Use AWSConfigService instead.');
  return null;
}

// Legacy awsConfig export for backward compatibility
export const awsConfig = {
  region: 'eu-central-1',
  cognito: {
    userPoolId: 'fallback',
    userPoolWebClientId: 'fallback',
    identityPoolId: 'fallback',
    domain: ''
  },
  dynamodb: {
    tableName: 'harmonest-dev-main',
    region: 'eu-central-1'
  },
  s3: {
    bucketName: 'harmonest-dev-storage',
    region: 'eu-central-1'
  },
  apiGateway: {
    baseUrl: '',
    region: 'eu-central-1',
    stage: 'dev'
  }
};

// DynamoDB Table Structure - Legacy export (deprecated)
export const dynamoDBSchema = {
  tableName: 'harmonest-dev-main', // fallback value
  partitionKey: 'PK',
  sortKey: 'SK',
  globalSecondaryIndexes: [
    {
      indexName: 'GSI1',
      partitionKey: 'GSI1PK',
      sortKey: 'GSI1SK',
      description: 'Email-based queries'
    },
    {
      indexName: 'GSI2',
      partitionKey: 'GSI2PK',
      sortKey: 'GSI2SK',
      description: 'Phone-based queries'
    },
    {
      indexName: 'GSI3',
      partitionKey: 'GSI3PK',
      sortKey: 'GSI3SK',
      description: 'Role-based queries'
    },
    {
      indexName: 'GSI4',
      partitionKey: 'GSI4PK',
      sortKey: 'GSI4SK',
      description: 'Property-based queries'
    },
    {
      indexName: 'GSI5',
      partitionKey: 'GSI5PK',
      sortKey: 'GSI5SK',
      description: 'Booking-based queries'
    }
  ]
};

// S3 Bucket Structure - Legacy export (deprecated)
export const s3Structure = {
  bucketName: 'harmonest-dev-storage', // fallback value
  folders: {
    userProfiles: 'users/profiles/',
    propertyImages: 'properties/images/',
    propertyDocuments: 'properties/documents/',
    bookingDocuments: 'bookings/documents/',
    idVerification: 'verification/ids/',
    receipts: 'payments/receipts/',
    qrCodes: 'qr-codes/',
    backups: 'backups/',
    logs: 'logs/'
  }
};

// Role-based DynamoDB Access Policies
export const dynamoDBPolicies = {
  super_admin: {
    read: ['*'],
    write: ['*'],
    delete: ['*'],
    description: 'Full access to all data'
  },
  owner: {
    read: ['*'],
    write: ['*'],
    delete: ['USER#*', 'PROPERTY#*', 'BOOKING#*', 'PAYMENT#*'],
    description: 'Full access except system configuration'
  },
  admin: {
    read: ['USER#*', 'PROPERTY#*', 'BOOKING#*', 'PAYMENT#*'],
    write: ['PROPERTY#*', 'BOOKING#*', 'PAYMENT#*'],
    delete: ['BOOKING#*'],
    description: 'Manage properties, bookings, and payments'
  },
  support: {
    read: ['BOOKING#*', 'USER#*'],
    write: ['BOOKING#*'],
    delete: [],
    description: 'Manage bookings and view user data'
  },
  user: {
    read: ['USER#{userId}', 'BOOKING#{userId}#*'],
    write: ['USER#{userId}', 'BOOKING#{userId}#*'],
    delete: [],
    description: 'Access only own data'
  },
  guest: {
    read: ['USER#{userId}', 'BOOKING#{userId}#*'],
    write: ['USER#{userId}', 'BOOKING#{userId}#*'],
    delete: [],
    description: 'Access only own data after verification'
  }
};

// S3 Access Policies
export const s3Policies = {
  super_admin: {
    read: ['*'],
    write: ['*'],
    delete: ['*']
  },
  owner: {
    read: ['*'],
    write: ['*'],
    delete: ['users/*', 'properties/*', 'bookings/*']
  },
  admin: {
    read: ['properties/*', 'bookings/*', 'users/profiles/*'],
    write: ['properties/*', 'bookings/*'],
    delete: ['bookings/*']
  },
  support: {
    read: ['bookings/*', 'users/profiles/*'],
    write: ['bookings/*'],
    delete: []
  },
  user: {
    read: ['users/profiles/{userId}/*', 'bookings/{userId}/*'],
    write: ['users/profiles/{userId}/*', 'bookings/{userId}/*'],
    delete: []
  },
  guest: {
    read: ['users/profiles/{userId}/*', 'bookings/{userId}/*'],
    write: ['users/profiles/{userId}/*', 'bookings/{userId}/*'],
    delete: []
  }
};

export function canAccessDynamoDBResource(userRole: string, operation: 'read' | 'write' | 'delete', resourceKey: string, userId?: string): boolean {
  const policy = dynamoDBPolicies[userRole as keyof typeof dynamoDBPolicies];
  if (!policy) return false;

  const allowedResources = policy[operation] as string[];

  // Check for wildcard access
  if (allowedResources.includes('*')) return true;

  // Replace {userId} placeholder with actual userId
  const processedResources = allowedResources.map(resource =>
    resource.replace('{userId}', userId || '')
  );

  // Check if resource matches any allowed pattern
  return processedResources.some(pattern => {
    if (pattern.endsWith('*')) {
      return resourceKey.startsWith(pattern.slice(0, -1));
    }
    return resourceKey === pattern;
  });
}

export function canAccessS3Resource(userRole: string, operation: 'read' | 'write' | 'delete', resourcePath: string, userId?: string): boolean {
  const policy = s3Policies[userRole as keyof typeof s3Policies];
  if (!policy) return false;

  const allowedResources = policy[operation] as string[];

  // Check for wildcard access
  if (allowedResources.includes('*')) return true;

  // Replace {userId} placeholder with actual userId
  const processedResources = allowedResources.map(resource =>
    resource.replace('{userId}', userId || '')
  );

  // Check if resource matches any allowed pattern
  return processedResources.some(pattern => {
    if (pattern.endsWith('*')) {
      return resourcePath.startsWith(pattern.slice(0, -1));
    }
    return resourcePath === pattern;
  });
}
