import { S3MediaFile } from './property.interface';

// User Model
export interface User {
  // Primary Key
  PK: string;          // "USER#<userId>"
  SK: string;          // "PROFILE"
  
  // Core User Data
  userId: string;
  email: string;
  emailVerified: boolean;
  phone?: string;
  phoneVerified: boolean;
  
  // Personal Information
  profile: {
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
    nationality?: string;
    preferredLanguage: string;
    timezone: string;
    
    // Profile Media (S3)
    avatar?: S3MediaFile;
  };
  
  // Address
  address?: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
  };
  
  // Authentication
  auth: {
    passwordHash?: string;  // for email/password auth
    providers: {
      type: 'google' | 'facebook' | 'apple' | 'email';
      providerId: string;
      connectedAt: string;
    }[];
    lastLogin: string;
    loginCount: number;
    twoFactorEnabled: boolean;
    securityQuestions?: {
      question: string;
      answerHash: string;
    }[];
  };
  
  // Preferences
  preferences: {
    currency: string;
    notifications: {
      email: boolean;
      sms: boolean;
      push: boolean;
      marketing: boolean;
      bookingReminders: boolean;
      priceAlerts: boolean;
    };
    accessibility: {
      screenReader: boolean;
      highContrast: boolean;
      largeText: boolean;
    };
    privacy: {
      profileVisibility: 'public' | 'private';
      shareDataForMarketing: boolean;
      shareDataForAnalytics: boolean;
    };
  };
  
  // Travel Profile
  travelProfile: {
    frequentDestinations: string[];
    preferredRoomType: string;
    specialRequests: string[];
    dietaryRestrictions: string[];
    emergencyContact: {
      name: string;
      phone: string;
      relationship: string;
    };
    travelPurpose: 'business' | 'leisure' | 'both';
    budgetRange: {
      min: number;
      max: number;
      currency: string;
    };
  };
  
  // Loyalty & Stats
  loyalty: {
    points: number;
    tier: 'bronze' | 'silver' | 'gold' | 'platinum';
    totalBookings: number;
    totalSpent: number;
    memberSince: string;
    benefits: string[];
    nextTierRequirement?: {
      pointsNeeded: number;
      spendingNeeded: number;
      bookingsNeeded: number;
    };
  };
  
  // Payment Methods
  paymentMethods: {
    methodId: string;
    type: 'credit_card' | 'debit_card' | 'paypal' | 'bank_account';
    isDefault: boolean;
    
    // Card details (tokenized)
    card?: {
      last4: string;
      brand: 'visa' | 'mastercard' | 'amex' | 'discover';
      expiryMonth: number;
      expiryYear: number;
      holderName: string;
    };
    
    // Digital wallet
    wallet?: {
      type: 'paypal' | 'apple_pay' | 'google_pay';
      email?: string;
    };
    
    billingAddress: {
      street: string;
      city: string;
      state: string;
      country: string;
      zipCode: string;
    };
    
    addedAt: string;
    lastUsed?: string;
  }[];
  
  // Verification Documents
  verification: {
    identityVerified: boolean;
    phoneVerified: boolean;
    emailVerified: boolean;
    
    documents?: {
      documentId: string;
      type: 'passport' | 'national_id' | 'drivers_license';
      s3Key: string;
      verificationStatus: 'pending' | 'verified' | 'rejected';
      verifiedAt?: string;
      expiryDate?: string;
    }[];
    
    verificationLevel: 'basic' | 'standard' | 'enhanced';
  };
  
  // Status & Metadata
  status: 'active' | 'suspended' | 'deleted';
  role: 'guest' | 'host' | 'admin' | 'super_admin';
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
  
  // GSI Keys
  GSI1PK: string;      // "EMAIL#<email>"
  GSI1SK: string;      // "USER"
  GSI2PK: string;      // "PHONE#<phone>"
  GSI2SK: string;      // "USER"
  GSI3PK: string;      // "ROLE#<role>"
  GSI3SK: string;      // "USER#<createdAt>"
}

// User Session
export interface UserSession {
  // Primary Key
  PK: string;          // "USER#<userId>"
  SK: string;          // "SESSION#<sessionId>"
  
  sessionId: string;
  userId: string;
  deviceInfo: {
    userAgent: string;
    platform: 'web' | 'ios' | 'android';
    deviceId?: string;
    ipAddress: string;
    location?: {
      country: string;
      city: string;
    };
  };
  
  // Session Data
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  isActive: boolean;
  
  // Security
  refreshToken: string;
  accessToken: string;
  tokenExpiresAt: string;
  
