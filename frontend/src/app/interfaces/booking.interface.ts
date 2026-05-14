import { S3MediaFile } from './property.interface';

export interface BookingGuest {
  rooms: number;
  adults: number;
  children: number;
}

export interface BookingDateRange {
  start: Date | null;
  end: Date | null;
}

export interface GuestDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  specialRequests?: string;
  emailVerified?: boolean;
  verificationCode?: string;
  verificationSentAt?: Date;
}

export interface GuestIdDocument {
  id: string;
  type: 'passport' | 'national_id';
  documentNumber: string;
  expiryDate: Date;
  issuingCountry: string;
  issuingAuthority?: string;
  scannedImageUrl?: string;
  extractedData?: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: Date;
    nationality?: string;
    address?: string;
    documentNumber?: string;
    expiryDate?: Date;
    gender?: string;
  };
  verificationStatus: 'pending' | 'verified' | 'rejected';
  scannedAt: Date;
}

export interface CheckInData {
  // Primary Key
  PK: string;          // "CHECKIN#<checkInId>"
  SK: string;          // "METADATA"

  // Core Data
  checkInId: string;
  bookingId: string;
  userId: string;      // Changed from guestId for consistency
  unitId: string;      // Direct link to IndividualUnit
  propertyGroupId: string; // Direct link to PropertyGroup

  // Check-in Status & Process
  checkInStatus: 'not_started' | 'id_scanned' | 'verified' | 'completed';
  checkInTime?: string; // ISO string for consistency
  completedAt?: string;

  // Document Verification
  idDocuments: GuestIdDocument[];
  documentsVerified: boolean;
  verificationNotes?: string;

  // Trip Details
  tripReason?: 'private' | 'business';

  // QR Code Integration
  qrCodeGenerated?: boolean;
  qrCodeId?: string;   // Link to QRCode entity
  qrCodeData?: {
    code: string;
    expiresAt: string; // ISO string
    lockCode: string;
    accessInstructions: string;
  };

  // Additional Guests
  additionalGuests?: {
    name: string;
    idDocument?: GuestIdDocument;
    verified?: boolean;
  }[];

  // Unit Context (cached for performance)
  unitContext: {
    unitNumber: string;
    unitName: string;
    modelId: string;
    modelName: string;
    floor: string;
  };

  // Notes & Special Instructions
  notes?: string;
  specialInstructions?: string;

  // Metadata
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;   // ISO string
  updatedAt: string;   // ISO string

  // GSI Keys for efficient querying
  GSI1PK: string;      // "USER#<userId>"
  GSI1SK: string;      // "CHECKIN#<checkInTime>"
  GSI2PK: string;      // "BOOKING#<bookingId>"
  GSI2SK: string;      // "CHECKIN#<checkInTime>"
  GSI3PK: string;      // "UNIT#<unitId>"
  GSI3SK: string;      // "CHECKIN#<checkInTime>"
  GSI4PK: string;      // "PROPERTY_GROUP#<propertyGroupId>"
  GSI4SK: string;      // "CHECKIN#<checkInTime>"
}

export interface RoomSelection {
  roomType: string;
  roomId: string;
  roomName: string;
  pricePerNight: number;
  quantity: number;
  features: string[];
  maxOccupancy: number;
}

export interface AdditionalService {
  id: string;
  name: string;
  description: string;
  price: number;
  selected: boolean;
  quantity?: number;
}

export interface PaymentDetails {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardholderName: string;
  billingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

export interface BookingData {
  // Step 1: Guest Details & Dates
  guestDetails: GuestDetails;
  dateRange: BookingDateRange;
  guests: BookingGuest;

  // Step 2: Room Selection
  selectedRooms: RoomSelection[];

  // Step 3: Additional Services
  additionalServices: AdditionalService[];

  // Step 4: Payment
  paymentDetails: PaymentDetails;

  // Step 5: Payment Result
  paymentResult?: {
    success: boolean;
    paymentId?: string;
    error?: string;
    paymentMethod?: 'stripe' | 'paypal' | 'bank';
  };

  // Calculated fields
  subtotal: number;
  taxes: number;
  total: number;

  // Booking metadata
  bookingId?: string;
  status?: 'pending' | 'confirmed' | 'cancelled';
  createdAt?: Date;
}

export interface BookingStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  active: boolean;
}

export interface AvailableRoom {
  id: string;
  name: string;
  type: string;
  description: string;
  pricePerNight: number;
  maxOccupancy: number;
  features: string[];
  images: string[];
  available: boolean;
}

// Comprehensive Booking Model for DynamoDB
export interface BookingModel {
  // Primary Key
  PK: string;          // "BOOKING#<bookingId>"
  SK: string;          // "METADATA"

  // Core Booking Data
  bookingId: string;
  userId: string;
  propertyGroupId: string;  // Unit Group A

