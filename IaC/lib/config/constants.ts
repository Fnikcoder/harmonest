// User roles and their hierarchy levels
export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  OWNER: 'owner',
  ADMIN: 'admin',
  SUPPORT: 'support',
  USER: 'user',
  GUEST: 'guest',
} as const;

export const ROLE_HIERARCHY = {
  [USER_ROLES.SUPER_ADMIN]: 5,
  [USER_ROLES.OWNER]: 4,
  [USER_ROLES.ADMIN]: 3,
  [USER_ROLES.SUPPORT]: 2,
  [USER_ROLES.USER]: 1,
  [USER_ROLES.GUEST]: 0,
} as const;

// DynamoDB table structure
export const DYNAMODB_STRUCTURE = {
  // Primary key patterns
  PK_PATTERNS: {
    USER: 'user_',
    PROPERTY_GROUP: 'property_group_',
    PROPERTY_UNIT: 'property_unit_',
    BOOKING: 'booking_',
    PAYMENT: 'payment_',
    QR_CODE: 'qr_code_',
    CHECK_IN: 'check_in_',
  },

  // Sort key patterns
  SK_PATTERNS: {
    PROFILE: 'profile',
    METADATA: 'metadata',
    BOOKING_ITEM: 'booking_item_',
    PAYMENT_ITEM: 'payment_item_',
    AVAILABILITY: 'availability_',
  },

  // GSI (Global Secondary Index) names
  GSI: {
    GSI1: 'GSI1',
    GSI2: 'GSI2',
    GSI3: 'GSI3',
  },
} as const;

// S3 bucket folder structure
export const S3_STRUCTURE = {
  FOLDERS: {
    USER_PROFILES: 'users/profiles/',
    PROPERTY_IMAGES: 'properties/images/',
    PROPERTY_DOCUMENTS: 'properties/documents/',
    BOOKING_DOCUMENTS: 'bookings/documents/',
    ID_VERIFICATION: 'verification/ids/',
    RECEIPTS: 'payments/receipts/',
    QR_CODES: 'qr-codes/',
    BACKUPS: 'backups/',
    LOGS: 'logs/',
  },
} as const;

// Lambda function names (minimal set - most operations done directly from frontend)
export const LAMBDA_FUNCTIONS = {
  // QR Code generation (requires 3rd party API credentials)
  CHECKIN_GENERATE_QR: 'checkin-generate-qr',

  // Payment functions (require secret API keys)
  PAYMENT_PROCESS: 'payment-process',
  PAYMENT_WEBHOOK: 'payment-webhook',
  PAYMENT_REFUND: 'payment-refund',

  // Optional: Notification functions (if using 3rd party services with API keys)
  NOTIFICATION_SEND_EMAIL: 'notification-send-email',
  NOTIFICATION_SEND_SMS: 'notification-send-sms',

  // Optional: Cognito triggers for custom logic
  AUTH_POST_CONFIRMATION: 'auth-post-confirmation', // Create user in DynamoDB after signup
} as const;

// Frontend operations (no Lambda needed - direct AWS SDK calls with Cognito tokens)
export const FRONTEND_OPERATIONS = {
  // Authentication (handled by Cognito directly)
  AUTH: {
    SIGNUP: 'Direct Cognito call',
    SIGNIN: 'Direct Cognito call',
    SIGNOUT: 'Direct Cognito call',
    VERIFY_EMAIL: 'Direct Cognito call',
    FORGOT_PASSWORD: 'Direct Cognito call',
    RESET_PASSWORD: 'Direct Cognito call',
  },

  // User management (direct DynamoDB/Cognito calls with proper IAM policies)
  USER: {
    GET_PROFILE: 'Direct DynamoDB query',
    UPDATE_PROFILE: 'Direct DynamoDB update + Cognito update',
    LIST_USERS: 'Direct Cognito call (admin only)',
    MANAGE_ROLES: 'Direct Cognito group management (admin only)',
  },

  // Property management (direct DynamoDB calls)
  PROPERTY: {
    CREATE: 'Direct DynamoDB put (admin only)',
    UPDATE: 'Direct DynamoDB update (admin only)',
    DELETE: 'Direct DynamoDB delete (admin only)',
    LIST: 'Direct DynamoDB scan/query',
    GET_DETAILS: 'Direct DynamoDB get',
    SEARCH: 'Direct DynamoDB query with filters',
  },

  // Booking management (direct DynamoDB calls)
  BOOKING: {
    CREATE: 'Direct DynamoDB put',
    UPDATE: 'Direct DynamoDB update',
    CANCEL: 'Direct DynamoDB update',
    LIST: 'Direct DynamoDB query',
    GET_DETAILS: 'Direct DynamoDB get',
    CHECK_AVAILABILITY: 'Direct DynamoDB query',
  },

  // File operations (direct S3 calls with signed URLs)
  FILES: {
    UPLOAD: 'Direct S3 put with signed URL',
    DOWNLOAD: 'Direct S3 get with signed URL',
    DELETE: 'Direct S3 delete (admin only)',
  },

  // Notifications (direct SNS calls)
  NOTIFICATIONS: {
    PUBLISH: 'Direct SNS publish',
  },
} as const;

// SQS Queue names
export const SQS_QUEUES = {
  EMAIL_NOTIFICATIONS: 'email-notifications',
  SMS_NOTIFICATIONS: 'sms-notifications',
  BOOKING_EVENTS: 'booking-events',
  PAYMENT_EVENTS: 'payment-events',
  USER_EVENTS: 'user-events',
  DEAD_LETTER: 'dead-letter-queue',
} as const;

// SNS Topic names
export const SNS_TOPICS = {
  BOOKING_NOTIFICATIONS: 'booking-notifications',
  PAYMENT_NOTIFICATIONS: 'payment-notifications',
  USER_NOTIFICATIONS: 'user-notifications',
  SYSTEM_ALERTS: 'system-alerts',
} as const;

// API Gateway resource paths
export const API_PATHS = {
  // Authentication endpoints
  AUTH: '/auth',
  AUTH_SIGNUP: '/auth/signup',
  AUTH_SIGNIN: '/auth/signin',
  AUTH_SIGNOUT: '/auth/signout',
  AUTH_VERIFY: '/auth/verify',
  AUTH_FORGOT_PASSWORD: '/auth/forgot-password',
  AUTH_RESET_PASSWORD: '/auth/reset-password',

  // User endpoints
  USERS: '/users',
  USER_PROFILE: '/users/profile',
  USER_MANAGE: '/users/manage',

  // Property endpoints
  PROPERTIES: '/properties',
  PROPERTY_SEARCH: '/properties/search',
  PROPERTY_AVAILABILITY: '/properties/availability',

  // Booking endpoints
  BOOKINGS: '/bookings',
  BOOKING_AVAILABILITY: '/bookings/availability',

  // Payment endpoints
  PAYMENTS: '/payments',
  PAYMENT_WEBHOOK: '/payments/webhook',

  // Check-in endpoints
  CHECKIN: '/checkin',
  CHECKIN_VERIFY: '/checkin/verify',
  CHECKIN_QR: '/checkin/qr',

  // Notification endpoints
  NOTIFICATIONS: '/notifications',
} as const;

// CloudWatch Log Groups
export const LOG_GROUPS = {
  API_GATEWAY: '/aws/apigateway/',
  LAMBDA: '/aws/lambda/',
  COGNITO: '/aws/cognito/',
} as const;

// Tags for all resources
export const RESOURCE_TAGS = {
  Project: 'Harmonest',
  ManagedBy: 'AWS-CDK',
  Repository: 'harmonest-frontend',
} as const;