  // GSI Keys
  GSI1PK: string;      // "SESSION#active"
  GSI1SK: string;      // "SESSION#<lastActiveAt>"
}

// User Activity Log
export interface UserActivity {
  // Primary Key
  PK: string;          // "USER#<userId>"
  SK: string;          // "ACTIVITY#<timestamp>#<activityId>"
  
  activityId: string;
  userId: string;
  type: 'login' | 'logout' | 'booking_created' | 'booking_cancelled' | 'payment_made' | 'profile_updated' | 'password_changed';
  
  details: {
    description: string;
    metadata?: any;
    ipAddress: string;
    userAgent: string;
    location?: {
      country: string;
      city: string;
    };
  };
  
  timestamp: string;
  
  // GSI Keys
  GSI1PK: string;      // "ACTIVITY#<type>"
  GSI1SK: string;      // "ACTIVITY#<timestamp>"
}

// User Preferences
export interface UserPreferences {
  // Primary Key
  PK: string;          // "USER#<userId>"
  SK: string;          // "PREFERENCES"
  
  userId: string;
  
  // Notification Preferences
  notifications: {
    channels: {
      email: boolean;
      sms: boolean;
      push: boolean;
      inApp: boolean;
    };
    
    types: {
      bookingConfirmation: boolean;
      bookingReminder: boolean;
      checkInReminder: boolean;
      paymentReceipt: boolean;
      promotionalOffers: boolean;
      priceDropAlerts: boolean;
      loyaltyUpdates: boolean;
      securityAlerts: boolean;
    };
    
    timing: {
      bookingReminder: number; // hours before check-in
      checkInReminder: number; // hours before check-in
      quietHours: {
        start: string; // "22:00"
        end: string;   // "08:00"
        timezone: string;
      };
    };
  };
  
  // Search & Booking Preferences
  search: {
    defaultLocation?: string;
    preferredCurrency: string;
    priceRange: {
      min: number;
      max: number;
    };
    preferredAmenities: string[];
    roomPreferences: {
      bedType: string;
      smokingPreference: 'non_smoking' | 'smoking' | 'no_preference';
      floorPreference: 'low' | 'high' | 'no_preference';
      viewPreference: string[];
    };
  };
  
  // Privacy Settings
  privacy: {
    profileVisibility: 'public' | 'private';
    showReviews: boolean;
    shareDataForMarketing: boolean;
    shareDataForAnalytics: boolean;
    allowThirdPartyContact: boolean;
  };
  
  // Accessibility Settings
  accessibility: {
    screenReader: boolean;
    highContrast: boolean;
    largeText: boolean;
    reducedMotion: boolean;
    keyboardNavigation: boolean;
  };
  
  updatedAt: string;
}

// User Review
export interface UserReview {
  // Primary Key
  PK: string;          // "USER#<userId>"
  SK: string;          // "REVIEW#<reviewId>"
  
  reviewId: string;
  userId: string;
  bookingId: string;
  propertyGroupId: string;
  unitModelId: string;
  
  // Review Content
  rating: {
    overall: number;     // 1-5
    cleanliness: number;
    accuracy: number;
    checkIn: number;
    communication: number;
    location: number;
    value: number;
  };
  
  review: {
    title: string;
    content: string;
    pros: string[];
    cons: string[];
    photos?: S3MediaFile[];
  };
  
  // Review Metadata
  stayDate: string;
  reviewDate: string;
  verified: boolean;
  helpful: number;     // helpful votes
  reported: boolean;
  
  // Response from host
  hostResponse?: {
    content: string;
    respondedAt: string;
    respondedBy: string;
  };
  
  status: 'published' | 'pending' | 'rejected' | 'hidden';
  
  // GSI Keys
  GSI1PK: string;      // "PROPERTY_GROUP#<propertyGroupId>"
  GSI1SK: string;      // "REVIEW#<rating>#<reviewDate>"
  GSI2PK: string;      // "BOOKING#<bookingId>"
  GSI2SK: string;      // "REVIEW#<reviewDate>"
}

// User Wishlist
export interface UserWishlist {
  // Primary Key
  PK: string;          // "USER#<userId>"
  SK: string;          // "WISHLIST#<propertyGroupId>"
  
  userId: string;
  propertyGroupId: string;
  unitModelId?: string; // specific model or entire property
  
  addedAt: string;
  notes?: string;
  priceAlert?: {
    enabled: boolean;
    targetPrice: number;
    currency: string;
  };
  
  // GSI Keys
  GSI1PK: string;      // "WISHLIST#<userId>"
  GSI1SK: string;      // "PROPERTY#<addedAt>"
}
