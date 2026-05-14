import { Component, OnInit } from '@angular/core';
import { DataService } from '../services/data.service';
import { ModelService } from '../services/model.service';
import { PropertyGroup, UnitModel, IndividualUnit } from '../interfaces/property.interface';
import { User } from '../interfaces/user.interface';
import { BookingModel } from '../interfaces/booking.interface';
import { Payment } from '../interfaces/payment.interface';
import { QRCode, QRCodeGenerationRequest } from '../interfaces/qrcode.interface';
import {DatePipe} from '@angular/common';

@Component({
  selector: 'app-data-models-example',
  template: `
    <div class="container mx-auto px-4 py-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Data Models Example
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          Comprehensive example of all data models and their relationships
        </p>
      </div>

      <!-- Property Management -->
      <div class="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Property Management
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Property Groups -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Property Groups</h3>
            <button
              (click)="createSamplePropertyGroup()"
              class="w-full mb-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
              Create Sample Property Group
            </button>
            <div class="space-y-2">
              <div *ngFor="let group of propertyGroups"
                   class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div class="font-medium text-gray-900 dark:text-white">{{ group.name }}</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">{{ group.address.city }}
                  , {{ group.address.state }}
                </div>
                <div class="text-sm text-gray-500">{{ group.buildingInfo.totalUnits }} units</div>
              </div>
            </div>
          </div>

          <!-- Unit Models -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Unit Models</h3>
            <button
              (click)="createSampleUnitModel()"
              [disabled]="propertyGroups.length === 0"
              class="w-full mb-3 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400">
              Create Sample Unit Model
            </button>
            <div class="space-y-2">
              <div *ngFor="let model of unitModels"
                   class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div class="font-medium text-gray-900 dark:text-white">{{ model.name }}</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">
                  {{ model.configuration.rooms }}R {{ model.configuration.beds }}B
                </div>
                <div class="text-sm text-gray-500">
                  \${{ model.pricing.basePrice }}/night
                </div>
              </div>
            </div>
          </div>

          <!-- Individual Units -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Individual Units</h3>
            <button
              (click)="createSampleIndividualUnit()"
              [disabled]="unitModels.length === 0"
              class="w-full mb-3 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-400">
              Create Sample Unit
            </button>
            <div class="space-y-2">
              <div *ngFor="let unit of individualUnits"
                   class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div class="font-medium text-gray-900 dark:text-white">{{ unit.identity.unitName }}</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Unit {{ unit.identity.unitNumber }}</div>
                <div class="text-sm" [class]="getStatusColor(unit.status.availability)">
                  {{ unit.status.availability }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- User Management -->
      <div class="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          User Management
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <button
              (click)="createSampleUser()"
              class="w-full mb-3 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">
              Create Sample User
            </button>
            <div class="space-y-2">
              <div *ngFor="let user of users"
                   class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div class="font-medium text-gray-900 dark:text-white">
                  {{ user.profile.firstName }} {{ user.profile.lastName }}
                </div>
                <div class="text-sm text-gray-600 dark:text-gray-400">{{ user.email }}</div>
                <div class="text-sm text-gray-500">{{ user.loyalty.tier }} member</div>
              </div>
            </div>
          </div>

          <div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">User Statistics</h3>
            <div class="space-y-2">
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Total Users:</span>
                <span class="font-medium text-gray-900 dark:text-white">{{ users.length }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Verified Users:</span>
                <span class="font-medium text-gray-900 dark:text-white">
                  {{ users?.filter(u => u.emailVerified).length || 0 }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Booking & Payment Flow -->
      <div class="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Booking & Payment Flow
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Bookings -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Bookings</h3>
            <button
              (click)="createSampleBooking()"
              [disabled]="users.length === 0 || unitModels.length === 0"
              class="w-full mb-3 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-400">
              Create Sample Booking
            </button>
            <div class="space-y-2">
              <div *ngFor="let booking of bookings"
                   class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div class="font-medium text-gray-900 dark:text-white">{{ booking.bookingId }}</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">
                  {{ booking.stay.checkIn | date:'MMM dd' }} - {{ booking.stay.checkOut | date:'MMM dd' }}
                </div>
                <div class="text-sm" [class]="getStatusColor(booking.status)">
                  {{ booking.status }}
                </div>
              </div>
            </div>
          </div>

          <!-- Payments -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Payments</h3>
            <button
              (click)="createSamplePayment()"
              [disabled]="bookings.length === 0"
              class="w-full mb-3 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:bg-gray-400">
              Create Sample Payment
            </button>
            <div class="space-y-2">
              <div *ngFor="let payment of payments"
                   class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div class="font-medium text-gray-900 dark:text-white">{{ payment.paymentId }}</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">
                  \${{ payment.amount.total }} {{ payment.amount.currency }}
                </div>
                <div class="text-sm" [class]="getStatusColor(payment.transaction.status)">
                  {{ payment.transaction.status }}
                </div>
              </div>
            </div>
          </div>

          <!-- QR Codes -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">QR Codes</h3>
            <button
              (click)="createSampleQRCode()"
              [disabled]="bookings.length === 0 || individualUnits.length === 0"
              class="w-full mb-3 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:bg-gray-400">
              Generate QR Code
            </button>
            <div class="space-y-2">
              <div *ngFor="let qr of qrCodes"
                   class="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div class="font-medium text-gray-900 dark:text-white">{{ qr.qrCodeId }}</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">
                  Unit: {{ qr.access.unitAccess.unitNumber }}
                </div>
                <div class="text-sm" [class]="getStatusColor(qr.status)">
                  {{ qr.status }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Data Relationships -->
      <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
        <h2 class="text-xl font-semibold text-blue-900 dark:text-blue-200 mb-4">
          Data Model Relationships
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 class="font-medium text-blue-800 dark:text-blue-200 mb-2">Hierarchy:</h3>
            <ul class="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Property Group (Building/Location)</li>
              <li>&nbsp;&nbsp;└─ Unit Models (Room Types)</li>
              <li>&nbsp;&nbsp;&nbsp;&nbsp;└─ Individual Units (Actual Rooms)</li>
            </ul>
          </div>
          <div>
            <h3 class="font-medium text-blue-800 dark:text-blue-200 mb-2">Flow:</h3>
            <ul class="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• User → Booking → Payment</li>
              <li>• Booking → QR Code → Access</li>
              <li>• Unit Model → Individual Unit Assignment</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `,
  imports: [
    DatePipe
  ],
  styleUrls: ['./data-models-example.component.scss']
})
export class DataModelsExampleComponent implements OnInit {