  // Stay Details
  stay: {
    checkIn: string;
    checkOut: string;
    nights: number;

    // What the user selected (model level)
    selectedModels: {
      modelId: string;        // "1br1b-city"
      modelName: string;      // "1 Room 1 Bed City Side"
      quantity: number;       // usually 1
      guests: {
        adults: number;
        children: number;
        childrenAges?: number[];
      };
    }[];

    // What was actually assigned (individual units)
    assignedUnits: {
      unitId: string;         // actual unit assigned
      unitNumber: string;     // "101"
      unitName: string;       // "Sunrise Suite 101"
      modelId: string;        // "1br1b-city"
      modelName: string;      // "1 Room 1 Bed City Side"
      assignedAt: string;
    }[];
  };

  // Guest Information
  primaryGuest: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth?: string;
    nationality?: string;
  };

  additionalGuests?: {
    firstName: string;
    lastName: string;
    age?: number;
    relationship?: string;
  }[];

  // Pricing Breakdown
  pricing: {
    unitTotal: number;    // base unit cost
    taxes: number;
    fees: number;
    discounts: number;
    total: number;
    currency: string;
    breakdown: {
      item: string;
      amount: number;
      type: 'unit' | 'tax' | 'fee' | 'discount';
      description?: string;
    }[];

    // Detailed pricing per night
    nightlyRates: {
      date: string;
      rate: number;
      originalRate: number;
      discountApplied?: number;
      reason?: string; // "weekend premium", "early bird discount"
    }[];
  };

  // Booking Status & Workflow
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
  paymentStatus: 'pending' | 'partial' | 'paid' | 'refunded' | 'failed';

  // Special Requests & Preferences
  specialRequests?: string;
  tripReason?: 'private' | 'business';
  accessibilityNeeds?: string[];

  // Check-in Data with Document Storage
  checkIn?: {
    status: 'not_started' | 'in_progress' | 'completed';
    startedAt?: string;
    completedAt?: string;
    documentsVerified: boolean;
    accessCodeGenerated: boolean;
    qrCodeId?: string;

    // ID Documents (S3 Storage)
    documents?: {
      documentId: string;
      guestName: string;
      type: 'passport' | 'national_id';
      s3Key: string;        // "bookings/{bookingId}/documents/{documentId}.jpg"
      s3Bucket: string;
      url: string;

      // Extracted Data
      extractedData?: {
        firstName?: string;
        lastName?: string;
        documentNumber?: string;
        expiryDate?: string;
        dateOfBirth?: string;
        nationality?: string;
        gender?: string;
        address?: string;
      };

      verificationStatus: 'pending' | 'verified' | 'rejected';
      verifiedAt?: string;
      verificationNotes?: string;

      metadata: {
        size: number;
        format: string;
        uploadedAt: string;
        ocrProcessed: boolean;
        ocrConfidence?: number;
      };
    }[];

    // Check-in preferences
    preferences?: {
      earlyCheckIn?: boolean;
      lateCheckOut?: boolean;
      roomPreferences?: string[];
      specialInstructions?: string;
    };
  };

  // Cancellation
  cancellation?: {
    cancelledAt: string;
    cancelledBy: string; // userId or 'system' or 'admin'
    reason: string;
    refundAmount: number;
    refundStatus: 'pending' | 'processed' | 'failed';
    refundProcessedAt?: string;
    cancellationFee?: number;
    notes?: string;
  };

  // Source & Attribution
  source: {
    channel: 'direct' | 'booking_com' | 'airbnb' | 'expedia' | 'mobile_app';
    campaign?: string;
    referrer?: string;
    affiliate?: string;
    device: 'web' | 'mobile' | 'tablet' | 'app';
  };

  // Communication History
  communications?: {
    communicationId: string;
    type: 'email' | 'sms' | 'push' | 'in_app';
    template: string;
    sentAt: string;
    status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed';
    content?: string;
  }[];

  // Metadata
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;

  // GSI Keys
  GSI1PK: string;      // "USER#<userId>"
  GSI1SK: string;      // "BOOKING#<createdAt>"
  GSI2PK: string;      // "PROPERTY_GROUP#<propertyGroupId>"
  GSI2SK: string;      // "BOOKING#<checkIn>"
  GSI3PK: string;      // "STATUS#<status>"
  GSI3SK: string;      // "BOOKING#<createdAt>"
  GSI4PK: string;      // "CHECK_IN_DATE#<checkIn>"
  GSI4SK: string;      // "BOOKING#<propertyGroupId>"
}

// Booking Search Filters
export interface BookingSearchFilters {
  userId?: string;
  propertyGroupId?: string;
  status?: string[];
  paymentStatus?: string[];
  dateRange?: {
    start: string;
    end: string;
    field: 'createdAt' | 'checkIn' | 'checkOut';
  };
  priceRange?: {
    min: number;
    max: number;
  };
  guestName?: string;
  bookingId?: string;
}

// Booking Summary
export interface BookingSummary {
  bookingId: string;
  propertyName: string;
  unitName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  total: number;
  currency: string;
  status: string;
  paymentStatus: string;
}
