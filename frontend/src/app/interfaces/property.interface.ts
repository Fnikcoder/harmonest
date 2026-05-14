// Property Group Model (Building/Location)
export interface PropertyGroup {
  // Primary Key
  PK: string;           // "PROPERTY_GROUP#<groupId>"
  SK: string;           // "METADATA"

  // Core Group Data
  groupId: string;
  name: string;         // "Sunset Apartments", "Downtown Hotel Complex"
  description: string;
  type: 'apartment_complex' | 'hotel' | 'resort' | 'condo_building' | 'villa_compound';

  // Location
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };

  // Building Information
  buildingInfo: {
    floors: number;
    totalUnits: number;
    buildingYear?: number;
    renovationYear?: number;
    architect?: string;
    buildingStyle?: string;
  };

  // Contact Information
  contact: {
    phone: string;
    email: string;
    website?: string;
    emergencyContact: string;
    managementCompany?: string;
  };

  // Group-Level Amenities
  amenities: string[];  // ['pool', 'gym', 'parking', 'concierge', 'rooftop', 'laundry']

  // Policies (applies to all units)
  policies: {
    checkInTime: string;
    checkOutTime: string;
    cancellationPolicy: string;
    petPolicy: string;
    smokingPolicy: string;
    ageRestriction?: number;
    quietHours?: {
      start: string;
      end: string;
    };
  };

  // Smart Lock Integration (building-wide)
  smartLockConfig: {
    enabled: boolean;
    provider: string;     // 'yale', 'august', 'schlage'
    buildingAccessRequired: boolean;
    apiEndpoint?: string;
    credentials?: string; // encrypted
  };

  // Media (S3 Storage)
  media: {
    images: S3MediaFile[];
    videos?: S3MediaFile[];
    documents?: S3MediaFile[];
  };

  // Business Data
  rating: number;
  reviewCount: number;
  priceRange: {
    min: number;
    max: number;
    currency: string;
  };

  // Status & Metadata
  status: 'active' | 'inactive' | 'under_construction' | 'maintenance';
  ownerId: string;
  managementCompanyId?: string;
  createdAt: string;
  updatedAt: string;

  // GSI Keys
  GSI1PK: string;       // "OWNER#<ownerId>"
  GSI1SK: string;       // "PROPERTY_GROUP#<createdAt>"
  GSI2PK: string;       // "LOCATION#<city>#<country>"
  GSI2SK: string;       // "PROPERTY_GROUP#<rating>"
}

// Unit Model (Room Type/Configuration)
export interface UnitModel {
  // Primary Key
  PK: string;           // "PROPERTY_GROUP#<groupId>"
  SK: string;           // "UNIT_MODEL#<modelId>"

  // Core Model Data
  modelId: string;      // "1br1b-city", "1br1b-mountain", "2br4b", "1br4b", "2br6b"
  groupId: string;      // Parent property group
  name: string;         // "1 Room 1 Bed City Side", "1 Room 1 Bed Mountain Side"
  description: string;

  // Model Configuration
  configuration: {
    rooms: number;      // 1, 2
    beds: number;       // 1, 4, 6
    bathrooms: number;  // 1, 1.5, 2
    bedTypes: {
      type: 'single' | 'double' | 'queen' | 'king' | 'bunk';
      count: number;
      room: string;     // "master", "bedroom_2", "living_room"
    }[];
  };

  // Capacity
  capacity: {
    adults: number;
    children: number;
    maxOccupancy: number;
  };

  // Model Features
  features: {
    view: 'city' | 'mountain' | 'ocean' | 'garden' | 'courtyard';
    amenities: string[];  // ['balcony', 'kitchen', 'workspace']
    appliances: string[]; // ['refrigerator', 'microwave', 'dishwasher']
  };

  // Physical Details
  physical: {
    size: number;        // square feet/meters
    sizeUnit: 'sqft' | 'sqm';
    floor?: string;      // "2-5" (floors where this model exists)
    orientation?: string;
  };

  // Pricing with Optimization
  pricing: {
    basePrice: number;
    currency: string;
    priceType: 'per_night' | 'per_week' | 'per_month';
    currentPrice: number;
    lastPriceUpdate: string;

    // Price calendar - prices for specific date ranges
    priceCalendar: {
      startDate: string;
      endDate: string;
      price: number;
      priceSource: 'base' | 'seasonal' | 'event' | 'optimization' | 'manual';
      setAt: string;
      setBy: 'system' | 'admin' | 'optimization_engine';
    }[];

    // Simple pricing rules
    rules: {
      seasonal: {
        season: 'peak' | 'high' | 'shoulder' | 'low';
        startDate: string;
        endDate: string;
        priceMultiplier: number;
      }[];

      weekend: {
        enabled: boolean;
        fridayMultiplier: number;
        saturdayMultiplier: number;
        sundayMultiplier: number;
      };

      lengthOfStay: {
        minNights: number;
        discountPercent: number;
      }[];

      advanceBooking: {
        daysInAdvance: number;
        discountPercent: number;
      }[];
    };

    // Price optimization settings
    optimization?: {
      enabled: boolean;
      strategy: 'maximize_revenue' | 'maximize_occupancy' | 'balanced';
      minPrice: number;
      maxPrice: number;
      adjustmentFrequency: 'daily' | 'weekly' | 'event_driven';
      factors: {
        occupancyWeight: number;
        competitorWeight: number;
        demandWeight: number;
        seasonalityWeight: number;
        eventWeight: number;
      };
    };
  };

