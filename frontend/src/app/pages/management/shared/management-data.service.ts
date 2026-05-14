import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, from, throwError, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, PutCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { ScanCommandOutput } from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '../../../services/config.service';
import { AWSConfigService } from '../../../config/aws.config';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { ModelService } from '../../../services/model.service';
import { fetchAuthSession } from 'aws-amplify/auth';
import { determineBookingSource } from './booking-source.utils';

export interface ListingData {
  PK: string;
  SK: string;
  roomId: string;
  roomName: string;
  roomAlias: string;
  groupId?: string;
  groupName?: string;
  deleted: boolean;
  type: string;
  updatedAt: number;
  createdAt?: number;
  // Channel information
  airbnbListingId?: string;
  bookingHotelCode?: string;
  vrboListingNumber?: string;
  // Pricing
  basePrice?: number;
  currency?: string;
  // Status
  status?: string;
  platformStatus?: string;
  // Door assignments
  assignedDoors?: string[]; // Array of door IDs
  doorNames?: string; // Comma-separated door names for display
  // Custom fields for listings (editable by user)
  customFields?: {
    address?: string;
    responsiblePerson?: string;
    info4guest?: string;
    doors?: any[];
    [key: string]: any;
  };
}

export interface ReservationData {
  PK: string;
  SK: string;
  reservationId: string;
  reservationCode: string;
  roomId: string;
  roomName: string;
  roomAlias: string;
  guestName: string;
  guestSurname: string;
  email: string;
  phoneNumber: string;
  checkInDate: number;
  checkOutDate: number;
  checkInDateWithTime?: number;
  checkOutDateWithTime?: number;
  nights: number;
  numOfAdults: number;
  numOfKids: number;
  numOfInfants: number;
  price: number;
  currency: string;
  status: number;
  sourceId: number;
  addedDate: number;
  updatedAt: number;
  isDeleted?: number;
  isModified?: number;
  guestId?: string;
  hostId?: string;
  note?: string;
  preferredEmail?: string;
  guestFormShortLink?: string;
  porterReservationPrice?: number;
  homeAwayReferenceNumber?: string;
  rawDataHash?: string;
  hash?: string;
  sourceUpdatedAt?: number;
  lastGuestySync?: number;
  lastCustomUpdate?: number;
  // Calculated booking source
  bookingSource?: 'airbnb' | 'booking_com' | 'homeaway' | 'vrbo' | 'direct' | 'unknown';
  // Check-in information
  checkinStatus?: string;
  doorAccessStatus?: string;
  // Complex custom fields structure from actual data
  customFields?: {
    checkin?: {
      status?: string;
      createdAt?: number;
      updatedAt?: number;
      mainGuestEmail?: string;
      mainGuestFirstname?: string;
      mainGuestLastname?: string;
      mainGuestPhoneNumber?: string;
      accessNotificationFunctionScheduled?: boolean;
      submittedAt?: number;
      documents?: any[];
      validationResults?: {
        documentsValid?: boolean;
        identityVerified?: boolean;
        validatedAt?: number;
      };
    };
    doorAccesses?: {
      status?: string;
      generatedAt?: number;
      accessNotificationScheduled?: boolean;
      accessNotificationScheduledAt?: number;
      qrCode?: string;
      pinCodes?: any;
      doorInfo?: {
        pin_doors?: any[];
        qr_doors?: any[];
        total_doors?: number;
      };
      usageHistory?: any[];
    };
    [key: string]: any;
  };
  // Raw data from source system
  rawData?: {
    sourceId?: number;
    note?: string;
    numOfAdults?: number;
    addedDate?: number;
    roomAlias?: string;
    lastUpdateDate?: number;
    checkInDate?: number;
    numOfInfants?: number;
    roomId?: string;
    guestName?: string;
    reservationCode?: string;
    guestFormShortLink?: string;
    checkInDateWithTime?: number;
    preferredEmail?: string;
    reservationId?: string;
    checkOutDate?: number;
    isDeleted?: number;
    isModified?: number;
    price?: number;
    currency?: string;
    checkOutDateWithTime?: number;
    guestId?: string;
    email?: string;
    numOfKids?: number;
    guestSurname?: string;
    hostId?: string;
    porterReservationPrice?: number;
    roomName?: string;
    phoneNumber?: string;
    homeAwayReferenceNumber?: string;
    nights?: number;
    status?: number;
    [key: string]: any;
  };
}

export interface DoorData {
  // DynamoDB Keys
  PK: string;           // "DOOR#<doorId>"
  SK: string;           // "METADATA"

