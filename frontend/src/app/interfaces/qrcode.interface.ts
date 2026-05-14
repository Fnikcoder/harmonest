// QR Code Model (String Data Only - No File Storage)
export interface QRCode {
  // Primary Key
  PK: string;          // "QRCODE#<qrCodeId>"
  SK: string;          // "METADATA"

  // Core QR Data
  qrCodeId: string;
  bookingId: string;
  userId: string;
  propertyGroupId: string;
  unitId: string;
  modelId: string;      // Link to UnitModel for grouping and reporting

  // QR Code Content (String Data Only)
  code: {
    data: string;        // encrypted payload containing access info
    format: 'jwt' | 'encrypted_json' | 'base64';
    algorithm: 'AES256' | 'RSA' | 'ECDSA';
    signature: string;   // for verification
    version: string;     // for future compatibility
  };

  // Raw QR String (what gets encoded in QR)
  qrString: string;      // The actual string that becomes the QR code

  // Access Control
  access: {
    type: 'unit_entry' | 'building_entry' | 'amenity_access' | 'parking';
    permissions: string[];  // ['unit_door', 'building_entrance', 'elevator', 'gym', 'pool']

    // Building access (if required)
    buildingAccess?: {
      required: boolean;
      entranceCodes: string[];  // multiple entrance points
      elevatorAccess: boolean;
      floor: number;
    };

    // Unit-specific access
    unitAccess: {
      unitNumber: string;
      lockId: string;
      accessCode: string;   // numeric backup code
      masterKey: boolean;
    };

    // Time-based restrictions
    restrictions: {
      timeWindows: {
        start: string;      // ISO time
        end: string;        // ISO time
        days: number[];     // [0,1,2,3,4,5,6] Sunday=0
      }[];
      locationRestrictions?: string[];
      usageLimit?: number;
      concurrentUseLimit?: number;
    };
  };

  // Smart Lock Integration
  smartLock: {
    // Building lock (if applicable)
    buildingLock?: {
      lockId: string;
      lockType: string;
      accessCode: string;
    };

    // Unit lock
    unitLock: {
      lockId: string;
      lockType: string;
      accessCode: string;
      batteryLevel?: number;
      lastSync: string;
    };

    // Lock provider integration
    provider: {
      name: string;       // 'yale', 'august', 'schlage'
      apiVersion: string;
      credentials?: string; // encrypted
    };
  };

  // Validity & Lifecycle
  validity: {
    issuedAt: string;
    activatedAt?: string;
    expiresAt: string;
    revokedAt?: string;
    revokeReason?: string;

    // Auto-extension for longer stays
    autoExtend: boolean;
    maxExtensions: number;
    extensionsUsed: number;

    // Grace periods
    gracePeriod: {
      beforeCheckIn: number;  // hours
      afterCheckOut: number;  // hours
    };
  };

  // Usage Tracking
  usage: {
    totalScans: number;
    successfulScans: number;
    failedScans: number;
    lastUsedAt?: string;
    lastLocation?: string;

    // Detailed usage history
    usageHistory: {
      timestamp: string;
      location: string;     // 'building_entrance', 'unit_door', 'amenity'
      lockId: string;
      success: boolean;
      deviceId?: string;
      errorCode?: string;
      ipAddress?: string;
      userAgent?: string;
    }[];

    // Usage patterns
    patterns: {
      mostUsedHour: number;
      mostUsedDay: number;
      averageUsesPerDay: number;
    };
  };

  // Security Features
  security: {
    encryptionKey: string;
    rotationSchedule: string;  // cron expression
    lastRotated: string;

    // Fraud detection
    fraudDetection: {
      enabled: boolean;
      suspiciousActivity: boolean;
      riskScore: number;
      lastRiskAssessment: string;
    };

    // Geofencing
    geofence?: {
      enabled: boolean;
      latitude: number;
      longitude: number;
      radius: number;       // meters
    };
  };

  // Device & App Integration
  delivery: {
    method: 'app' | 'email' | 'sms' | 'wallet';
    deliveredAt?: string;
    deliveryStatus: 'pending' | 'delivered' | 'failed';

    deviceInfo?: {
      platform: 'ios' | 'android' | 'web';
      appVersion: string;
      deviceId: string;
      pushToken?: string;
    };

    // Backup delivery methods
    backupMethods?: {
      method: 'email' | 'sms';
      delivered: boolean;
      deliveredAt?: string;
    }[];
  };

  // Guest Instructions
  instructions: {
    checkInInstructions: string;
    accessInstructions: string;
    emergencyInstructions: string;
    wifiCredentials?: {
      network: string;
      password: string;
    };
    importantNumbers: {
      type: 'emergency' | 'concierge' | 'maintenance' | 'front_desk';
      name: string;
      number: string;
    }[];
  };

  // Metadata
  status: 'active' | 'expired' | 'revoked' | 'suspended';
  createdAt: string;
  updatedAt: string;

  // Cached unit details for performance
  unitContext: {
    unitNumber: string;
    unitName: string;
    modelName: string;
    floor: string;
    buildingSection?: string;
  };