  // Inventory Summary
  inventory: {
    totalUnits: number;
    availableUnits: number;
    occupiedUnits: number;
    maintenanceUnits: number;
    lastUpdated: string;
  };

  // Media (S3 Storage)
  media: {
    images: S3MediaFile[];
    floorPlan?: S3MediaFile;
  };

  // Metadata
  status: 'active' | 'inactive' | 'sold_out';
  createdAt: string;
  updatedAt: string;

  // GSI Keys
  GSI1PK: string;      // "PROPERTY_GROUP#<groupId>"
  GSI1SK: string;      // "MODEL#<rooms>R#<beds>B#<view>#<price>"
  GSI2PK: string;      // "AVAILABILITY#available"
  GSI2SK: string;      // "MODEL#<groupId>#<availableUnits>"
}

// Individual Unit (Actual Room)
export interface IndividualUnit {
  // Primary Key
  PK: string;           // "UNIT_MODEL#<modelId>"
  SK: string;           // "INDIVIDUAL_UNIT#<unitId>"

  // Core Unit Data
  unitId: string;
  modelId: string;
  groupId: string;

  // Unit Identity
  identity: {
    unitNumber: string; // "101", "A-205", "City-View-3"
    unitName: string;   // "Sunrise Suite 101", "Mountain View A-205"
    floor: number;
    building?: string;  // if multiple buildings in group
  };

  // Unit-Specific Details
  specifics: {
    exactView?: string;     // "North City View", "South Mountain View"
    corner: boolean;
    balconySize?: number;
    renovationDate?: string;
    condition: 'excellent' | 'good' | 'fair' | 'needs_renovation';
  };

  // Smart Lock (unit-specific)
  smartLock: {
    lockId: string;
    model: string;
    batteryLevel?: number;
    lastSync: string;
    accessCodes: {
      master: string;
      guest: string;
      maintenance: string;
    };
  };

  // Current Status
  status: {
    availability: 'available' | 'occupied' | 'maintenance' | 'cleaning' | 'blocked';
    currentBookingId?: string;

    occupancy?: {
      checkIn: string;
      checkOut: string;
      guestCount: number;
      rateCharged: number;
    };

    maintenance?: {
      type: 'routine' | 'repair' | 'deep_clean' | 'renovation';
      startDate: string;
      estimatedEndDate: string;
      description: string;
    };
  };

  // Booking Restrictions
  restrictions: {
    minimumStay: number;
    maximumStay?: number;
    blockedDates?: {
      start: string;
      end: string;
      reason: string;
    }[];
  };

  // Unit-Specific Media
  media?: {
    images: S3MediaFile[];
  };

  // Maintenance History
  maintenanceHistory: {
    lastCleaned: string;
    lastDeepCleaned: string;
    lastMaintenance: string;
    nextScheduledMaintenance?: string;

    issues: {
      issueId: string;
      description: string;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      status: 'open' | 'in_progress' | 'resolved';
      reportedAt: string;
      resolvedAt?: string;
    }[];
  };

  // Performance Metrics
  performance: {
    bookingHistory: {
      bookingId: string;
      checkIn: string;
      checkOut: string;
      rateCharged: number;
      guestRating?: number;
      revenue: number;
    }[];

    last30Days: {
      occupancyRate: number;
      averageRate: number;
      totalRevenue: number;
      bookingsCount: number;
    };
  };

  // Metadata
  createdAt: string;
  updatedAt: string;

  // GSI Keys
  GSI1PK: string;      // "UNIT_MODEL#<modelId>"
  GSI1SK: string;      // "UNIT#<availability>#<unitNumber>"
  GSI2PK: string;      // "PROPERTY_GROUP#<groupId>"
  GSI2SK: string;      // "UNIT#<status>#<unitId>"
  GSI3PK: string;      // "AVAILABILITY#<availability>"
  GSI3SK: string;      // "UNIT#<groupId>#<modelId>#<unitId>"
}

// S3 Media File Interface
export interface S3MediaFile {
  s3Key: string;
  s3Bucket: string;
  url: string;
  thumbnailS3Key?: string;
  alt: string;
  type: string;
  order?: number;
  metadata: {
    size: number;
    width?: number;
    height?: number;
    format: string;
    uploadedAt: string;
  };
}

// Property Search Filters
export interface PropertySearchFilters {
  location?: {
    city?: string;
    state?: string;
    country?: string;
    radius?: number; // km
  };
  dates?: {
    checkIn: string;
    checkOut: string;
  };
  guests?: {
    adults: number;
    children: number;
  };
  priceRange?: {
    min: number;
    max: number;
  };
  amenities?: string[];
  propertyType?: string[];
  rating?: number;
}

// Property Search Result
export interface PropertySearchResult {
  propertyGroup: PropertyGroup;
  availableModels: {
    model: UnitModel;
    availableUnits: number;
    lowestPrice: number;
    highestPrice: number;
  }[];
  distance?: number; // if location search
  matchScore: number; // relevance score
}
