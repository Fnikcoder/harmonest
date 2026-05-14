import { S3MediaFile } from './property.interface';

// Payment Model
export interface Payment {
  // Primary Key
  PK: string;          // "PAYMENT#<paymentId>"
  SK: string;          // "METADATA"

  // Core Payment Data
  paymentId: string;
  bookingId: string;
  userId: string;
  propertyGroupId: string;  // Direct link to PropertyGroup for reporting

  // Payment Details
  amount: {
    total: number;
    currency: string;
    breakdown: {
      principal: number;
      taxes: number;
      fees: number;
      tips?: number;
    };
  };

  // Payment Method
  paymentMethod: {
    type: 'credit_card' | 'debit_card' | 'paypal' | 'stripe' | 'bank_transfer' | 'crypto';
    provider: 'stripe' | 'paypal' | 'square' | 'adyen';

    // Card Details (tokenized)
    card?: {
      last4: string;
      brand: 'visa' | 'mastercard' | 'amex' | 'discover';
      expiryMonth: number;
      expiryYear: number;
      fingerprint: string;  // for duplicate detection
      holderName: string;
    };

    // Digital Wallet
    wallet?: {
      type: 'apple_pay' | 'google_pay' | 'samsung_pay' | 'paypal';
      deviceId?: string;
      accountEmail?: string;
    };

    // External Payment
    external?: {
      accountId: string;
      accountEmail?: string;
    };
  };

  // Transaction Details
  transaction: {
    status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'refunded';
    gatewayTransactionId: string;
    gatewayResponse?: any;  // provider-specific response
    authorizationCode?: string;
    capturedAt?: string;
    failureReason?: string;
    riskScore?: number;

    // Payment flow
    paymentFlow: 'immediate' | 'authorize_capture' | 'installments';
    installmentPlan?: {
      totalInstallments: number;
      currentInstallment: number;
      installmentAmount: number;
      nextPaymentDate?: string;
    };
  };

  // Receipts & Documents (S3 Storage)
  documents?: {
    receipts: {
      receiptId: string;
      s3Key: string;        // "payments/{paymentId}/receipts/{receiptId}.pdf"
      s3Bucket: string;
      url: string;
      type: 'payment_receipt' | 'tax_invoice' | 'refund_receipt';
      metadata: {
        size: number;
        format: string;
        generatedAt: string;
      };
    }[];

    statements?: {
      statementId: string;
      s3Key: string;        // "payments/{paymentId}/statements/{statementId}.pdf"
      s3Bucket: string;
      url: string;
      period: string;       // "2024-01"
      metadata: {
        size: number;
        format: string;
        generatedAt: string;
      };
    }[];
  };

  // Refund Information
  refunds?: {
    refundId: string;
    amount: number;
    reason: string;
    status: 'pending' | 'succeeded' | 'failed';
    processedAt?: string;
    gatewayRefundId?: string;
    refundMethod: 'original_payment_method' | 'bank_transfer' | 'check';
    estimatedArrival?: string;
  }[];

  // Security & Fraud
  security: {
    ipAddress: string;
    userAgent: string;
    deviceFingerprint?: string;

    threeDSecure?: {
      version: string;
      status: 'authenticated' | 'not_authenticated' | 'challenge';
      transactionId?: string;
    };

    fraudChecks: {
      avsCheck?: 'pass' | 'fail' | 'unavailable';
      cvvCheck?: 'pass' | 'fail' | 'unavailable';
      velocityCheck?: 'pass' | 'fail';
      blacklistCheck?: 'pass' | 'fail';
    };

    riskAssessment: {
      score: number;        // 0-100
      level: 'low' | 'medium' | 'high';
      factors: string[];
      reviewRequired: boolean;
    };
  };

  // Billing Address
  billingAddress: {
    firstName: string;
    lastName: string;
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
  };

  // Payment Notifications
  notifications?: {
    notificationId: string;
    type: 'payment_confirmation' | 'payment_failed' | 'refund_processed';
    channel: 'email' | 'sms' | 'push';
    sentAt: string;
    status: 'sent' | 'delivered' | 'failed';
  }[];

  // Unit Breakdown for detailed reporting
  unitBreakdown: {
    unitId: string;
    unitNumber: string;
    modelId: string;
    modelName: string;
    nights: number;
    nightlyRate: number;
    totalAmount: number;
  }[];

  // Metadata
  createdAt: string;
  updatedAt: string;
  processedAt?: string;