  // Core Door Data
  id: string;
  name: string; // mandatory
  type: 'qrlock' | 'ttlock'; // mandatory, only these two types supported
  readerId: string; // mandatory
  property?: string;
  location?: string;
  floor?: string;
  building?: string;
  isActive: boolean;
  batteryLevel?: number;
  lastActivity?: number;
  createdAt: number;
  updatedAt: number;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ManagementDataService {
  private dynamoClient!: DynamoDBClient;
  private docClient!: DynamoDBDocumentClient;
  private tableName: string;

  // Data subjects for real-time updates
  private listingsSubject = new BehaviorSubject<ListingData[]>([]);
  private reservationsSubject = new BehaviorSubject<ReservationData[]>([]);
  private doorsSubject = new BehaviorSubject<DoorData[]>([]);

  public listings$ = this.listingsSubject.asObservable();
  public reservations$ = this.reservationsSubject.asObservable();
  public doors$ = this.doorsSubject.asObservable();

  constructor(
    private configService: ConfigService,
    private awsConfigService: AWSConfigService,
    private authService: AuthService,
    private modelService: ModelService,
    private http: HttpClient
  ) {
    // Get table name from configuration
    const awsConfig = this.awsConfigService.getAWSConfig();
    this.tableName = awsConfig?.dynamodb?.tableName || 'harmonest-main';

    // Initialize DynamoDB client asynchronously
    this.initializeDynamoClient().catch(error => {
      console.error('Failed to initialize DynamoDB client:', error);
      // Error will be handled when methods are called
    });
  }

  private async initializeDynamoClient(): Promise<void> {
    try {
      // Get AWS configuration
      const awsConfig = this.awsConfigService.getAWSConfig();

      if (!awsConfig) {
        throw new Error('AWS configuration not available');
      }

      const config = this.configService.getConfig();
      const isDevelopment = config?.environment?.type === 'dev' || !config?.environment?.type;

      // Try to get credentials from Cognito Identity Pool first
      try {
        const session = await fetchAuthSession();

        if (session.credentials) {

          this.dynamoClient = new DynamoDBClient({
            region: awsConfig.region,
            credentials: session.credentials
          });
          this.docClient = DynamoDBDocumentClient.from(this.dynamoClient);

          // Test the connection
          await this.testDynamoDBConnection();
          return;
        }
      } catch (error) {
        console.warn('⚠️ Cognito credentials not available:', error);
      }

      // Fallback for development: Use AWS CLI credentials
      if (isDevelopment) {
        console.log('🔄 Development fallback: Using AWS CLI credentials for DynamoDB');

        this.dynamoClient = new DynamoDBClient({
          region: awsConfig.region
          // Will use default credential chain (AWS CLI profile: harmonestadmin)
        });

        this.docClient = DynamoDBDocumentClient.from(this.dynamoClient);

        // Test the connection
        await this.testDynamoDBConnection();
        return;
      }

      throw new Error('No valid AWS credentials available');

    } catch (error) {
      console.error('❌ AWS DynamoDB client initialization failed:', error);
      console.log('💡 Make sure you are logged in or AWS CLI is configured with harmonestadmin profile');
      throw error;
    }
  }

  private async testDynamoDBConnection(): Promise<boolean> {
    try {
      // Try a simple scan with limit 1 to test connection
      const command = new ScanCommand({
        TableName: this.tableName,
        Limit: 1
      });

      await this.docClient.send(command);
      return true;
    } catch (error) {
      console.error('DynamoDB connection test failed:', error);
      throw error;
    }
  }

  private async ensureClientInitialized(): Promise<void> {
    if (!this.docClient) {
      await this.initializeDynamoClient();
    }

    if (!this.docClient) {
      throw new Error('DynamoDB client not initialized. Please check your AWS credentials.');
    }
  }

  private async updateListingCustomFields(PK: string, SK: string, customFields: any): Promise<ListingData> {
    await this.ensureClientInitialized();

    const updateParams = {
      TableName: this.tableName,
      Key: { PK, SK },
      UpdateExpression: 'SET customFields = :customFields, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':customFields': customFields,
        ':updatedAt': Date.now()
      },
      ReturnValues: 'ALL_NEW' as const
    };

    console.log('🔍 [ManagementDataService] DynamoDB update params:', JSON.stringify(updateParams, null, 2));

    const command = new UpdateCommand(updateParams);

    try {
      const result = await this.docClient.send(command);
      console.log('✅ [ManagementDataService] DynamoDB update successful:', result.Attributes);
      return result.Attributes as ListingData;
    } catch (error) {
      console.error('❌ [ManagementDataService] Error updating listing customFields:', error);
      throw error;
    }
  }

  // LISTINGS METHODS
  getListings(): Observable<ListingData[]> {
    if (!this.docClient) {
      return throwError(() => new Error('DynamoDB client not initialized. Please check your AWS credentials.'));
    }

    return from(
      this.modelService.handleAWSError(async () => {
        const allItems: any[] = [];
        let ExclusiveStartKey: Record<string, any> | undefined = undefined;

        do {
          const command = new ScanCommand({
            TableName: this.tableName,
            FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
            ExpressionAttributeValues: {
              ':pk': 'LISTING#',
              ':sk': 'META'
            },
            ExclusiveStartKey
          });

          const result: ScanCommandOutput = await this.docClient.send(command);

          if (result.Items) {
            allItems.push(...result.Items);
          }

          ExclusiveStartKey = result.LastEvaluatedKey;
        } while (ExclusiveStartKey);

        return allItems;
      }, 'getListings')
    ).pipe(
      map(items => {
        const listings = this.transformListingsData(items || []);
        this.listingsSubject.next(listings);
        return listings;
      }),
      catchError(error => {
        console.error('Error fetching listings from DynamoDB:', error);
        return throwError(() => error);
      })
    );
  }