  // GSI Keys
  GSI1PK: string;      // "BOOKING#<bookingId>"
  GSI1SK: string;      // "QRCODE#<createdAt>"
  GSI2PK: string;      // "PROPERTY_GROUP#<propertyGroupId>"
  GSI2SK: string;      // "QRCODE#<expiresAt>"
  GSI3PK: string;      // "STATUS#<status>"
  GSI3SK: string;      // "QRCODE#<createdAt>"
  GSI4PK: string;      // "UNIT#<unitId>"
  GSI4SK: string;      // "QRCODE#<issuedAt>"
  GSI5PK: string;      // "USER#<userId>"
  GSI5SK: string;      // "QRCODE#<issuedAt>"
  GSI6PK: string;      // "MODEL#<modelId>"
  GSI6SK: string;      // "QRCODE#<issuedAt>"
}

// QR Code Generation Request
export interface QRCodeGenerationRequest {
  bookingId: string;
  userId: string;
  propertyGroupId: string;
  unitId: string;

  // Access requirements
  accessType: 'unit_entry' | 'building_entry' | 'amenity_access' | 'parking';
  permissions: string[];

  // Validity period
  validFrom: string;
  validUntil: string;

  // Special requirements
  buildingAccessRequired?: boolean;
  amenityAccess?: string[];

  // Delivery preferences
  deliveryMethod: 'app' | 'email' | 'sms' | 'wallet';
  deviceInfo?: {
    platform: 'ios' | 'android' | 'web';
    deviceId: string;
    pushToken?: string;
  };
}

// QR Code Scan Result
export interface QRCodeScanResult {
  success: boolean;
  qrCodeId?: string;
  accessGranted: boolean;

  // Access details
  accessType?: string;
  location?: string;
  timestamp: string;

  // Error information
  errorCode?: string;
  errorMessage?: string;

  // Security information
  riskScore?: number;
  fraudFlags?: string[];

  // Usage information
  remainingUses?: number;
  expiresAt?: string;
}

// QR Code Analytics
export interface QRCodeAnalytics {
  // Primary Key
  PK: string;          // "ANALYTICS#qrcode"
  SK: string;          // "METRICS#<period>"

  period: string;      // "2024-07", "2024-Q3", "2024"
  periodType: 'day' | 'week' | 'month' | 'quarter' | 'year';

  // Usage Metrics
  metrics: {
    totalQRCodes: number;
    activeQRCodes: number;
    expiredQRCodes: number;
    revokedQRCodes: number;

    // Usage Statistics
    totalScans: number;
    successfulScans: number;
    failedScans: number;
    successRate: number;

    // Access Types
    accessTypeBreakdown: {
      type: string;
      count: number;
      percentage: number;
    }[];

    // Time-based patterns
    hourlyUsage: { hour: number; scans: number }[];
    dailyUsage: { day: number; scans: number }[];

    // Security Metrics
    fraudAttempts: number;
    suspiciousActivity: number;
    averageRiskScore: number;

    // Performance Metrics
    averageResponseTime: number; // milliseconds

    // Property Breakdown
    propertyUsage: {
      propertyGroupId: string;
      propertyName: string;
      totalScans: number;
      successRate: number;
    }[];
  };

  calculatedAt: string;

  // GSI Keys
  GSI1PK: string;      // "ANALYTICS#<periodType>"
  GSI1SK: string;      // "QRCODE_METRICS#<period>"
}

// Smart Lock Integration
export interface SmartLockIntegration {
  // Primary Key
  PK: string;          // "SMART_LOCK#<lockId>"
  SK: string;          // "METADATA"

  lockId: string;
  propertyGroupId: string;
  unitId?: string;     // null for building-wide locks

  // Lock Details
  lockInfo: {
    manufacturer: string;
    model: string;
    firmwareVersion: string;
    serialNumber: string;
    installationDate: string;
  };

  // Connectivity
  connectivity: {
    type: 'wifi' | 'bluetooth' | 'zigbee' | 'z-wave';
    signalStrength?: number;
    lastOnline: string;
    batteryLevel?: number;
    batteryLastChanged?: string;
  };

  // Access Codes
  accessCodes: {
    codeId: string;
    code: string;
    type: 'master' | 'guest' | 'maintenance' | 'emergency';
    validFrom: string;
    validUntil: string;
    usageCount: number;
    maxUsage?: number;
    associatedQRCodeId?: string;
  }[];

  // Configuration
  configuration: {
    autoLockDelay: number;    // seconds
    soundEnabled: boolean;
    ledEnabled: boolean;
    tamperAlerts: boolean;
    lowBatteryAlerts: boolean;
  };

  // Status
  status: 'online' | 'offline' | 'maintenance' | 'error';
  lastMaintenance?: string;
  nextMaintenance?: string;

  // Integration Settings
  integration: {
    apiEndpoint: string;
    apiKey: string;        // encrypted
    webhookUrl?: string;
    syncFrequency: number; // minutes
    lastSync: string;
  };

  // Metadata
  createdAt: string;
  updatedAt: string;

  // GSI Keys
  GSI1PK: string;      // "PROPERTY_GROUP#<propertyGroupId>"
  GSI1SK: string;      // "LOCK#<lockId>"
  GSI2PK: string;      // "LOCK_STATUS#<status>"
  GSI2SK: string;      // "LOCK#<lastOnline>"
}