  // GSI Keys
  GSI1PK: string;      // "BOOKING#<bookingId>"
  GSI1SK: string;      // "PAYMENT#<createdAt>"
  GSI2PK: string;      // "USER#<userId>"
  GSI2SK: string;      // "PAYMENT#<createdAt>"
  GSI3PK: string;      // "STATUS#<status>"
  GSI3SK: string;      // "PAYMENT#<createdAt>"
  GSI4PK: string;      // "GATEWAY#<provider>"
  GSI4SK: string;      // "PAYMENT#<gatewayTransactionId>"
  GSI5PK: string;      // "PROPERTY_GROUP#<propertyGroupId>"
  GSI5SK: string;      // "PAYMENT#<createdAt>"
}

// Payment Intent (for payment processing)
export interface PaymentIntent {
  // Primary Key
  PK: string;          // "PAYMENT_INTENT#<intentId>"
  SK: string;          // "METADATA"

  intentId: string;
  bookingId: string;
  userId: string;

  // Intent Details
  amount: number;
  currency: string;
  description: string;

  // Payment Method Requirements
  paymentMethodTypes: string[];
  captureMethod: 'automatic' | 'manual';
  confirmationMethod: 'automatic' | 'manual';

  // Status
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'requires_capture' | 'canceled' | 'succeeded';

  // Client Secret (for frontend)
  clientSecret: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
  expiresAt: string;

  // GSI Keys
  GSI1PK: string;      // "BOOKING#<bookingId>"
  GSI1SK: string;      // "INTENT#<createdAt>"
}

// Payment Method (stored payment methods)
export interface PaymentMethod {
  // Primary Key
  PK: string;          // "USER#<userId>"
  SK: string;          // "PAYMENT_METHOD#<methodId>"

  methodId: string;
  userId: string;

  // Method Details
  type: 'credit_card' | 'debit_card' | 'bank_account' | 'digital_wallet';
  isDefault: boolean;

  // Card Information (tokenized)
  card?: {
    last4: string;
    brand: string;
    expiryMonth: number;
    expiryYear: number;
    fingerprint: string;
    funding: 'credit' | 'debit' | 'prepaid' | 'unknown';
    country: string;
  };

  // Bank Account
  bankAccount?: {
    last4: string;
    bankName: string;
    accountType: 'checking' | 'savings';
    routingNumber: string;
    country: string;
  };

  // Digital Wallet
  digitalWallet?: {
    type: 'paypal' | 'apple_pay' | 'google_pay';
    email?: string;
  };

  // Billing Details
  billingDetails: {
    name: string;
    email: string;
    phone?: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
  };

  // Gateway Information
  gateway: {
    provider: string;
    gatewayMethodId: string;
    fingerprint: string;
  };

  // Usage Statistics
  usage: {
    totalTransactions: number;
    totalAmount: number;
    lastUsed?: string;
    firstUsed: string;
  };

  // Status
  status: 'active' | 'expired' | 'disabled';

  // Metadata
  createdAt: string;
  updatedAt: string;

  // GSI Keys
  GSI1PK: string;      // "PAYMENT_METHOD#<type>"
  GSI1SK: string;      // "METHOD#<userId>#<createdAt>"
}

// Payment Analytics
export interface PaymentAnalytics {
  // Primary Key
  PK: string;          // "ANALYTICS#payment"
  SK: string;          // "METRICS#<period>"

  period: string;      // "2024-07", "2024-Q3", "2024"
  periodType: 'day' | 'week' | 'month' | 'quarter' | 'year';

  // Payment Metrics
  metrics: {
    totalPayments: number;
    totalAmount: number;
    averagePaymentAmount: number;

    // Success Rates
    successRate: number;
    failureRate: number;
    refundRate: number;

    // Payment Methods
    methodBreakdown: {
      method: string;
      count: number;
      amount: number;
      percentage: number;
    }[];

    // Geographic Distribution
    countryBreakdown: {
      country: string;
      count: number;
      amount: number;
    }[];

    // Fraud & Risk
    fraudAttempts: number;
    blockedTransactions: number;
    averageRiskScore: number;

    // Processing Times
    averageProcessingTime: number; // seconds

    // Revenue Impact
    grossRevenue: number;
    netRevenue: number;
    processingFees: number;
    chargebacks: number;
  };

  calculatedAt: string;

  // GSI Keys
  GSI1PK: string;      // "ANALYTICS#<periodType>"
  GSI1SK: string;      // "PAYMENT_METRICS#<period>"
}