  updateListing(listing: Partial<ListingData>): Observable<ListingData> {
    // Build dynamic UpdateExpression based on provided fields
    const updateExpressions: string[] = ['updatedAt = :updatedAt'];
    const expressionAttributeValues: any = {
      ':updatedAt': Date.now()
    };

    // Add fields that are provided in the listing object
    if (listing.roomName !== undefined) {
      updateExpressions.push('roomName = :roomName');
      expressionAttributeValues[':roomName'] = listing.roomName;
    }

    if (listing.roomAlias !== undefined) {
      updateExpressions.push('roomAlias = :roomAlias');
      expressionAttributeValues[':roomAlias'] = listing.roomAlias;
    }

    if (listing.customFields !== undefined) {
      updateExpressions.push('customFields = :customFields');
      expressionAttributeValues[':customFields'] = listing.customFields;
    }

    if (listing.basePrice !== undefined) {
      updateExpressions.push('basePrice = :basePrice');
      expressionAttributeValues[':basePrice'] = listing.basePrice;
    }

    if (listing.currency !== undefined) {
      updateExpressions.push('currency = :currency');
      expressionAttributeValues[':currency'] = listing.currency;
    }

    if (listing.status !== undefined) {
      updateExpressions.push('#status = :status');
      expressionAttributeValues[':status'] = listing.status;
    }

    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: {
        PK: listing.PK,
        SK: listing.SK || 'META'
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ...(listing.status !== undefined && {
        ExpressionAttributeNames: {
          '#status': 'status'
        }
      }),
      ReturnValues: 'ALL_NEW'
    });

