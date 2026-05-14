import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, delay, tap } from 'rxjs/operators';

// Import all interfaces
import { PropertyGroup, UnitModel, IndividualUnit, PropertySearchFilters, PropertySearchResult } from '../interfaces/property.interface';
import { User, UserSession, UserActivity, UserPreferences } from '../interfaces/user.interface';
import { BookingModel, BookingSearchFilters, BookingSummary, CheckInData } from '../interfaces/booking.interface';
import { Payment, PaymentIntent, PaymentMethod } from '../interfaces/payment.interface';
import { QRCode, QRCodeGenerationRequest, QRCodeScanResult } from '../interfaces/qrcode.interface';

@Injectable({
  providedIn: 'root'
})
export class DataService {

  // In-memory data stores (in real app, these would be DynamoDB calls)
  private propertyGroups: PropertyGroup[] = [];
  private unitModels: UnitModel[] = [];
  private individualUnits: IndividualUnit[] = [];
  private users: User[] = [];
  private bookings: BookingModel[] = [];
  private payments: Payment[] = [];
  private qrCodes: QRCode[] = [];
  private checkIns: CheckInData[] = [];

  // Subjects for real-time updates
  private propertyGroupsSubject = new BehaviorSubject<PropertyGroup[]>([]);
  private bookingsSubject = new BehaviorSubject<BookingModel[]>([]);
  private paymentsSubject = new BehaviorSubject<Payment[]>([]);
  private checkInsSubject = new BehaviorSubject<CheckInData[]>([]);

  constructor() {
    this.initializeMockData();
  }

  // ==================== PROPERTY METHODS ====================

  /**
   * Get all property groups
   */
  getPropertyGroups(): Observable<PropertyGroup[]> {
    return of(this.propertyGroups).pipe(delay(500));
  }

  /**
   * Get property group by ID
   */
  getPropertyGroup(groupId: string): Observable<PropertyGroup | null> {
    return of(this.propertyGroups.find(pg => pg.groupId === groupId) || null).pipe(delay(300));
  }

  /**
   * Search properties
   */
  searchProperties(filters: PropertySearchFilters): Observable<PropertySearchResult[]> {
    return of(this.propertyGroups).pipe(
      delay(800),
      map(groups => {
        let filteredGroups = groups;

        // Apply location filter
        if (filters.location?.city) {
          filteredGroups = filteredGroups.filter(g =>
            g.address.city.toLowerCase().includes(filters.location!.city!.toLowerCase())
          );
        }

        // Apply price range filter
        if (filters.priceRange) {
          filteredGroups = filteredGroups.filter(g =>
            g.priceRange.min <= filters.priceRange!.max! &&
            g.priceRange.max >= filters.priceRange!.min!
          );
        }

        // Apply amenities filter
        if (filters.amenities && filters.amenities.length > 0) {
          filteredGroups = filteredGroups.filter(g =>
            filters.amenities!.some(amenity => g.amenities.includes(amenity))
          );
        }

        // Convert to search results
        return filteredGroups.map(group => ({
          propertyGroup: group,
          availableModels: this.getAvailableModelsForGroup(group.groupId),
          matchScore: Math.random() * 100 // Mock relevance score
        }));
      })
    );
  }

  /**
   * Get unit models for a property group
   */
  getUnitModels(groupId: string): Observable<UnitModel[]> {
    return of(this.unitModels.filter(um => um.groupId === groupId)).pipe(delay(400));
  }

  /**
   * Get individual units for a unit model
   */
  getIndividualUnits(modelId: string): Observable<IndividualUnit[]> {
    return of(this.individualUnits.filter(iu => iu.modelId === modelId)).pipe(delay(400));
  }

  /**
   * Create property group
   */
  createPropertyGroup(propertyGroup: Partial<PropertyGroup>): Observable<PropertyGroup> {
    const newGroup: PropertyGroup = {
      PK: `PROPERTY_GROUP#${propertyGroup.groupId}`,
      SK: 'METADATA',
      groupId: propertyGroup.groupId!,
      name: propertyGroup.name!,
      description: propertyGroup.description!,
      type: propertyGroup.type!,
      address: propertyGroup.address!,
      buildingInfo: propertyGroup.buildingInfo!,
      contact: propertyGroup.contact!,
      amenities: propertyGroup.amenities || [],
      policies: propertyGroup.policies!,
      smartLockConfig: propertyGroup.smartLockConfig!,
      media: propertyGroup.media || { images: [] },
      rating: 0,
      reviewCount: 0,
      priceRange: propertyGroup.priceRange!,
      status: 'active',
      ownerId: propertyGroup.ownerId!,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      GSI1PK: `OWNER#${propertyGroup.ownerId}`,
      GSI1SK: `PROPERTY_GROUP#${new Date().toISOString()}`,
      GSI2PK: `LOCATION#${propertyGroup.address!.city}#${propertyGroup.address!.country}`,
      GSI2SK: 'PROPERTY_GROUP#0'
    };

    this.propertyGroups.push(newGroup);
    this.propertyGroupsSubject.next(this.propertyGroups);

    return of(newGroup).pipe(delay(600));
  }