  propertyGroups: PropertyGroup[] = [];
  unitModels: UnitModel[] = [];
  individualUnits: IndividualUnit[] = [];
  users: User[] = [];
  bookings: BookingModel[] = [];
  payments: Payment[] = [];
  qrCodes: QRCode[] = [];

  constructor(
    private dataService: DataService,
    private modelService: ModelService
  ) { }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    // Load existing data
    this.dataService.getPropertyGroups().subscribe(groups => {
      this.propertyGroups = groups;
    });
  }


  createSamplePropertyGroup(): void {
    const sampleGroup: Partial<PropertyGroup> = {
      groupId: 'pg-' + Date.now(),
      name: 'Sunset Apartments',
      description: 'Modern apartment complex with city views',
      type: 'apartment_complex',
      address: {
        street: '123 Sunset Blvd',
        city: 'San Diego',
        state: 'CA',
        country: 'US',
        zipCode: '92101',
        coordinates: {
          latitude: 32.7157,
          longitude: -117.1611
        }
      },
      buildingInfo: {
        floors: 5,
        totalUnits: 20,
        buildingYear: 2020
      },
      contact: {
        phone: '+1-555-0123',
        email: 'info@sunsetapts.com',
        emergencyContact: '+1-555-0911'
      },
      amenities: ['pool', 'gym', 'parking', 'wifi'],
      policies: {
        checkInTime: '15:00',
        checkOutTime: '11:00',
        cancellationPolicy: '24 hours',
        petPolicy: 'No pets allowed',
        smokingPolicy: 'Non-smoking'
      },
      smartLockConfig: {
        enabled: true,
        provider: 'yale',
        buildingAccessRequired: true
      },
      priceRange: {
        min: 100,
        max: 300,
        currency: 'USD'
      },
      ownerId: 'owner-123'
    };

    this.dataService.createPropertyGroup(sampleGroup).subscribe(group => {
      this.propertyGroups.push(group);
    });
  }

  createSampleUnitModel(): void {
    if (this.propertyGroups.length === 0) return;

    const group = this.propertyGroups[0];
    const sampleModel: Partial<UnitModel> = {
      modelId: 'um-' + Date.now(),
      groupId: group.groupId,
      name: '1 Room 1 Bed City View',
      description: 'Modern studio with city view',
      configuration: {
        rooms: 1,
        beds: 1,
        bathrooms: 1,
        bedTypes: [
          { type: 'queen', count: 1, room: 'main' }
        ]
      },
      capacity: {
        adults: 2,
        children: 1,
        maxOccupancy: 3
      },
      features: {
        view: 'city',
        amenities: ['balcony', 'kitchen', 'wifi'],
        appliances: ['refrigerator', 'microwave', 'coffee_maker']
      },
      physical: {
        size: 500,
        sizeUnit: 'sqft'
      },
      pricing: {
        basePrice: 150,
        currency: 'USD',
        priceType: 'per_night',
        currentPrice: 150,
        lastPriceUpdate: new Date().toISOString(),
        priceCalendar: [],
        rules: {
          seasonal: [],
          weekend: {
            enabled: true,
            fridayMultiplier: 1.2,
            saturdayMultiplier: 1.3,
            sundayMultiplier: 1.1
          },
          lengthOfStay: [],
          advanceBooking: []
        }
      },
      inventory: {
        totalUnits: 5,
        availableUnits: 3,
        occupiedUnits: 2,
        maintenanceUnits: 0,
        lastUpdated: new Date().toISOString()
      },
      media: {
        images: []
      },
      status: 'active'
    };

    // Create the unit model (mock implementation)
    const newModel = sampleModel as UnitModel;
    newModel.PK = `PROPERTY_GROUP#${group.groupId}`;
    newModel.SK = `UNIT_MODEL#${newModel.modelId}`;
    newModel.createdAt = new Date().toISOString();
    newModel.updatedAt = new Date().toISOString();
    newModel.GSI1PK = `PROPERTY_GROUP#${group.groupId}`;
    newModel.GSI1SK = `MODEL#1R#1B#city#150`;
    newModel.GSI2PK = 'AVAILABILITY#available';
    newModel.GSI2SK = `MODEL#${group.groupId}#3`;

    this.unitModels.push(newModel);
  }

  createSampleIndividualUnit(): void {
    if (this.unitModels.length === 0) return;

    const model = this.unitModels[0];
    const unitNumber = '10' + (this.individualUnits.length + 1);

    const sampleUnit: Partial<IndividualUnit> = {
      unitId: 'unit-' + Date.now(),
      modelId: model.modelId,
      groupId: model.groupId,
      identity: {
        unitNumber,
        unitName: `City View ${unitNumber}`,
        floor: Math.floor(parseInt(unitNumber) / 100),
        building: 'A'
      },
      specifics: {
        exactView: 'North City View',
        corner: false,
        condition: 'excellent'
      },
      smartLock: {
        lockId: 'lock-' + Date.now(),
        model: 'Yale Assure SL',
        lastSync: new Date().toISOString(),
        accessCodes: {
          master: '123456',
          guest: '789012',
          maintenance: '345678'
        }
      },
      status: {
        availability: 'available'
      },
      restrictions: {
        minimumStay: 1
      },
      maintenanceHistory: {
        lastCleaned: new Date().toISOString(),
        lastDeepCleaned: new Date().toISOString(),
        lastMaintenance: new Date().toISOString(),
        issues: []
      },
      performance: {
        bookingHistory: [],
        last30Days: {
          occupancyRate: 0.8,
          averageRate: 150,
          totalRevenue: 3600,
          bookingsCount: 12
        }
      }
    };

    // Create the individual unit (mock implementation)
    const newUnit = sampleUnit as IndividualUnit;
    newUnit.PK = `UNIT_MODEL#${model.modelId}`;
    newUnit.SK = `INDIVIDUAL_UNIT#${newUnit.unitId}`;
    newUnit.createdAt = new Date().toISOString();
    newUnit.updatedAt = new Date().toISOString();
    newUnit.GSI1PK = `UNIT_MODEL#${model.modelId}`;
    newUnit.GSI1SK = `UNIT#available#${unitNumber}`;
    newUnit.GSI2PK = `PROPERTY_GROUP#${model.groupId}`;
    newUnit.GSI2SK = `UNIT#available#${newUnit.unitId}`;
    newUnit.GSI3PK = 'AVAILABILITY#available';
    newUnit.GSI3SK = `UNIT#${model.groupId}#${model.modelId}#${newUnit.unitId}`;

    this.individualUnits.push(newUnit);
  }

  createSampleUser(): void {
    const sampleUser: Partial<User> = {
      userId: 'user-' + Date.now(),
      email: `user${this.users.length + 1}@example.com`,
      profile: {
        firstName: 'John',
        lastName: 'Doe',
        preferredLanguage: 'en',
        timezone: 'America/Los_Angeles'
      },
      auth: {
        providers: [
          {
            type: 'email',
            providerId: `user${this.users.length + 1}@example.com`,
            connectedAt: new Date().toISOString()
          }
        ],
        lastLogin: new Date().toISOString(),
        loginCount: 1,
        twoFactorEnabled: false
      },
      preferences: {
        currency: 'USD',
        notifications: {
          email: true,
          sms: false,
          push: true,
          marketing: false,
          bookingReminders: true,
          priceAlerts: false
        },
        accessibility: {
          screenReader: false,
          highContrast: false,
          largeText: false
        },
        privacy: {
          profileVisibility: 'private',
          shareDataForMarketing: false,
          shareDataForAnalytics: true
        }
      },
      travelProfile: {
        frequentDestinations: ['San Diego', 'Los Angeles'],
        preferredRoomType: '1BR',
        specialRequests: [],
        dietaryRestrictions: [],
        emergencyContact: {
          name: 'Jane Doe',
          phone: '+1-555-0456',
          relationship: 'spouse'
        },
        travelPurpose: 'leisure',
        budgetRange: {
          min: 100,
          max: 300,
          currency: 'USD'
        }
      }
    };

    this.dataService.createUser(sampleUser).subscribe(user => {
      this.users.push(user);
    });
  }

  createSampleBooking(): void {
    if (this.users.length === 0 || this.unitModels.length === 0) return;

    const user = this.users[0];
    const model = this.unitModels[0];
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 7);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 3);

    const sampleBooking: Partial<BookingModel> = {
      userId: user.userId,
      propertyGroupId: model.groupId,
      stay: {
        checkIn: checkIn.toISOString().split('T')[0],
        checkOut: checkOut.toISOString().split('T')[0],
        nights: 3,
        selectedModels: [
          {
            modelId: model.modelId,
            modelName: model.name,
            quantity: 1,
            guests: {
              adults: 2,
              children: 0
            }
          }
        ],
        assignedUnits: []
      },
      primaryGuest: {
        firstName: user.profile.firstName,
        lastName: user.profile.lastName,
        email: user.email,
        phone: user.phone || '+1-555-0123'
      },
      pricing: {
        unitTotal: 450,
        taxes: 45,
        fees: 25,
        discounts: 0,
        total: 520,
        currency: 'USD',
        breakdown: [
          { item: 'Room (3 nights)', amount: 450, type: 'unit' },
          { item: 'Taxes', amount: 45, type: 'tax' },
          { item: 'Service Fee', amount: 25, type: 'fee' }
        ],
        nightlyRates: [
          { date: checkIn.toISOString().split('T')[0], rate: 150, originalRate: 150 },
          { date: new Date(checkIn.getTime() + 86400000).toISOString().split('T')[0], rate: 150, originalRate: 150 },
          { date: new Date(checkIn.getTime() + 172800000).toISOString().split('T')[0], rate: 150, originalRate: 150 }
        ]
      },
      source: {
        channel: 'direct',
        device: 'web'
      }
    };

    this.dataService.createBooking(sampleBooking).subscribe(booking => {
      this.bookings.push(booking);
    });
  }

  createSamplePayment(): void {
    if (this.bookings.length === 0) return;

    const booking = this.bookings[0];
    const samplePayment: Partial<Payment> = {
      bookingId: booking.bookingId,
      userId: booking.userId,
      amount: {
        total: booking.pricing.total,
        currency: booking.pricing.currency,
        breakdown: {
          principal: booking.pricing.unitTotal,
          taxes: booking.pricing.taxes,
          fees: booking.pricing.fees
        }
      },
      paymentMethod: {
        type: 'credit_card',
        provider: 'stripe',
        card: {
          last4: '4242',
          brand: 'visa',
          expiryMonth: 12,
          expiryYear: 2025,
          fingerprint: 'fp_' + Date.now(),
          holderName: booking.primaryGuest.firstName + ' ' + booking.primaryGuest.lastName
        }
      },
      security: {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        fraudChecks: {
          avsCheck: 'pass',
          cvvCheck: 'pass'
        },
        riskAssessment: {
          score: 15,
          level: 'low',
          factors: [],
          reviewRequired: false
        }
      },
      billingAddress: {
        firstName: booking.primaryGuest.firstName,
        lastName: booking.primaryGuest.lastName,
        street: '123 Main St',
        city: 'San Diego',
        state: 'CA',
        country: 'US',
        zipCode: '92101'
      }
    };

    this.dataService.createPayment(samplePayment).subscribe(payment => {
      this.payments.push(payment);
    });
  }

  createSampleQRCode(): void {
    if (this.bookings.length === 0 || this.individualUnits.length === 0) return;

    const booking = this.bookings[0];
    const unit = this.individualUnits[0];

    const request: QRCodeGenerationRequest = {
      bookingId: booking.bookingId,
      userId: booking.userId,
      propertyGroupId: booking.propertyGroupId,
      unitId: unit.unitId,
      accessType: 'unit_entry',
      permissions: ['unit_door', 'building_entrance'],
      validFrom: booking.stay.checkIn,
      validUntil: booking.stay.checkOut,
      deliveryMethod: 'app'
    };

    this.dataService.generateQRCode(request).subscribe(qrCode => {
      this.qrCodes.push(qrCode);
    });
  }

  getStatusColor(status: string): string {
    const colorMap: { [key: string]: string } = {
      'available': 'text-green-600',
      'occupied': 'text-red-600',
      'maintenance': 'text-yellow-600',
      'pending': 'text-yellow-600',
      'confirmed': 'text-blue-600',
      'checked_in': 'text-green-600',
      'checked_out': 'text-gray-600',
      'cancelled': 'text-red-600',
      'succeeded': 'text-green-600',
      'failed': 'text-red-600',
      'processing': 'text-yellow-600',
      'active': 'text-green-600',
      'expired': 'text-gray-600',
      'revoked': 'text-red-600'
    };
    return colorMap[status] || 'text-gray-600';
  }
}