    return from(this.docClient.send(command)).pipe(
      map(result => {
        const updatedListing = this.transformListingData(result.Attributes);
        this.updateListingInSubject(updatedListing);
        return updatedListing;
      }),
      catchError(error => {
        console.error('Error updating listing:', error);
        return throwError(() => error);
      })
    );
  }

  // RESERVATIONS METHODS
  getReservations(monthStart?: number, monthEnd?: number): Observable<ReservationData[]> {
    // Ensure client is initialized before making the call
    if (!this.docClient) {
      console.warn('DynamoDB client not initialized, attempting to initialize...');
      return from(this.initializeDynamoClient()).pipe(
        switchMap(() => this.scanReservations(monthStart, monthEnd)),
        catchError(error => {
          console.error('Failed to initialize DynamoDB client:', error);
          this.reservationsSubject.next([]);
          return of([]);
        })
      );
    }

    return this.scanReservations(monthStart, monthEnd);
  }

  private scanReservations(monthStart?: number, monthEnd?: number): Observable<ReservationData[]> {
    // Use ModelService's error handling for automatic token refresh
    return from(this.modelService.handleAWSError(
      async () => {
        const allItems: any[] = [];
        let ExclusiveStartKey: Record<string, any> | undefined = undefined;

        const hasMonthFilter = monthStart !== undefined && monthEnd !== undefined;
        const expressionAttributeValues: Record<string, any> = {
          ':pk': 'RESERVATION#',
          ':sk': 'META'
        };

        let filterExpression = 'begins_with(PK, :pk) AND SK = :sk';
        if (hasMonthFilter) {
          // Include overlap reservations, and also records that don't carry checkOutDate.
          filterExpression += ' AND ((checkInDate < :monthEnd AND checkOutDate >= :monthStart) OR (attribute_not_exists(checkOutDate) AND checkInDate >= :monthStart AND checkInDate < :monthEnd))';
          expressionAttributeValues[':monthStart'] = monthStart;
          expressionAttributeValues[':monthEnd'] = monthEnd;
        }

        do {
          const command = new ScanCommand({
            TableName: this.tableName,
            FilterExpression: filterExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            ExclusiveStartKey
          });

          const result: ScanCommandOutput = await this.docClient.send(command);
          if (result.Items) {
            allItems.push(...result.Items);
          }
          ExclusiveStartKey = result.LastEvaluatedKey;
        } while (ExclusiveStartKey);

        return { Items: allItems };
      },
      'scanReservations'
    )).pipe(
      map(result => {
        //console.log('DynamoDB scan result:', result);
        const reservations = this.transformReservationsData(result.Items || []);
        //console.log('Transformed reservations:', reservations);
        this.reservationsSubject.next(reservations);
        return reservations;
      }),
      catchError(error => {
        console.error('Error fetching reservations:', error);
        // Return empty array instead of throwing error to prevent infinite loading
        this.reservationsSubject.next([]);
        return of([]);
      })
    );
  }

  updateReservation(reservation: Partial<ReservationData>): Observable<ReservationData> {
    // Build dynamic UpdateExpression based on provided fields
    const updateExpressions: string[] = ['updatedAt = :updatedAt'];
    const expressionAttributeValues: any = {
      ':updatedAt': Date.now()
    };

    // Add fields that are provided in the reservation object
    if (reservation.guestName !== undefined) {
      updateExpressions.push('guestName = :guestName');
      expressionAttributeValues[':guestName'] = reservation.guestName;
    }

    if (reservation.guestSurname !== undefined) {
      updateExpressions.push('guestSurname = :guestSurname');
      expressionAttributeValues[':guestSurname'] = reservation.guestSurname;
    }

    if (reservation.email !== undefined) {
      updateExpressions.push('email = :email');
      expressionAttributeValues[':email'] = reservation.email;
    }

    if (reservation.phoneNumber !== undefined) {
      updateExpressions.push('phoneNumber = :phoneNumber');
      expressionAttributeValues[':phoneNumber'] = reservation.phoneNumber;
    }

    if (reservation.customFields !== undefined) {
      updateExpressions.push('customFields = :customFields');
      expressionAttributeValues[':customFields'] = reservation.customFields;
    }

    if (reservation.checkinStatus !== undefined) {
      updateExpressions.push('checkinStatus = :checkinStatus');
      expressionAttributeValues[':checkinStatus'] = reservation.checkinStatus;
    }

    if (reservation.doorAccessStatus !== undefined) {
      updateExpressions.push('doorAccessStatus = :doorAccessStatus');
      expressionAttributeValues[':doorAccessStatus'] = reservation.doorAccessStatus;
    }

    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: {
        PK: reservation.PK,
        SK: reservation.SK || 'META'
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    });

    return from(this.docClient.send(command)).pipe(
      map(result => {
        const updatedReservation = this.transformReservationData(result.Attributes);
        this.updateReservationInSubject(updatedReservation);
        return updatedReservation;
      }),
      catchError(error => {
        console.error('Error updating reservation:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Admin-only: resend existing door-access email to a (possibly new) email address.
   * This calls the secure backend endpoint, which reuses existing door access data.
   */
  resendDoorAccess(reservationId: string, email: string): Observable<any> {
    // Reuse the existing check-in API (same API Gateway and CORS / auth setup).
    const checkinUrl = this.configService.getApiUrl('checkin');
    if (!checkinUrl) {
      return throwError(() => new Error('Check-in API endpoint not configured'));
    }

    // checkinUrl is typically .../prod/checkin – strip the /checkin suffix to get the API root.
    const apiRoot = checkinUrl.replace(/\/checkin\/?$/, '');
    const url = `${apiRoot}/admin/resend-door-access`;
    const payload = { reservationId, email };

    return this.http.post(url, payload).pipe(
      catchError(error => {
        console.error('Error resending door access email:', error);
        return throwError(() => error);
      })
    );
  }

  // DOORS METHODS
  getDoors(): Observable<DoorData[]> {
    // Check if client is initialized
    if (!this.docClient) {
      console.warn('⚠️ [ManagementDataService] DynamoDB client not initialized, attempting to initialize...');
      return from(this.initializeDynamoClient()).pipe(
        switchMap(() => this.scanDoors()),
        catchError(error => {
          console.error('❌ [ManagementDataService] Failed to initialize DynamoDB client:', error);
          this.doorsSubject.next([]);
          return of([]);
        })
      );
    }

    return this.scanDoors();
  }

  private scanDoors(): Observable<DoorData[]> {
    // Use ModelService's error handling for automatic token refresh
    return from(this.modelService.handleAWSError(
      async () => {
        const allItems: any[] = [];
        let ExclusiveStartKey: Record<string, any> | undefined = undefined;

        do {
          const command = new ScanCommand({
            TableName: this.tableName,
            FilterExpression: 'begins_with(PK, :pk)',
            ExpressionAttributeValues: {
              ':pk': 'DOOR#'
            },
            ExclusiveStartKey
          });

          const result: ScanCommandOutput = await this.docClient.send(command);
          if (result.Items) {
            allItems.push(...result.Items);
          }
          ExclusiveStartKey = result.LastEvaluatedKey;
        } while (ExclusiveStartKey);

        return { Items: allItems };
      },
      'scanDoors'
    )).pipe(
      map(result => {
        const doors = (result.Items || []) as DoorData[];
        this.doorsSubject.next(doors);
        return doors;
      }),
      catchError(error => {
        console.error('❌ [ManagementDataService] Error scanning doors:', error);
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          code: error.code || error.$metadata?.httpStatusCode
        });
        this.doorsSubject.next([]);
        return of([]);
      })
    );
  }

  updateDoor(door: Partial<DoorData>): Observable<DoorData> {
    if (!door.id) {
      return throwError(() => new Error('Door ID is required for update'));
    }

    console.log('🔄 [ManagementDataService] Updating door in DynamoDB:', door.id);

    const PK = `DOOR#${door.id}`;
    const SK = 'METADATA';

    // Prepare update data (exclude DynamoDB keys and timestamps)
    const updateData = { ...door };
    delete updateData.PK;
    delete updateData.SK;
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    return this.modelService.updateItem<DoorData>(PK, SK, updateData).pipe(
      map(updatedDoor => {
        console.log('✅ [ManagementDataService] Door updated successfully:', updatedDoor.id);

        // Update local state
        const currentDoors = this.doorsSubject.value;
        const updatedDoors = currentDoors.map(d =>
          d.id === updatedDoor.id ? updatedDoor : d
        );
        this.doorsSubject.next(updatedDoors);

        return updatedDoor;
      }),
      catchError(error => {
        console.error('❌ [ManagementDataService] Error updating door:', error);
        return throwError(() => error);
      })
    );
  }

  addDoor(door: Omit<DoorData, 'id' | 'PK' | 'SK' | 'createdAt' | 'updatedAt'>): Observable<DoorData> {
    // Generate unique door ID
    const doorId = `door_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const newDoor: DoorData = {
      PK: `DOOR#${doorId}`,
      SK: 'METADATA',
      id: doorId,
      ...door,
      createdAt: now,
      updatedAt: now
    };

    console.log('🔄 [ManagementDataService] Adding new door to DynamoDB:', doorId);

    return this.modelService.putItem<DoorData>(newDoor).pipe(
      map(savedDoor => {
        console.log('✅ [ManagementDataService] Door added successfully:', savedDoor.id);

        // Update local state
        const currentDoors = this.doorsSubject.value;
        this.doorsSubject.next([...currentDoors, savedDoor]);

        return savedDoor;
      }),
      catchError(error => {
        console.error('❌ [ManagementDataService] Error adding door:', error);
        return throwError(() => error);
      })
    );
  }

  deleteDoor(doorId: string): Observable<boolean> {
    console.log('🔄 [ManagementDataService] Deleting door from DynamoDB:', doorId);

    const PK = `DOOR#${doorId}`;
    const SK = 'METADATA';

    return this.modelService.deleteItem(PK, SK).pipe(
      map(() => {
        console.log('✅ [ManagementDataService] Door deleted successfully:', doorId);

        // Update local state
        const currentDoors = this.doorsSubject.value;
        const filteredDoors = currentDoors.filter(d => d.id !== doorId);
        this.doorsSubject.next(filteredDoors);

        return true;
      }),
      catchError(error => {
        console.error('❌ [ManagementDataService] Error deleting door:', error);
        return throwError(() => error);
      })
    );
  }

  // DOOR ASSIGNMENT METHODS
  assignDoorsToListing(listingId: string, doorIds: string[]): Observable<ListingData> {
    console.log('🔄 [ManagementDataService] Assigning doors to listing:', listingId, doorIds);

    const currentListings = this.listingsSubject.value;
    const listing = currentListings.find(l => l.roomId === listingId);

    if (!listing) {
      return throwError(() => new Error('Listing not found'));
    }

    // Get door details for storage
    const doors = this.doorsSubject.value;
    const assignedDoorDetails = doorIds
      .map(id => doors.find(d => d.id === id))
      .filter(door => door)
      .map(door => ({
        id: door!.id,
        name: door!.name,
        type: door!.type,
        readerId: door!.readerId
      }));

    const doorNames = assignedDoorDetails.map(d => d.name).join(', ');

    // Update the listing in DynamoDB - store in customFields
    const PK = listing.PK;
    const SK = listing.SK;

    // Prepare the updated customFields - only update customFields
    const updatedCustomFields = {
      ...listing.customFields,
      doors: assignedDoorDetails
    };

    const updateData = {
      customFields: updatedCustomFields
    };

    console.log('🔄 [ManagementDataService] Updating listing customFields in DynamoDB:', {
      PK, SK,
      updateData,
      assignedDoorDetails,
      originalCustomFields: listing.customFields
    });

    // Use direct DynamoDB update to avoid issues with ModelService
    return from(this.updateListingCustomFields(PK, SK, updatedCustomFields)).pipe(
      map(updatedListing => {
        console.log('✅ [ManagementDataService] Door assignment updated successfully:', {
          roomId: updatedListing.roomId,
          customFieldsDoors: updatedListing.customFields?.doors,
          fullListing: updatedListing
        });

        // Update local state
        const currentListings = this.listingsSubject.value;
        const updatedListings = currentListings.map(l =>
          l.roomId === updatedListing.roomId ? updatedListing : l
        );
        this.listingsSubject.next(updatedListings);

        return updatedListing;
      }),
      catchError(error => {
        console.error('❌ [ManagementDataService] Error updating door assignment:', error);
        return throwError(() => error);
      })
    );
  }

  getAvailableDoorsForListing(listingId?: string): Observable<DoorData[]> {
    // First ensure doors are loaded
    return this.getDoors().pipe(
      map(doors => {
        // If a specific listing is provided, we could filter out already assigned doors
        // For now, return all doors to allow reassignment
        return doors;
      }),
      catchError(error => {
        console.error('❌ [ManagementDataService] Error loading available doors:', error);
        return of([]);
      })
    );
  }

  // PRIVATE HELPER METHODS
  private transformListingsData(items: any[]): ListingData[] {
    return items.map(item => this.transformListingData(item));
  }

  private transformListingData(item: any): ListingData {
    return {
      PK: item.PK?.S || item.PK,
      SK: item.SK?.S || item.SK,
      roomId: item.roomId?.S || item.roomId,
      roomName: item.roomName?.S || item.roomName,
      roomAlias: item.roomAlias?.S || item.roomAlias,
      groupId: item.group?.M?.groupId?.S || item.group?.groupId,
      groupName: item.group?.M?.groupName?.S || item.group?.groupName,
      deleted: item.deleted?.BOOL || item.deleted || false,
      type: item.type?.S || item.type || 'listing',
      updatedAt: parseInt(item.updatedAt?.N || item.updatedAt) || Date.now(),
      createdAt: parseInt(item.createdAt?.N || item.createdAt) || Date.now(),
      airbnbListingId: item.channelSummary?.M?.airbnb?.M?.listingId?.S || item.channelSummary?.airbnb?.listingId,
      bookingHotelCode: item.bookingListing?.M?.hotelCode?.S || item.bookingListing?.hotelCode,
      currency: item.currency?.S || item.currency || 'USD',
      status: item.status?.S || item.status || 'active',
      customFields: {
        address: item.customFields?.M?.address?.S || item.customFields?.address || '',
        responsiblePerson: item.customFields?.M?.responsiblePerson?.S || item.customFields?.responsiblePerson || '',
        info4guest: item.customFields?.M?.info4guest?.S || item.customFields?.info4guest || '',
        doors: item.customFields?.M?.doors?.L || item.customFields?.doors || []
      }
    };
  }

  private transformReservationsData(items: any[]): ReservationData[] {
    return items.map(item => this.transformReservationData(item));
  }

  private transformReservationData(item: any): ReservationData {
    // Extract basic fields
    const reservationCode = item.reservationCode?.S || item.reservationCode || '';
    const sourceId = parseInt(item.sourceId?.N || item.sourceId || '0');
    const homeAwayReferenceNumber = item.homeAwayReferenceNumber?.S || item.homeAwayReferenceNumber;

    // Calculate booking source
    const bookingSource = determineBookingSource(sourceId, reservationCode, homeAwayReferenceNumber);

    // Transform customFields properly
    let customFields = {};
    if (item.customFields?.M) {
      customFields = {
        checkin: {
          status: item.customFields.M.status?.S || 'pending',
          createdAt: item.customFields.M.createdAt?.N ? parseInt(item.customFields.M.createdAt.N) : undefined,
          updatedAt: item.customFields.M.updatedAt?.N ? parseInt(item.customFields.M.updatedAt.N) : undefined,
          submittedAt: item.customFields.M.submittedAt?.N ? parseInt(item.customFields.M.submittedAt.N) : undefined,
          mainGuestEmail: item.customFields.M.mainGuestEmail?.S || '',
          mainGuestFirstname: item.customFields.M.mainGuestFirstname?.S || '',
          mainGuestLastname: item.customFields.M.mainGuestLastname?.S || '',
          mainGuestPhoneNumber: item.customFields.M.mainGuestPhoneNumber?.S || '',
          documents: item.customFields.M.documents?.L?.map((doc: any) => ({
            type: doc.M?.type?.S || 'id',
            fileName: doc.M?.fileName?.S || 'Unknown',
            s3Key: doc.M?.s3Key?.S || '',
            uploadedAt: doc.M?.uploadedAt?.N ? parseInt(doc.M.uploadedAt.N) : Date.now()
          })) || [],
          validationResults: {
            documentsValid: item.customFields.M.validationResults?.M?.documentsValid?.BOOL || false,
            identityVerified: item.customFields.M.validationResults?.M?.identityVerified?.BOOL || false,
            validatedAt: item.customFields.M.validationResults?.M?.validatedAt?.N ?
              parseInt(item.customFields.M.validationResults.M.validatedAt.N) : undefined
          }
        }
      };
    } else if (item.customFields) {
      customFields = item.customFields;
    }

    return {
      PK: item.PK?.S || item.PK,
      SK: item.SK?.S || item.SK,
      reservationId: item.reservationId?.S || item.reservationId,
      reservationCode,
      roomId: item.roomId?.S || item.roomId,
      roomName: item.roomName?.S || item.roomName,
      roomAlias: item.roomAlias?.S || item.roomAlias,
      guestName: item.guestName?.S || item.guestName || '',
      guestSurname: item.guestSurname?.S || item.guestSurname || '',
      email: item.email?.S || item.email || '',
      phoneNumber: item.phoneNumber?.S || item.phoneNumber || '',
      checkInDate: parseInt(item.checkInDate?.N || item.checkInDate || '0'),
      checkOutDate: parseInt(item.checkOutDate?.N || item.checkOutDate || '0'),
      checkInDateWithTime: parseInt(item.checkInDateWithTime?.N || item.checkInDateWithTime || '0') || undefined,
      checkOutDateWithTime: parseInt(item.checkOutDateWithTime?.N || item.checkOutDateWithTime || '0') || undefined,
      nights: parseInt(item.nights?.N || item.nights || '0'),
      numOfAdults: parseInt(item.numOfAdults?.N || item.numOfAdults || '0'),
      numOfKids: parseInt(item.numOfKids?.N || item.numOfKids || '0'),
      numOfInfants: parseInt(item.numOfInfants?.N || item.numOfInfants || '0'),
      price: parseFloat(item.price?.N || item.price || '0'),
      currency: item.currency?.S || item.currency || 'USD',
      status: parseInt(item.status?.N || item.status || '0'),
      sourceId,
      addedDate: parseInt(item.addedDate?.N || item.addedDate || '0'),
      updatedAt: parseInt(item.updatedAt?.N || item.updatedAt || Date.now().toString()),
      isDeleted: parseInt(item.isDeleted?.N || item.isDeleted || '0') || undefined,
      isModified: parseInt(item.isModified?.N || item.isModified || '0') || undefined,
      guestId: item.guestId?.S || item.guestId,
      hostId: item.hostId?.S || item.hostId,
      note: item.note?.S || item.note,
      preferredEmail: item.preferredEmail?.S || item.preferredEmail,
      guestFormShortLink: item.guestFormShortLink?.S || item.guestFormShortLink,
      porterReservationPrice: parseFloat(item.porterReservationPrice?.N || item.porterReservationPrice || '0') || undefined,
      homeAwayReferenceNumber,
      rawDataHash: item.rawDataHash?.S || item.rawDataHash,
      hash: item.hash?.S || item.hash,
      sourceUpdatedAt: parseInt(item.sourceUpdatedAt?.N || item.sourceUpdatedAt || '0') || undefined,
      lastGuestySync: parseInt(item.lastGuestySync?.N || item.lastGuestySync || '0') || undefined,
      lastCustomUpdate: parseInt(item.lastCustomUpdate?.N || item.lastCustomUpdate || '0') || undefined,
      bookingSource,
      checkinStatus: item.customFields?.M?.checkin?.M?.status?.S || item.customFields?.checkin?.status,
      doorAccessStatus: item.customFields?.M?.doorAccesses?.M?.status?.S || item.customFields?.doorAccesses?.status,
      customFields: {
        checkin: {
          status: item.customFields?.M?.checkin?.M?.status?.S || item.customFields?.checkin?.status,
          createdAt: parseInt(item.customFields?.M?.checkin?.M?.createdAt?.N || item.customFields?.checkin?.createdAt || '0') || undefined,
          updatedAt: parseInt(item.customFields?.M?.checkin?.M?.updatedAt?.N || item.customFields?.checkin?.updatedAt || '0') || undefined,
          mainGuestEmail: item.customFields?.M?.checkin?.M?.mainGuestEmail?.S || item.customFields?.checkin?.mainGuestEmail || '',
          mainGuestFirstname: item.customFields?.M?.checkin?.M?.mainGuestFirstname?.S || item.customFields?.checkin?.mainGuestFirstname || '',
          mainGuestLastname: item.customFields?.M?.checkin?.M?.mainGuestLastname?.S || item.customFields?.checkin?.mainGuestLastname || '',
          mainGuestPhoneNumber: item.customFields?.M?.checkin?.M?.mainGuestPhoneNumber?.S || item.customFields?.checkin?.mainGuestPhoneNumber || '',
          accessNotificationFunctionScheduled: item.customFields?.M?.checkin?.M?.accessNotificationFunctionScheduled?.N ? true : false,
          submittedAt: parseInt(item.customFields?.M?.checkin?.M?.submittedAt?.N || item.customFields?.checkin?.submittedAt || '0') || undefined,
          documents: item.customFields?.M?.checkin?.M?.documents?.L || item.customFields?.checkin?.documents || [],
          validationResults: {
            documentsValid: item.customFields?.M?.checkin?.M?.validationResults?.M?.documentsValid?.BOOL || false,
            identityVerified: item.customFields?.M?.checkin?.M?.validationResults?.M?.identityVerified?.BOOL || false,
            validatedAt: parseInt(item.customFields?.M?.checkin?.M?.validationResults?.M?.validatedAt?.N || item.customFields?.checkin?.validationResults?.validatedAt || '0') || undefined
          }
        },
        doorAccesses: {
          status: item.customFields?.M?.doorAccesses?.M?.status?.S || item.customFields?.doorAccesses?.status,
          generatedAt: parseInt(item.customFields?.M?.doorAccesses?.M?.generatedAt?.N || item.customFields?.doorAccesses?.generatedAt || '0') || undefined,
          accessNotificationScheduled: item.customFields?.M?.doorAccesses?.M?.accessNotificationScheduled?.BOOL || false,
          accessNotificationScheduledAt: parseInt(item.customFields?.M?.doorAccesses?.M?.accessNotificationScheduledAt?.N || item.customFields?.doorAccesses?.accessNotificationScheduledAt || '0') || undefined,
          qrCode: item.customFields?.M?.doorAccesses?.M?.qrCode?.S || item.customFields?.doorAccesses?.qrCode || '',
          pinCodes: item.customFields?.M?.doorAccesses?.M?.pinCodes?.M || item.customFields?.doorAccesses?.pinCodes || {},
          doorInfo: {
            pin_doors: item.customFields?.M?.doorAccesses?.M?.doorInfo?.M?.pin_doors?.L || item.customFields?.doorAccesses?.doorInfo?.pin_doors || [],
            qr_doors: item.customFields?.M?.doorAccesses?.M?.doorInfo?.M?.qr_doors?.L || item.customFields?.doorAccesses?.doorInfo?.qr_doors || [],
            total_doors: parseInt(item.customFields?.M?.doorAccesses?.M?.doorInfo?.M?.total_doors?.N || item.customFields?.doorAccesses?.doorInfo?.total_doors || '0')
          },
          usageHistory: item.customFields?.M?.doorAccesses?.M?.usageHistory?.L || item.customFields?.doorAccesses?.usageHistory || []
        }
      },
      rawData: item.rawData?.M ? {
        sourceId: parseInt(item.rawData.M.sourceId?.N || item.rawData.M.sourceId || '0') || undefined,
        note: item.rawData.M.note?.S || item.rawData.M.note,
        numOfAdults: parseInt(item.rawData.M.numOfAdults?.N || item.rawData.M.numOfAdults || '0') || undefined,
        addedDate: parseInt(item.rawData.M.addedDate?.N || item.rawData.M.addedDate || '0') || undefined,
        roomAlias: item.rawData.M.roomAlias?.S || item.rawData.M.roomAlias,
        lastUpdateDate: parseInt(item.rawData.M.lastUpdateDate?.N || item.rawData.M.lastUpdateDate || '0') || undefined,
        checkInDate: parseInt(item.rawData.M.checkInDate?.N || item.rawData.M.checkInDate || '0') || undefined,
        numOfInfants: parseInt(item.rawData.M.numOfInfants?.N || item.rawData.M.numOfInfants || '0') || undefined,
        roomId: item.rawData.M.roomId?.S || item.rawData.M.roomId,
        guestName: item.rawData.M.guestName?.S || item.rawData.M.guestName,
        reservationCode: item.rawData.M.reservationCode?.S || item.rawData.M.reservationCode,
        guestFormShortLink: item.rawData.M.guestFormShortLink?.S || item.rawData.M.guestFormShortLink,
        checkInDateWithTime: parseInt(item.rawData.M.checkInDateWithTime?.N || item.rawData.M.checkInDateWithTime || '0') || undefined,
        preferredEmail: item.rawData.M.preferredEmail?.S || item.rawData.M.preferredEmail,
        reservationId: item.rawData.M.reservationId?.S || item.rawData.M.reservationId,
        checkOutDate: parseInt(item.rawData.M.checkOutDate?.N || item.rawData.M.checkOutDate || '0') || undefined,
        isDeleted: parseInt(item.rawData.M.isDeleted?.N || item.rawData.M.isDeleted || '0') || undefined,
        isModified: parseInt(item.rawData.M.isModified?.N || item.rawData.M.isModified || '0') || undefined,
        price: parseFloat(item.rawData.M.price?.N || item.rawData.M.price || '0') || undefined,
        currency: item.rawData.M.currency?.S || item.rawData.M.currency,
        checkOutDateWithTime: parseInt(item.rawData.M.checkOutDateWithTime?.N || item.rawData.M.checkOutDateWithTime || '0') || undefined,
        guestId: item.rawData.M.guestId?.S || item.rawData.M.guestId,
        email: item.rawData.M.email?.S || item.rawData.M.email,
        numOfKids: parseInt(item.rawData.M.numOfKids?.N || item.rawData.M.numOfKids || '0') || undefined,
        guestSurname: item.rawData.M.guestSurname?.S || item.rawData.M.guestSurname,
        hostId: item.rawData.M.hostId?.S || item.rawData.M.hostId,
        porterReservationPrice: parseFloat(item.rawData.M.porterReservationPrice?.N || item.rawData.M.porterReservationPrice || '0') || undefined,
        roomName: item.rawData.M.roomName?.S || item.rawData.M.roomName,
        phoneNumber: item.rawData.M.phoneNumber?.S || item.rawData.M.phoneNumber,
        homeAwayReferenceNumber: item.rawData.M.homeAwayReferenceNumber?.S || item.rawData.M.homeAwayReferenceNumber,
        nights: parseInt(item.rawData.M.nights?.N || item.rawData.M.nights || '0') || undefined,
        status: parseInt(item.rawData.M.status?.N || item.rawData.M.status || '0') || undefined
      } : undefined
    };
  }

  private updateListingInSubject(updatedListing: ListingData): void {
    const currentListings = this.listingsSubject.value;
    const updatedListings = currentListings.map(listing =>
      listing.PK === updatedListing.PK ? updatedListing : listing
    );
    this.listingsSubject.next(updatedListings);
  }

  private updateReservationInSubject(updatedReservation: ReservationData): void {
    const currentReservations = this.reservationsSubject.value;
    const updatedReservations = currentReservations.map(reservation =>
      reservation.PK === updatedReservation.PK ? updatedReservation : reservation
    );
    this.reservationsSubject.next(updatedReservations);
  }


}