  // ==================== USER METHODS ====================

  /**
   * Get user by ID
   */
  getUser(userId: string): Observable<User | null> {
    return of(this.users.find(u => u.userId === userId) || null).pipe(delay(300));
  }

  /**
   * Get user by email
   */
  getUserByEmail(email: string): Observable<User | null> {
    return of(this.users.find(u => u.email === email) || null).pipe(delay(300));
  }

  /**
   * Create user
   */
  createUser(userData: Partial<User>): Observable<User> {
    const newUser: User = {
      PK: `USER#${userData.userId}`,
      SK: 'PROFILE',
      userId: userData.userId!,
      email: userData.email!,
      emailVerified: false,
      phone: userData.phone,
      phoneVerified: false,
      profile: userData.profile!,
      address: userData.address,
      auth: userData.auth!,
      preferences: userData.preferences!,
      travelProfile: userData.travelProfile!,
      loyalty: {
        points: 0,
        tier: 'bronze',
        totalBookings: 0,
        totalSpent: 0,
        memberSince: new Date().toISOString(),
        benefits: []
      },
      paymentMethods: [],
      verification: {
        identityVerified: false,
        phoneVerified: false,
        emailVerified: false,
        verificationLevel: 'basic'
      },
      status: 'active',
      role: 'guest',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      GSI1PK: `EMAIL#${userData.email}`,
      GSI1SK: 'USER',
      GSI2PK: userData.phone ? `PHONE#${userData.phone}` : '',
      GSI2SK: 'USER',
      GSI3PK: 'ROLE#guest',
      GSI3SK: `USER#${new Date().toISOString()}`
    };

    this.users.push(newUser);
    return of(newUser).pipe(delay(600));
  }

  /**
   * Update user
   */
  updateUser(userId: string, updates: Partial<User>): Observable<User> {
    const userIndex = this.users.findIndex(u => u.userId === userId);
    if (userIndex === -1) {
      throw new Error('User not found');
    }

    this.users[userIndex] = {
      ...this.users[userIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    return of(this.users[userIndex]).pipe(delay(400));
  }

  // ==================== BOOKING METHODS ====================

  /**
   * Get bookings for user
   */
  getUserBookings(userId: string): Observable<BookingModel[]> {
    return of(this.bookings.filter(b => b.userId === userId)).pipe(delay(500));
  }

  /**
   * Get booking by ID
   */
  getBooking(bookingId: string): Observable<BookingModel | null> {
    return of(this.bookings.find(b => b.bookingId === bookingId) || null).pipe(delay(300));
  }

  /**
   * Search bookings
   */
  searchBookings(filters: BookingSearchFilters): Observable<BookingModel[]> {
    return of(this.bookings).pipe(
      delay(600),
      map(bookings => {
        let filtered = bookings;

        if (filters.userId) {
          filtered = filtered.filter(b => b.userId === filters.userId);
        }

        if (filters.status && filters.status.length > 0) {
          filtered = filtered.filter(b => filters.status!.includes(b.status));
        }

        if (filters.propertyGroupId) {
          filtered = filtered.filter(b => b.propertyGroupId === filters.propertyGroupId);
        }

        if (filters.dateRange) {
          const start = new Date(filters.dateRange.start);
          const end = new Date(filters.dateRange.end);

          filtered = filtered.filter(b => {
            const bookingDate = new Date(
              filters.dateRange!.field === 'checkIn' ? b.stay.checkIn :
              filters.dateRange!.field === 'checkOut' ? b.stay.checkOut :
              b.createdAt
            );
            return bookingDate >= start && bookingDate <= end;
          });
        }

        return filtered;
      })
    );
  }

  /**
   * Create booking
   */
  createBooking(bookingData: Partial<BookingModel>): Observable<BookingModel> {
    const bookingId = 'BK' + Date.now().toString();

    const newBooking: BookingModel = {
      PK: `BOOKING#${bookingId}`,
      SK: 'METADATA',
      bookingId,
      userId: bookingData.userId!,
      propertyGroupId: bookingData.propertyGroupId!,
      stay: bookingData.stay!,
      primaryGuest: bookingData.primaryGuest!,
      additionalGuests: bookingData.additionalGuests,
      pricing: bookingData.pricing!,
      status: 'pending',
      paymentStatus: 'pending',
      specialRequests: bookingData.specialRequests,
      tripReason: bookingData.tripReason,
      accessibilityNeeds: bookingData.accessibilityNeeds,
      source: bookingData.source!,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      GSI1PK: `USER#${bookingData.userId}`,
      GSI1SK: `BOOKING#${new Date().toISOString()}`,
      GSI2PK: `PROPERTY_GROUP#${bookingData.propertyGroupId}`,
      GSI2SK: `BOOKING#${bookingData.stay!.checkIn}`,
      GSI3PK: 'STATUS#pending',
      GSI3SK: `BOOKING#${new Date().toISOString()}`,
      GSI4PK: `CHECK_IN_DATE#${bookingData.stay!.checkIn}`,
      GSI4SK: `BOOKING#${bookingData.propertyGroupId}`
    };

    this.bookings.push(newBooking);
    this.bookingsSubject.next(this.bookings);

    return of(newBooking).pipe(delay(800));
  }

  // ==================== PAYMENT METHODS ====================

  /**
   * Get payments for booking
   */
  getBookingPayments(bookingId: string): Observable<Payment[]> {
    return of(this.payments.filter(p => p.bookingId === bookingId)).pipe(delay(400));
  }

  /**
   * Create payment
   */
  createPayment(paymentData: Partial<Payment>): Observable<Payment> {
    const paymentId = 'PAY' + Date.now().toString();

    const newPayment: Payment = {
      PK: `PAYMENT#${paymentId}`,
      SK: 'METADATA',
      paymentId,
      bookingId: paymentData.bookingId!,
      userId: paymentData.userId!,
      amount: paymentData.amount!,
      paymentMethod: paymentData.paymentMethod!,
      transaction: {
        status: 'pending',
        gatewayTransactionId: 'txn_' + Date.now(),
        paymentFlow: 'immediate'
      },
      security: paymentData.security!,
      billingAddress: paymentData.billingAddress!,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      GSI1PK: `BOOKING#${paymentData.bookingId}`,
      GSI1SK: `PAYMENT#${new Date().toISOString()}`,
      GSI2PK: `USER#${paymentData.userId}`,
      GSI2SK: `PAYMENT#${new Date().toISOString()}`,
      GSI3PK: 'STATUS#pending',
      GSI3SK: `PAYMENT#${new Date().toISOString()}`,
      GSI4PK: `GATEWAY#${paymentData.paymentMethod!.provider}`,
      GSI4SK: `PAYMENT#txn_${Date.now()}`,
      propertyGroupId: '',
      unitBreakdown: [],
      GSI5PK: '',
      GSI5SK: ''
    };

    this.payments.push(newPayment);
    this.paymentsSubject.next(this.payments);

    return of(newPayment).pipe(delay(600));
  }

  // ==================== QR CODE METHODS ====================

  /**
   * Generate QR Code
   */
  generateQRCode(request: QRCodeGenerationRequest): Observable<QRCode> {
    const qrCodeId = 'QR' + Date.now().toString();
    const qrString = this.generateQRString(request);

    const newQRCode: QRCode = {
      PK: `QRCODE#${qrCodeId}`,
      SK: 'METADATA',
      qrCodeId,
      bookingId: request.bookingId,
      userId: request.userId,
      propertyGroupId: request.propertyGroupId,
      unitId: request.unitId,
      code: {
        data: JSON.stringify({
          bookingId: request.bookingId,
          unitId: request.unitId,
          validFrom: request.validFrom,
          validUntil: request.validUntil,
          permissions: request.permissions
        }),
        format: 'encrypted_json',
        algorithm: 'AES256',
        signature: 'sig_' + Date.now(),
        version: '1.0'
      },
      qrString,
      access: {
        type: request.accessType,
        permissions: request.permissions,
        unitAccess: {
          unitNumber: '101', // Mock
          lockId: 'lock_' + request.unitId,
          accessCode: Math.floor(100000 + Math.random() * 900000).toString(),
          masterKey: false
        },
        restrictions: {
          timeWindows: [{
            start: request.validFrom,
            end: request.validUntil,
            days: [0, 1, 2, 3, 4, 5, 6]
          }]
        }
      },
      smartLock: {
        unitLock: {
          lockId: 'lock_' + request.unitId,
          lockType: 'smart_deadbolt',
          accessCode: Math.floor(100000 + Math.random() * 900000).toString(),
          lastSync: new Date().toISOString()
        },
        provider: {
          name: 'yale',
          apiVersion: '2.0'
        }
      },
      validity: {
        issuedAt: new Date().toISOString(),
        expiresAt: request.validUntil,
        autoExtend: false,
        maxExtensions: 0,
        extensionsUsed: 0,
        gracePeriod: {
          beforeCheckIn: 2,
          afterCheckOut: 1
        }
      },
      usage: {
        totalScans: 0,
        successfulScans: 0,
        failedScans: 0,
        usageHistory: [],
        patterns: {
          mostUsedHour: 0,
          mostUsedDay: 0,
          averageUsesPerDay: 0
        }
      },
      security: {
        encryptionKey: 'key_' + Date.now(),
        rotationSchedule: '0 0 * * *',
        lastRotated: new Date().toISOString(),
        fraudDetection: {
          enabled: true,
          suspiciousActivity: false,
          riskScore: 0,
          lastRiskAssessment: new Date().toISOString()
        }
      },
      delivery: {
        method: request.deliveryMethod,
        deliveryStatus: 'pending',
        deviceInfo: request.deviceInfo ? {
          ...request.deviceInfo,
          appVersion: '1.0.0' // Default version if not provided
        } : undefined
      },
      instructions: {
        checkInInstructions: 'Use this QR code to access your unit.',
        accessInstructions: 'Scan at the door lock to unlock.',
        emergencyInstructions: 'Call front desk at +1-555-0123 for assistance.',
        importantNumbers: [
          {type: 'front_desk', name: 'Front Desk', number: '+1-555-0123'},
          {type: 'emergency', name: 'Emergency', number: '911'}
        ]
      },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      GSI1PK: `BOOKING#${request.bookingId}`,
      GSI1SK: `QRCODE#${new Date().toISOString()}`,
      GSI2PK: `PROPERTY_GROUP#${request.propertyGroupId}`,
      GSI2SK: `QRCODE#${request.validUntil}`,
      GSI3PK: 'STATUS#active',
      GSI3SK: `QRCODE#${new Date().toISOString()}`,
      GSI4PK: `UNIT#${request.unitId}`,
      GSI4SK: `QRCODE#${new Date().toISOString()}`,
      modelId: '',
      unitContext: {
        unitNumber: '',
        unitName: '',
        modelName: '',
        floor: '',
        buildingSection: undefined
      },
      GSI5PK: '',
      GSI5SK: '',
      GSI6PK: '',
      GSI6SK: ''
    };

    this.qrCodes.push(newQRCode);
    return of(newQRCode).pipe(delay(1000));
  }

  /**
   * Scan QR Code
   */
  scanQRCode(qrString: string, location: string): Observable<QRCodeScanResult> {
    return of(null).pipe(
      delay(800),
      map(() => {
        const qrCode = this.qrCodes.find(qr => qr.qrString === qrString);

        if (!qrCode) {
          return {
            success: false,
            accessGranted: false,
            timestamp: new Date().toISOString(),
            errorCode: 'INVALID_QR',
            errorMessage: 'QR code not found'
          };
        }

        if (qrCode.status !== 'active') {
          return {
            success: false,
            accessGranted: false,
            timestamp: new Date().toISOString(),
            errorCode: 'QR_INACTIVE',
            errorMessage: 'QR code is not active'
          };
        }

        if (new Date() > new Date(qrCode.validity.expiresAt)) {
          return {
            success: false,
            accessGranted: false,
            timestamp: new Date().toISOString(),
            errorCode: 'QR_EXPIRED',
            errorMessage: 'QR code has expired'
          };
        }

        // Update usage
        qrCode.usage.totalScans++;
        qrCode.usage.successfulScans++;
        qrCode.usage.lastUsedAt = new Date().toISOString();
        qrCode.usage.lastLocation = location;

        return {
          success: true,
          qrCodeId: qrCode.qrCodeId,
          accessGranted: true,
          accessType: qrCode.access.type,
          location,
          timestamp: new Date().toISOString(),
          expiresAt: qrCode.validity.expiresAt
        };
      })
    );
  }

  // ==================== HELPER METHODS ====================

  private getAvailableModelsForGroup(groupId: string): any[] {
    const models = this.unitModels.filter(um => um.groupId === groupId);
    return models.map(model => ({
      model,
      availableUnits: model.inventory.availableUnits,
      lowestPrice: model.pricing.basePrice,
      highestPrice: model.pricing.basePrice * 1.5 // Mock calculation
    }));
  }

  private generateQRString(request: QRCodeGenerationRequest): string {
    const data = {
      b: request.bookingId,
      u: request.unitId,
      p: request.propertyGroupId,
      vf: request.validFrom,
      vu: request.validUntil,
      t: Date.now()
    };
    return btoa(JSON.stringify(data));
  }

  private initializeMockData(): void {
    // Initialize with some mock data for testing
    // This would be removed in production
  }
}
