import { Injectable } from '@angular/core';
import { Observable, of, from, throwError } from 'rxjs';
import { map, delay, catchError } from 'rxjs/operators';

// Import all interfaces
import { PropertyGroup, UnitModel, IndividualUnit } from '../interfaces/property.interface';
import { User } from '../interfaces/user.interface';
import { BookingModel, CheckInData } from '../interfaces/booking.interface';
import { Payment } from '../interfaces/payment.interface';
import { QRCode } from '../interfaces/qrcode.interface';

// AWS SDK v3 imports
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
  BatchWriteCommand
} from '@aws-sdk/lib-dynamodb';
// Removed fromCognitoIdentityPool import - no longer using Identity Pool
import { fetchAuthSession } from 'aws-amplify/auth';
import { environment } from '../../environments/environment';
import { AWSConfigService, canAccessDynamoDBResource } from '../config/aws.config';
import { ConfigService } from './config.service';
import { UserApiService } from './user-api.service';

// DynamoDB Query Parameters
export interface QueryParams {
  PK?: string;
  SK?: string;
  GSI?: string;
  GSI_PK?: string;
  GSI_SK?: string;
  FilterExpression?: string;
  ExpressionAttributeValues?: any;
  Limit?: number;
  ScanIndexForward?: boolean;
}

// DynamoDB Response
export interface DynamoDBResponse<T> {
  Items: T[];
  Count: number;
  ScannedCount: number;
  LastEvaluatedKey?: any;
}

@Injectable({
  providedIn: 'root'
})
export class ModelService {
  private dynamoDBClient!: DynamoDBClient;
  private docClient!: DynamoDBDocumentClient;
  private tableName: string = 'harmonest-dev-main'; // fallback value

  constructor(
    private configService: ConfigService,
    private awsConfigService: AWSConfigService,
    private userApiService: UserApiService
  ) {
    this.initializeConfiguration();
    // Don't initialize DynamoDB client in constructor - wait for authentication
  }

  private initializeConfiguration() {
    const config = this.configService.getConfig();
    if (config?.technical?.aws?.dynamodb?.tableName) {
      this.tableName = config.technical.aws.dynamodb.tableName;
    } else {
      // Subscribe to config changes
      this.configService.getConfigObservable().subscribe(loadedConfig => {
        if (loadedConfig?.technical?.aws?.dynamodb?.tableName) {
          this.tableName = loadedConfig.technical.aws.dynamodb.tableName;
          // Reinitialize DynamoDB client with new config
          this.initializeDynamoDBClient();
        }
      });
    }
  }

  /**
   * Initialize DynamoDB client with appropriate credentials
   * For development: Uses AWS CLI credentials (harmonestadmin profile)
   * For production: Should use Cognito Identity Pool or API Gateway
   */
  private async initializeDynamoDBClient(): Promise<void> {
    try {
      // Get AWS config from centralized configuration
      const awsConfig = this.awsConfigService.getAWSConfig();
      if (!awsConfig) {
        throw new Error('AWS configuration not available');
      }

      const config = this.configService.getConfig();
      const isDevelopment = config?.environment?.type === 'dev' || !config?.environment?.type;

      // Try to get credentials from Cognito Identity Pool first
      try {
        const session = await fetchAuthSession();

        if (session.credentials && session.tokens?.idToken) {
          // Check user role to ensure they have DynamoDB access
          const payload = session.tokens.idToken.payload;
          const groups = (payload['cognito:groups'] as string[]) || [];
          const userRole = groups.length > 0 ? groups[0] : 'guest';

          // Don't attempt DynamoDB connection for guest users
          if (userRole === 'guest') {
            throw new Error('Guest users do not have DynamoDB access. Please contact an administrator to assign proper permissions.');
          }

          // Check if user role has DynamoDB permissions before attempting connection
          const hasAccess = canAccessDynamoDBResource(userRole, 'read', 'test', payload.sub as string);
          if (!hasAccess) {
            throw new Error(`Role '${userRole}' does not have DynamoDB access permissions.`);
          }

          this.dynamoDBClient = new DynamoDBClient({
            region: awsConfig.region,
            credentials: session.credentials
          });
          this.docClient = DynamoDBDocumentClient.from(this.dynamoDBClient);

          // Test the connection to ensure credentials work
          const connectionTest = await this.testDynamoDBConnection();
          if (!connectionTest) {
            throw new Error(`DynamoDB access denied for role '${userRole}'. Please check your permissions.`);
          }

          return;
        }
      } catch (cognitoError) {
        console.warn('⚠️ [ModelService] Cognito session error:', cognitoError);

        if (cognitoError instanceof Error && cognitoError.message.includes('Guest users do not have DynamoDB access')) {
          throw cognitoError;
        }
        if (cognitoError instanceof Error && cognitoError.message.includes('DynamoDB access denied')) {
          throw cognitoError;
        }
      }

      // Fallback for development: Use AWS CLI credentials
      if (isDevelopment) {
        console.log('🔄 [ModelService] Development fallback: Using AWS CLI credentials for DynamoDB');

        this.dynamoDBClient = new DynamoDBClient({
          region: awsConfig.region
          // Will use default credential chain (AWS CLI profile: harmonestadmin)
        });

        this.docClient = DynamoDBDocumentClient.from(this.dynamoDBClient);

        // Test the connection to ensure credentials work
        const connectionTest = await this.testDynamoDBConnection();
        if (!connectionTest) {
          throw new Error('DynamoDB connection test failed. Please ensure AWS CLI is configured with harmonestadmin profile.');
        }

        return;
      }

      throw new Error('Unable to obtain AWS credentials for DynamoDB access. Please ensure you are signed in and have proper permissions.');

    } catch (error) {
      console.error('❌ [ModelService] Failed to initialize DynamoDB client:', error);
      throw error;
    }
  }

  /**
   * Ensure DynamoDB client is initialized
   */
  private async ensureClientInitialized(): Promise<void> {
    if (!this.docClient) {
      try {
        // Check if user is authenticated first
        const session = await fetchAuthSession();
        if (!session.tokens?.idToken) {
          throw new Error('Authentication required. Please sign in to access data.');
        }

        await this.initializeDynamoDBClient();
      } catch (error) {
        console.error('❌ [ModelService] Failed to initialize DynamoDB client:', error);

        if (error instanceof Error && error.message.includes('Authentication required')) {
          throw error;
        }

        throw new Error('DynamoDB client initialization failed. Please check your AWS configuration and ensure you are properly authenticated.');
      }
    }
  }

  /**
   * Check if user has permission to access DynamoDB based on their Cognito group
   */
  private async checkDynamoDBAccess(operation: 'read' | 'write' | 'delete', resourceKey?: string): Promise<boolean> {
    try {
      // Get current user session to check groups
      const session = await fetchAuthSession();
      if (!session.tokens?.idToken) {
        console.warn('⚠️ [ModelService] No valid session for DynamoDB access check');
        return false;
      }

      const payload = session.tokens.idToken.payload;
      const groups = (payload['cognito:groups'] as string[]) || [];
      const userId = payload.sub as string;

      // If no groups, default to guest access
      const userRole = groups.length > 0 ? groups[0] : 'guest';

      // Use the role-based access control function
      const hasAccess = canAccessDynamoDBResource(userRole, operation, resourceKey || '', userId);

      if (!hasAccess) {
        console.warn(`⚠️ [ModelService] Access denied for role '${userRole}' to perform '${operation}' on '${resourceKey}'`);
      }

      return hasAccess;
    } catch (error) {
      console.error('❌ [ModelService] Error checking DynamoDB access:', error);
      return false;
    }
  }

  /**
   * Check if current user has DynamoDB access
   */
  async hasUserDynamoDBAccess(): Promise<boolean> {
    try {
      const session = await fetchAuthSession();
      if (!session.tokens?.idToken) {
        console.log('🔍 [ModelService] No authentication token - no DynamoDB access');
        return false;
      }

      const payload = session.tokens.idToken.payload;
      const groups = (payload['cognito:groups'] as string[]) || [];
      const userRole = groups.length > 0 ? groups[0] : 'guest';

      // Guest users and unauthenticated users don't have DynamoDB access
      if (userRole === 'guest') {
        console.log('🔍 [ModelService] Guest users do not have DynamoDB access');
        return false;
      }

      // Check if user has any DynamoDB permissions based on role
      const hasAccess = canAccessDynamoDBResource(userRole, 'read', 'test', payload.sub as string);

      return hasAccess;
    } catch (error) {
      console.log('🔍 [ModelService] Error checking DynamoDB access:', error);
      return false;
    }
  }

  /**
   * Test DynamoDB connection
   */
  async testDynamoDBConnection(): Promise<boolean> {
    try {
      await this.ensureClientInitialized();

      // Try a simple scan with limit 1 to test connection
      const command = new ScanCommand({
        TableName: this.tableName,
        Limit: 1
      });

      const result = await this.docClient.send(command);
      return true;
    } catch (error) {
      console.error('❌ [ModelService] DynamoDB connection test failed:', error);

      // Provide more specific error information
      if (error instanceof Error) {
        if (error.message.includes('ResourceNotFoundException')) {
          console.error(`❌ [ModelService] Table '${this.tableName}' not found`);
        } else if (error.message.includes('UnrecognizedClientException')) {
          console.error('❌ [ModelService] Invalid AWS credentials');
        } else if (error.message.includes('AccessDeniedException')) {
          console.error('❌ [ModelService] Access denied - check IAM permissions');
        }
      }

      return false;
    }
  }

  // ==================== GENERIC DYNAMODB OPERATIONS ====================

  /**
   * Generic get item operation
   */
  getItem<T>(PK: string, SK: string): Observable<T | null> {
    return from(this.getItemAsync<T>(PK, SK));
  }

  /**
   * Async get item operation
   */
  private async getItemAsync<T>(PK: string, SK: string): Promise<T | null> {
    await this.ensureClientInitialized();

    const command = new GetCommand({
      TableName: this.tableName,
      Key: { PK, SK }
    });

    try {
      const result = await this.docClient.send(command);
      return result.Item as T || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generic put item operation
   */
  putItem<T extends Record<string, any>>(item: T): Observable<T> {
    return from(this.putItemAsync(item));
  }

  /**
   * Async put item operation
   */
  private async putItemAsync<T extends Record<string, any>>(item: T): Promise<T> {
    await this.ensureClientInitialized();

    // Remove undefined values from item
    const cleanItem = this.removeUndefinedValues(item) as T;

    const command = new PutCommand({
      TableName: this.tableName,
      Item: cleanItem
    });

    try {
      await this.docClient.send(command);
      return cleanItem;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Remove undefined values from an object recursively
   */
  private removeUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.removeUndefinedValues(item)).filter(item => item !== undefined);
    }

    if (typeof obj === 'object') {
      const cleaned: any = {};
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (value !== undefined) {
          cleaned[key] = this.removeUndefinedValues(value);
        }
      });
      return cleaned;
    }

    return obj;
  }

  /**
   * Generic update item operation
   */
  updateItem<T>(PK: string, SK: string, updates: Partial<T>): Observable<T> {
    return from(this.updateItemAsync(PK, SK, updates));
  }

  /**
   * Async update item operation
   */
  private async updateItemAsync<T>(PK: string, SK: string, updates: Partial<T>): Promise<T> {
    await this.ensureClientInitialized();

    // Remove undefined values from updates
    const cleanUpdates = this.removeUndefinedValues(updates);

    // Build update expression
    const updateExpressions: string[] = [];
    const expressionAttributeValues: any = {};
    const expressionAttributeNames: any = {};

    Object.keys(cleanUpdates).forEach((key, index) => {
      const attributeName = `#attr${index}`;
      const attributeValue = `:val${index}`;

      expressionAttributeNames[attributeName] = key;
      expressionAttributeValues[attributeValue] = (cleanUpdates as any)[key];
      updateExpressions.push(`${attributeName} = ${attributeValue}`);
    });

    // Add updatedAt timestamp
    const updatedAtName = `#updatedAt`;
    const updatedAtValue = `:updatedAt`;
    expressionAttributeNames[updatedAtName] = 'updatedAt';
    expressionAttributeValues[updatedAtValue] = new Date().toISOString();
    updateExpressions.push(`${updatedAtName} = ${updatedAtValue}`);

    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: { PK, SK },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    });

    try {
      const result = await this.docClient.send(command);
      return result.Attributes as T;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generic delete item operation
   */
  deleteItem(PK: string, SK: string): Observable<boolean> {
    return from(this.deleteItemAsync(PK, SK));
  }

  /**
   * Async delete item operation
   */
  private async deleteItemAsync(PK: string, SK: string): Promise<boolean> {
    await this.ensureClientInitialized();

    const command = new DeleteCommand({
      TableName: this.tableName,
      Key: { PK, SK }
    });

    try {
      await this.docClient.send(command);
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generic query operation
   */
  query<T>(params: QueryParams): Observable<DynamoDBResponse<T>> {
    return from(this.queryAsync<T>(params));
  }

  /**
   * Async query operation
   */
  private async queryAsync<T>(params: QueryParams): Promise<DynamoDBResponse<T>> {
    await this.ensureClientInitialized();

    const queryParams: any = {
      TableName: this.tableName
    };

    // Add GSI if specified
    if (params.GSI) {
      queryParams.IndexName = params.GSI;
    }

    // Add key conditions
    if (params.PK) {
      queryParams.KeyConditionExpression = 'PK = :pk';
      queryParams.ExpressionAttributeValues = { ':pk': params.PK };

      if (params.SK) {
        queryParams.KeyConditionExpression += ' AND SK = :sk';
        queryParams.ExpressionAttributeValues[':sk'] = params.SK;
      }
    } else if (params.GSI_PK) {
      const pkName = `${params.GSI}PK`;
      queryParams.KeyConditionExpression = `${pkName} = :gsi_pk`;
      queryParams.ExpressionAttributeValues = { ':gsi_pk': params.GSI_PK };

      if (params.GSI_SK) {
        const skName = `${params.GSI}SK`;
        queryParams.KeyConditionExpression += ` AND ${skName} = :gsi_sk`;
        queryParams.ExpressionAttributeValues[':gsi_sk'] = params.GSI_SK;
      }
    }

    // Add filter expression
    if (params.FilterExpression) {
      queryParams.FilterExpression = params.FilterExpression;
      if (params.ExpressionAttributeValues) {
        queryParams.ExpressionAttributeValues = {
          ...queryParams.ExpressionAttributeValues,
          ...params.ExpressionAttributeValues
        };
      }
    }

    // Add other parameters
    if (params.Limit) queryParams.Limit = params.Limit;
    if (params.ScanIndexForward !== undefined) queryParams.ScanIndexForward = params.ScanIndexForward;

    const command = new QueryCommand(queryParams);

    try {
      const result = await this.docClient.send(command);
      return {
        Items: result.Items as T[],
        Count: result.Count || 0,
        ScannedCount: result.ScannedCount || 0,
        LastEvaluatedKey: result.LastEvaluatedKey
      };
    } catch (error) {
      throw error;
    }
  }

  // ==================== PROPERTY GROUP OPERATIONS ====================

  /**
   * Get all property groups (for management panel)
   */
  getPropertyGroups(): Promise<PropertyGroup[]> {
    // For now, return all property groups - in production, filter by user permissions
    const params: QueryParams = {
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'PROPERTY_GROUP#'
      }
    };
    return this.scanItems(params).pipe(
      map(items => items.map(item => this.mapToPropertyGroup(item)))
    ).toPromise() as Promise<PropertyGroup[]>;
  }

  /**
   * Get all property groups for an owner
   */
  getPropertyGroupsByOwner(ownerId: string): Observable<PropertyGroup[]> {
    const params: QueryParams = {
      GSI: 'GSI1',
      GSI_PK: `OWNER#${ownerId}`,
      ScanIndexForward: false
    };

    return this.query<PropertyGroup>(params).pipe(
      map(response => response.Items)
    );
  }

  /**
   * Get property groups by location
   */
  getPropertyGroupsByLocation(city: string, country: string): Observable<PropertyGroup[]> {
    const params: QueryParams = {
      GSI: 'GSI2',
      GSI_PK: `LOCATION#${city}#${country}`,
      ScanIndexForward: false
    };

    return this.query<PropertyGroup>(params).pipe(
      map(response => response.Items)
    );
  }

  /**
   * Create property group
   */
  createPropertyGroup(propertyGroup: PropertyGroup): Observable<PropertyGroup> {
    return this.putItem(propertyGroup);
  }

  /**
   * Update property group
   */
  updatePropertyGroup(groupId: string, updates: Partial<PropertyGroup>): Observable<PropertyGroup> {
    return this.updateItem(`PROPERTY_GROUP#${groupId}`, 'METADATA', {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  }

  // ==================== UNIT MODEL OPERATIONS ====================

  /**
   * Get unit models for a property group
   */
  getUnitModelsByGroup(groupId: string): Observable<UnitModel[]> {
    const params: QueryParams = {
      PK: `PROPERTY_GROUP#${groupId}`,
      SK: 'UNIT_MODEL#',
      FilterExpression: 'begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':sk': 'UNIT_MODEL#'
      }
    };

    return this.query<UnitModel>(params).pipe(
      map(response => response.Items)
    );
  }

  /**
   * Get available unit models
   */
  getAvailableUnitModels(): Observable<UnitModel[]> {
    const params: QueryParams = {
      GSI: 'GSI2',
      GSI_PK: 'AVAILABILITY#available',
      ScanIndexForward: false
    };

    return this.query<UnitModel>(params).pipe(
      map(response => response.Items)
    );
  }

  /**
   * Create unit model
   */
  createUnitModel(unitModel: UnitModel): Observable<UnitModel> {
    return this.putItem(unitModel);
  }

  /**
   * Update unit model inventory
   */
  updateUnitModelInventory(modelId: string, inventory: any): Observable<any> {
    return this.updateItem(`PROPERTY_GROUP#${inventory.groupId}`, `UNIT_MODEL#${modelId}`, {
      inventory: {
        ...inventory,
        lastUpdated: new Date().toISOString()
      },
      updatedAt: new Date().toISOString()
    });
  }

  // ==================== INDIVIDUAL UNIT OPERATIONS ====================

  /**
   * Get all individual units (for management panel)
   */
  getIndividualUnits(): Promise<IndividualUnit[]> {
    const params: QueryParams = {
      FilterExpression: 'begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':sk': 'INDIVIDUAL_UNIT#'
      }
    };
    return this.scanItems(params).pipe(
      map(items => items.map(item => this.mapToIndividualUnit(item)))
    ).toPromise() as Promise<IndividualUnit[]>;
  }

  /**
   * Get all unit models (for management panel)
   */
  getUnitModels(): Promise<UnitModel[]> {
    const params: QueryParams = {
      FilterExpression: 'begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':sk': 'UNIT_MODEL#'
      }
    };
    return this.scanItems(params).pipe(
      map(items => items.map(item => this.mapToUnitModel(item)))
    ).toPromise() as Promise<UnitModel[]>;
  }

  /**
   * Get individual units for a model
   */
  getIndividualUnitsByModel(modelId: string): Observable<IndividualUnit[]> {
    const params: QueryParams = {
      PK: `UNIT_MODEL#${modelId}`,
      SK: 'INDIVIDUAL_UNIT#',
      FilterExpression: 'begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':sk': 'INDIVIDUAL_UNIT#'
      }
    };

    return this.query<IndividualUnit>(params).pipe(
      map(response => response.Items)
    );
  }

  /**
   * Get available units
   */
  getAvailableUnits(): Observable<IndividualUnit[]> {
    const params: QueryParams = {
      GSI: 'GSI3',
      GSI_PK: 'AVAILABILITY#available',
      ScanIndexForward: false
    };

    return this.query<IndividualUnit>(params).pipe(
      map(response => response.Items)
    );
  }

  /**
   * Update unit status
   */
  updateUnitStatus(unitId: string, modelId: string, status: any): Observable<any> {
    return this.updateItem(`UNIT_MODEL#${modelId}`, `INDIVIDUAL_UNIT#${unitId}`, {
      status,
      updatedAt: new Date().toISOString()
    });
  }

  // ==================== USER OPERATIONS - REMOVED ====================
  // User operations have been moved to the dedicated UserService.
  // All user management is now handled through AWS Cognito User Pool.
  // See src/app/services/user.service.ts for user-related operations.

  // ========== COGNITO USER ROLE MANAGEMENT - KEPT ACTIVE ==========
  // This method is kept active because it's still useful for updating user roles in Cognito
  // even when we're not using DynamoDB for user storage.

  /**
   * Update user role in Cognito User Pool
   * This ensures JWT tokens have the correct role
   */
  async updateCognitoUserRole(email: string, newRole: string): Promise<void> {
    try {
      // Import AWS SDK for Cognito operations
      const { CognitoIdentityProviderClient, AdminUpdateUserAttributesCommand } = await import('@aws-sdk/client-cognito-identity-provider');
      const { fetchAuthSession } = await import('aws-amplify/auth');

      // Get current session for credentials
      const session = await fetchAuthSession();

      if (!session.credentials) {
        throw new Error('No valid AWS credentials available');
      }

      // Initialize Cognito client
      const cognitoClient = new CognitoIdentityProviderClient({
        region: 'eu-central-1', // Your Cognito region
        credentials: {
          accessKeyId: session.credentials.accessKeyId,
          secretAccessKey: session.credentials.secretAccessKey,
          sessionToken: session.credentials.sessionToken
        }
      });

      // Update the custom:role attribute in Cognito
      const command = new AdminUpdateUserAttributesCommand({
        UserPoolId: 'eu-central-1_3nRWgJleG', // Your User Pool ID
        Username: email,
        UserAttributes: [
          {
            Name: 'custom:role',
            Value: newRole
          }
        ]
      });

      await cognitoClient.send(command);

    } catch (error) {
      // Note: Previously this method also updated DynamoDB, but that's no longer needed
      if (error instanceof Error && error.name === 'AccessDeniedException') {
        return;
      }

      throw error;
    }
  }

  // ==================== BOOKING OPERATIONS ====================

  /**
   * Get bookings for user
   */
  getBookingsByUser(userId: string): Observable<BookingModel[]> {
    const params: QueryParams = {
      GSI: 'GSI1',
      GSI_PK: `USER#${userId}`,
      ScanIndexForward: false
    };

    return this.query<BookingModel>(params).pipe(
      map(response => response.Items)
    );
  }

  /**
   * Get bookings for property group
   */
  getBookingsByPropertyGroup(propertyGroupId: string): Observable<BookingModel[]> {
    const params: QueryParams = {
      GSI: 'GSI2',
      GSI_PK: `PROPERTY_GROUP#${propertyGroupId}`,
      ScanIndexForward: false
    };

    return this.query<BookingModel>(params).pipe(
      map(response => response.Items)
    );
  }

  /**
   * Get bookings by status
   */
  getBookingsByStatus(status: string): Observable<BookingModel[]> {
    const params: QueryParams = {
      GSI: 'GSI3',
      GSI_PK: `STATUS#${status}`,
      ScanIndexForward: false
    };

    return this.query<BookingModel>(params).pipe(
      map(response => response.Items)
    );
  }

  /**
   * Get bookings by check-in date
   */
  getBookingsByCheckInDate(date: string, propertyGroupId?: string): Observable<BookingModel[]> {
    const params: QueryParams = {
      GSI: 'GSI4',
      GSI_PK: `CHECK_IN_DATE#${date}`,
      ScanIndexForward: false
    };

    if (propertyGroupId) {
      params.FilterExpression = 'propertyGroupId = :pgid';
      params.ExpressionAttributeValues = {
        ':pgid': propertyGroupId
      };
    }

    return this.query<BookingModel>(params).pipe(
      map(response => response.Items)
    );
  }

  /**
   * Create booking
   */
  createBooking(booking: BookingModel): Observable<BookingModel> {
    return this.putItem(booking);
  }

  /**
   * Update booking status
   */
  updateBookingStatus(bookingId: string, status: string, paymentStatus?: string): Observable<BookingModel> {
    const updates: any = {
      status,
      updatedAt: new Date().toISOString()
    };

    if (paymentStatus) {
      updates.paymentStatus = paymentStatus;
    }

    // Update GSI3 keys for status queries
    updates.GSI3PK = `STATUS#${status}`;

    return this.updateItem(`BOOKING#${bookingId}`, 'METADATA', updates);
  }

  // ==================== PAYMENT OPERATIONS ====================

  /**
   * Get payments for booking
   */
  getPaymentsByBooking(bookingId: string): Observable<Payment[]> {
    const params: QueryParams = {
      GSI: 'GSI1',
      GSI_PK: `BOOKING#${bookingId}`,
      ScanIndexForward: false
    };

    return this.query<Payment>(params).pipe(
      map(response => response.Items)
    );
  }

  /**
   * Get payments for user
   */
  getPaymentsByUser(userId: string): Observable<Payment[]> {
    const params: QueryParams = {
      GSI: 'GSI2',
      GSI_PK: `USER#${userId}`,
      ScanIndexForward: false
    };

    return this.query<Payment>(params).pipe(
      map(response => response.Items)
    );
  }

  /**
   * Get payments by status
   */
  getPaymentsByStatus(status: string): Observable<Payment[]> {
    const params: QueryParams = {
      GSI: 'GSI3',
      GSI_PK: `STATUS#${status}`,
      ScanIndexForward: false
    };

    return this.query<Payment>(params).pipe(
      map(response => response.Items)
    );
  }

  /**
   * Create payment
   */
  createPayment(payment: Payment): Observable<Payment> {
    return this.putItem(payment);
  }

  /**
   * Update payment status
   */
  updatePaymentStatus(paymentId: string, status: string, gatewayResponse?: any): Observable<Payment> {
    const updates: any = {
      'transaction.status': status,
      updatedAt: new Date().toISOString()
    };

    if (gatewayResponse) {
      updates['transaction.gatewayResponse'] = gatewayResponse;
    }

    if (status === 'succeeded') {
      updates.processedAt = new Date().toISOString();
    }

    // Update GSI3 keys for status queries
    updates.GSI3PK = `STATUS#${status}`;

    return this.updateItem(`PAYMENT#${paymentId}`, 'METADATA', updates);
  }

  // ==================== QR CODE OPERATIONS ====================

  /**
   * Get QR codes for booking
   */
  getQRCodesByBooking(bookingId: string): Observable<QRCode[]> {
    const params: QueryParams = {
      GSI: 'GSI1',
      GSI_PK: `BOOKING#${bookingId}`,
      ScanIndexForward: false
    };

    return this.query<QRCode>(params).pipe(
      map(response => response.Items)
    );
  }

  /**
   * Get QR codes for property group
   */
  getQRCodesByPropertyGroup(propertyGroupId: string): Observable<QRCode[]> {
    const params: QueryParams = {
      GSI: 'GSI2',
      GSI_PK: `PROPERTY_GROUP#${propertyGroupId}`,
      ScanIndexForward: false
    };

    return this.query<QRCode>(params).pipe(
      map(response => response.Items)
    );
  }

  /**
   * Get active QR codes
   */
  getActiveQRCodes(): Observable<QRCode[]> {
    const params: QueryParams = {
      GSI: 'GSI3',
      GSI_PK: 'STATUS#active',
      ScanIndexForward: false
    };

    return this.query<QRCode>(params).pipe(
      map(response => response.Items)
    );
  }

  /**
   * Get QR codes for unit
   */
  getQRCodesByUnit(unitId: string): Observable<QRCode[]> {
    const params: QueryParams = {
      GSI: 'GSI4',
      GSI_PK: `UNIT#${unitId}`,
      ScanIndexForward: false
    };

    return this.query<QRCode>(params).pipe(
      map(response => response.Items)
    );
  }

  /**
   * Create QR code
   */
  createQRCode(qrCode: QRCode): Observable<QRCode> {
    return this.putItem(qrCode);
  }

  /**
   * Update QR code status
   */
  updateQRCodeStatus(qrCodeId: string, status: string, reason?: string): Observable<QRCode> {
    const updates: any = {
      status,
      updatedAt: new Date().toISOString()
    };

    if (status === 'revoked' && reason) {
      updates['validity.revokedAt'] = new Date().toISOString();
      updates['validity.revokeReason'] = reason;
    }

    // Update GSI3 keys for status queries
    updates.GSI3PK = `STATUS#${status}`;

    return this.updateItem(`QRCODE#${qrCodeId}`, 'METADATA', updates);
  }

  /**
   * Update QR code usage
   */
  updateQRCodeUsage(qrCodeId: string, usageData: any): Observable<any> {
    return this.updateItem(`QRCODE#${qrCodeId}`, 'METADATA', {
      usage: usageData,
      updatedAt: new Date().toISOString()
    });
  }

  // ==================== MANAGEMENT PANEL METHODS ====================

  // ========== PUBLIC UTILITY METHODS ==========

  /**
   * Check if DynamoDB operations are available for current user
   */
  async isDynamoDBAvailable(): Promise<boolean> {
    try {
      return await this.hasUserDynamoDBAccess();
    } catch (error) {
      return false;
    }
  }

  /**
   * Force refresh AWS credentials (useful after Identity Pool changes)
   */
  async refreshAWSCredentials(): Promise<void> {
    try {
      console.log('🔄 [ModelService] Forcing AWS credentials refresh...');

      // Clear the current DynamoDB client to force re-initialization
      this.dynamoDBClient = null as any;
      this.docClient = null as any;

      // Force Amplify to refresh credentials
      const session = await fetchAuthSession({ forceRefresh: true });

      if (session.credentials) {
        console.log('✅ [ModelService] AWS credentials refreshed successfully');

        // Re-initialize DynamoDB client with fresh credentials
        await this.initializeDynamoDBClient();
      } else {
        throw new Error('Failed to refresh AWS credentials');
      }
    } catch (error) {
      console.error('❌ [ModelService] Failed to refresh AWS credentials:', error);
      throw error;
    }
  }

  /**
   * Handle AWS service errors and retry with refreshed credentials if needed
   */
  async handleAWSError<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      // Check if it's a token expiration error
      if (this.isTokenExpiredError(error)) {
        console.log(`🔄 [ModelService] Token expired for ${operationName}, refreshing credentials...`);

        try {
          // Refresh AWS credentials
          await this.refreshAWSCredentials();

          // Retry the operation
          console.log(`🔄 [ModelService] Retrying ${operationName} with refreshed credentials...`);
          return await operation();
        } catch (retryError) {
          console.error(`❌ [ModelService] ${operationName} failed even after credential refresh:`, retryError);
          throw retryError;
        }
      } else {
        // Not a token error, just throw the original error
        throw error;
      }
    }
  }

  /**
   * Check if an error is related to expired tokens
   */
  private isTokenExpiredError(error: any): boolean {
    if (!error) return false;

    const errorMessage = error.message || error.toString();
    const errorCode = error.name || error.code || error.__type;

    return (
      errorCode === 'ExpiredTokenException' ||
      errorCode === 'TokenExpiredException' ||
      errorCode === 'UnauthorizedOperation' ||
      errorCode === 'AccessDenied' ||
      errorMessage.includes('expired') ||
      errorMessage.includes('ExpiredTokenException') ||
      errorMessage.includes('The security token included in the request is expired') ||
      errorMessage.includes('token') && errorMessage.includes('expired')
    );
  }

  /**
   * Debug JWT token and AWS credentials (temporary debugging method)
   */
  async debugTokenAndCredentials(): Promise<void> {
    try {
      console.log('🔍 [DEBUG] Fetching current session...');
      const session = await fetchAuthSession();

      console.log('🔍 [DEBUG] Session details:');
      console.log('- Has ID Token:', !!session.tokens?.idToken);
      console.log('- Has Access Token:', !!session.tokens?.accessToken);
      console.log('- Has AWS Credentials:', !!session.credentials);

      if (session.tokens?.idToken) {
        const payload = session.tokens.idToken.payload;
        console.log('🔍 [DEBUG] ID Token payload:', payload);
        console.log('🔍 [DEBUG] Groups in token:', payload['cognito:groups']);
        console.log('🔍 [DEBUG] Token issuer:', payload.iss);
        console.log('🔍 [DEBUG] Token audience:', payload.aud);
        console.log('🔍 [DEBUG] User sub:', payload.sub);
      }

      if (session.credentials) {
        console.log('🔍 [DEBUG] AWS Credentials:');
        console.log('- Access Key ID:', session.credentials.accessKeyId?.substring(0, 10) + '...');
        console.log('- Session Token (first 50 chars):', session.credentials.sessionToken?.substring(0, 50) + '...');

        // Try to decode the session token to see what role it contains
        try {
          const tokenParts = session.credentials.sessionToken?.split('.');
          if (tokenParts && tokenParts.length > 1) {
            const payload = JSON.parse(atob(tokenParts[1]));
            console.log('🔍 [DEBUG] Session token payload:', payload);
            console.log('🔍 [DEBUG] Assumed role ARN:', payload.arn);
          }
        } catch (e) {
          console.log('🔍 [DEBUG] Could not decode session token:', e);
        }

        // Also try to make a test AWS call to see what role is actually being used
        try {
          const awsConfig = this.awsConfigService.getAWSConfig();
          if (awsConfig) {
            const testClient = new DynamoDBClient({
              region: awsConfig.region,
              credentials: session.credentials
            });

            // Try to get caller identity to see what role we're using
            console.log('🔍 [DEBUG] Testing AWS credentials with DynamoDB client...');

            // The error message will tell us exactly what role is being used
            const testCommand = new ScanCommand({
              TableName: this.tableName,
              Limit: 1
            });

            try {
              await testClient.send(testCommand);
              console.log('🔍 [DEBUG] DynamoDB test successful - user has correct role!');
            } catch (dynamoError: any) {
              console.log('🔍 [DEBUG] DynamoDB test failed (expected):', dynamoError.message);
              // The error message contains the actual role ARN being used
              if (dynamoError.message && dynamoError.message.includes('arn:aws:sts::')) {
                const roleMatch = dynamoError.message.match(/arn:aws:sts::[^:]+:assumed-role\/([^\/]+)/);
                if (roleMatch) {
                  console.log('🔍 [DEBUG] *** ACTUAL AWS ROLE BEING USED:', roleMatch[1], '***');
                }
              }
            }
          }
        } catch (e) {
          console.log('🔍 [DEBUG] Could not test AWS credentials:', e);
        }
      }

      // Also check what our app thinks the user role is
      const userInfo = await this.getCurrentUserInfo();
      console.log('🔍 [DEBUG] App detected user info:', userInfo);

    } catch (error) {
      console.error('🔍 [DEBUG] Error during debugging:', error);
    }
  }

  /**
   * Get current user's role and permissions info
   */
  async getCurrentUserInfo(): Promise<{ role: string; hasDBAccess: boolean; isAuthenticated: boolean } | null> {
    try {
      const session = await fetchAuthSession();
      if (!session.tokens?.idToken) {
        return { role: 'guest', hasDBAccess: false, isAuthenticated: false };
      }

      const payload = session.tokens.idToken.payload;
      const groups = (payload['cognito:groups'] as string[]) || [];
      const userRole = groups.length > 0 ? groups[0] : 'guest';
      const hasDBAccess = await this.hasUserDynamoDBAccess();

      return {
        role: userRole,
        hasDBAccess,
        isAuthenticated: true
      };
    } catch (error) {
      return { role: 'guest', hasDBAccess: false, isAuthenticated: false };
    }
  }

  // ========== USER MANAGEMENT METHODS ==========
  // These methods use the User Management API with proper authentication and role-based access control

  /**
   * Get all users (Admin/Owner only)
   * Uses User Management API with proper authentication
   */
  async getUsers(limit: number = 50, nextToken?: string): Promise<any> {
    try {
      console.log('🔄 [ModelService] Getting users via User Management API');
      return this.userApiService.getUsers(limit, nextToken).toPromise();
    } catch (error) {
      console.error('❌ [ModelService] Error getting users:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<any> {
    try {
      console.log(`🔄 [ModelService] Getting user ${userId} via User Management API`);
      return this.userApiService.getUser(userId).toPromise();
    } catch (error) {
      console.error('❌ [ModelService] Error getting user:', error);
      throw error;
    }
  }

  /**
   * Create new user (Admin/Owner only)
   */
  async createUser(userData: any): Promise<any> {
    try {
      console.log('🔄 [ModelService] Creating user via User Management API');
      return this.userApiService.createUser(userData).toPromise();
    } catch (error) {
      console.error('❌ [ModelService] Error creating user:', error);
      throw error;
    }
  }

  /**
   * Update user groups/roles (Admin/Owner only)
   */
  async updateUserGroups(userId: string, groups: string[]): Promise<any> {
    try {
      console.log(`🔄 [ModelService] Updating user ${userId} groups via User Management API`);
      return this.userApiService.updateUserGroups(userId, groups).toPromise();
    } catch (error) {
      console.error('❌ [ModelService] Error updating user groups:', error);
      throw error;
    }
  }

  /**
   * Enable/disable user (Admin/Owner only)
   */
  async updateUserStatus(userId: string, enabled: boolean): Promise<any> {
    try {
      console.log(`🔄 [ModelService] Updating user ${userId} status via User Management API`);
      return this.userApiService.updateUserStatus(userId, enabled).toPromise();
    } catch (error) {
      console.error('❌ [ModelService] Error updating user status:', error);
      throw error;
    }
  }

  /**
   * Get guest bookings
   */
  async getGuestBookings(guestId: string): Promise<any[]> {
    try {
      const bookings = await this.getBookingsByUser(guestId).toPromise();
      return bookings?.map(booking => ({
        id: booking.bookingId,
        propertyName: booking.propertyGroupId,
        unitName: booking.stay.assignedUnits[0]?.unitName || 'Unit',
        checkInDate: new Date(booking.stay.checkIn),
        checkOutDate: new Date(booking.stay.checkOut),
        totalAmount: booking.pricing.total,
        status: booking.status,
        rating: 0, // This would come from a review system
        review: ''
      })) || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get all bookings (for management panel)
   */
  getBookings(): Promise<BookingModel[]> {
    const params: QueryParams = {
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'BOOKING#'
      }
    };
    return this.scanItems(params).pipe(
      map(items => items.map(item => this.mapToBooking(item)))
    ).toPromise() as Promise<BookingModel[]>;
  }

  /**
   * Get all payments (for management panel)
   */
  getPayments(): Promise<any[]> {
    const params: QueryParams = {
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'PAYMENT#'
      }
    };
    return this.scanItems(params).pipe(
      map(items => items.map(item => ({
        id: item.PK.replace('PAYMENT#', ''),
        bookingId: item.bookingId,
        amount: item.amount,
        status: item.status,
        paymentMethod: item.paymentMethod,
        createdAt: new Date(item.createdAt)
      })))
    ).toPromise() as Promise<any[]>;
  }

  /**
   * Create unit
   */
  createUnit(unitData: any): Promise<any> {
    const unitId = this.generateId();
    const item = {
      PK: `PROPERTY_GROUP#${unitData.propertyGroupId}`,
      SK: `INDIVIDUAL_UNIT#${unitId}`,
      ...unitData,
      id: unitId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return this.putItem(item).toPromise();
  }

  /**
   * Update unit
   */
  updateUnit(unitId: string, updates: any): Promise<any> {
    return this.updateItem(`PROPERTY_GROUP#${updates.propertyGroupId || ''}`, `INDIVIDUAL_UNIT#${unitId}`, {
      ...updates,
      updatedAt: new Date().toISOString()
    }).toPromise();
  }

  /**
   * Delete unit
   */
  deleteUnit(unitId: string): Promise<any> {
    // This would need the propertyGroupId to construct the PK
    // For now, return a mock response
    return Promise.resolve({ success: true });
  }

  // User deletion methods have been moved to UserService

  /**
   * Delete property group
   */
  deletePropertyGroup(propertyId: string): Promise<any> {
    return this.deleteItem(`PROPERTY_GROUP#${propertyId}`, 'METADATA').toPromise();
  }

  // Guest update methods have been moved to UserService

  // ==================== HELPER METHODS ====================

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Scan items from DynamoDB
   */
  private scanItems(params: any): Observable<any[]> {
    return from(this.scanItemsAsync(params));
  }

  /**
   * Async scan items operation
   */
  private async scanItemsAsync(params: any): Promise<any[]> {
    await this.ensureClientInitialized();

    const scanParams: any = {
      TableName: this.tableName
    };

    // Add filter expression
    if (params.FilterExpression) {
      scanParams.FilterExpression = params.FilterExpression;
    }

    // Add expression attribute values
    if (params.ExpressionAttributeValues) {
      scanParams.ExpressionAttributeValues = params.ExpressionAttributeValues;
    }

    // Add expression attribute names
    if (params.ExpressionAttributeNames) {
      scanParams.ExpressionAttributeNames = params.ExpressionAttributeNames;
    }

    // Add other parameters
    if (params.Limit) scanParams.Limit = params.Limit;

    const command = new ScanCommand(scanParams);

    try {
      const result = await this.docClient.send(command);
      return result.Items || [];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Map DynamoDB item to PropertyGroup
   */
  private mapToPropertyGroup(item: any): PropertyGroup {
    return {
      PK: item.PK || `PROPERTY_GROUP#${item.groupId}`,
      SK: item.SK || 'METADATA',
      groupId: item.groupId || item.PK?.replace('PROPERTY_GROUP#', ''),
      name: item.name,
      description: item.description,
      type: item.type || 'apartment_complex',
      address: item.address || {
        street: '',
        city: '',
        state: '',
        country: '',
        zipCode: '',
        coordinates: { latitude: 0, longitude: 0 }
      },
      buildingInfo: item.buildingInfo || {
        floors: 1,
        totalUnits: 0
      },
      amenities: item.amenities || [],
      policies: item.policies || {
        checkIn: '15:00',
        checkOut: '11:00',
        cancellation: 'flexible',
        pets: false,
        smoking: false,
        parties: false
      },
      media: item.media || {
        images: [],
        videos: [],
        virtualTour: ''
      },
      rating: item.rating || 0,
      reviewCount: item.reviewCount || 0,
      priceRange: item.priceRange || {
        min: 0,
        max: 0,
        currency: 'EUR'
      },
      contact: item.contact || {
        email: '',
        phone: '',
        website: ''
      },
      smartLockConfig: item.smartLockConfig || {
        provider: 'none',
        apiKey: '',
        settings: {}
      },
      status: item.status || 'active',
      ownerId: item.ownerId || '',
      managementCompanyId: item.managementCompanyId,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
      GSI1PK: item.GSI1PK || `OWNER#${item.ownerId}`,
      GSI1SK: item.GSI1SK || `PROPERTY_GROUP#${item.groupId}`,
      GSI2PK: item.GSI2PK || `CITY#${item.address?.city}`,
      GSI2SK: item.GSI2SK || `PROPERTY_GROUP#${item.groupId}`
    };
  }

  /**
   * Map DynamoDB item to IndividualUnit
   */
  private mapToIndividualUnit(item: any): IndividualUnit {
    return {
      PK: item.PK || `UNIT_MODEL#${item.modelId || 'unknown'}`,
      SK: item.SK || `INDIVIDUAL_UNIT#${item.unitId}`,
      unitId: item.unitId || item.SK?.replace('INDIVIDUAL_UNIT#', ''),
      modelId: item.modelId || '',
      groupId: item.groupId || item.propertyGroupId || '',
      identity: {
        unitNumber: item.unitNumber || item.identity?.unitNumber || '',
        unitName: item.unitName || item.identity?.unitName || '',
        floor: item.floor || item.identity?.floor || 1,
        building: item.building || item.identity?.building
      },
      specifics: {
        exactView: item.specifics?.exactView,
        corner: item.specifics?.corner || false,
        balconySize: item.specifics?.balconySize,
        renovationDate: item.specifics?.renovationDate,
        condition: item.specifics?.condition || 'good'
      },
      smartLock: {
        lockId: item.smartLock?.lockId || 'lock_' + item.unitId,
        model: item.smartLock?.model || 'generic',
        batteryLevel: item.smartLock?.batteryLevel,
        lastSync: item.smartLock?.lastSync || new Date().toISOString(),
        accessCodes: {
          master: item.smartLock?.accessCodes?.master || '0000',
          guest: item.smartLock?.accessCodes?.guest || '1234',
          maintenance: item.smartLock?.accessCodes?.maintenance || '9999'
        }
      },
      status: {
        availability: item.status?.availability || item.status || 'available',
        currentBookingId: item.status?.currentBookingId,
        occupancy: item.status?.occupancy,
        maintenance: item.status?.maintenance
      },
      restrictions: {
        minimumStay: item.restrictions?.minimumStay || 1,
        maximumStay: item.restrictions?.maximumStay,
        blockedDates: item.restrictions?.blockedDates || []
      },
      media: item.media ? {
        images: item.media.images || []
      } : undefined,
      maintenanceHistory: {
        lastCleaned: item.maintenanceHistory?.lastCleaned || new Date().toISOString(),
        lastDeepCleaned: item.maintenanceHistory?.lastDeepCleaned || new Date().toISOString(),
        lastMaintenance: item.maintenanceHistory?.lastMaintenance || new Date().toISOString(),
        nextScheduledMaintenance: item.maintenanceHistory?.nextScheduledMaintenance,
        issues: item.maintenanceHistory?.issues || []
      },
      performance: {
        bookingHistory: item.performance?.bookingHistory || [],
        last30Days: {
          occupancyRate: item.performance?.last30Days?.occupancyRate || 0,
          averageRate: item.performance?.last30Days?.averageRate || 0,
          totalRevenue: item.performance?.last30Days?.totalRevenue || 0,
          bookingsCount: item.performance?.last30Days?.bookingsCount || 0
        }
      },
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
      GSI1PK: item.GSI1PK || `UNIT_MODEL#${item.modelId}`,
      GSI1SK: item.GSI1SK || `UNIT#${item.status?.availability || 'available'}#${item.identity?.unitNumber || item.unitId}`,
      GSI2PK: item.GSI2PK || `PROPERTY_GROUP#${item.groupId}`,
      GSI2SK: item.GSI2SK || `UNIT#${item.status?.availability || 'available'}#${item.unitId}`,
      GSI3PK: item.GSI3PK || `AVAILABILITY#${item.status?.availability || 'available'}`,
      GSI3SK: item.GSI3SK || `UNIT#${item.groupId}#${item.modelId}#${item.unitId}`
    };
  }

  /**
   * Map DynamoDB item to UnitModel
   */
  private mapToUnitModel(item: any): UnitModel {
    return {
      PK: item.PK || `PROPERTY_GROUP#${item.propertyGroupId}`,
      SK: item.SK || `UNIT_MODEL#${item.modelId}`,
      modelId: item.modelId || item.SK?.replace('UNIT_MODEL#', ''),
      groupId: item.groupId || item.propertyGroupId || '',
      name: item.name || '',
      description: item.description || '',
      configuration: {
        rooms: item.configuration?.rooms || 1,
        beds: item.configuration?.beds || 1,
        bathrooms: item.configuration?.bathrooms || 1,
        bedTypes: item.configuration?.bedTypes || [{
          type: 'double',
          count: 1,
          room: 'master'
        }]
      },
      capacity: {
        adults: item.capacity?.adults || 2,
        children: item.capacity?.children || 1,
        maxOccupancy: item.capacity?.maxOccupancy || 3
      },
      features: {
        view: item.features?.view || 'city',
        amenities: item.features?.amenities || [],
        appliances: item.features?.appliances || []
      },
      physical: {
        size: item.physical?.size || 50,
        sizeUnit: item.physical?.sizeUnit || 'sqm',
        floor: item.physical?.floor,
        orientation: item.physical?.orientation
      },
      pricing: {
        basePrice: item.pricing?.basePrice || item.basePrice || 0,
        currency: item.pricing?.currency || 'EUR',
        priceType: item.pricing?.priceType || 'per_night',
        currentPrice: item.pricing?.currentPrice || item.pricing?.basePrice || item.basePrice || 0,
        lastPriceUpdate: item.pricing?.lastPriceUpdate || new Date().toISOString(),
        priceCalendar: item.pricing?.priceCalendar || [],
        rules: {
          seasonal: item.pricing?.rules?.seasonal || [],
          weekend: {
            enabled: item.pricing?.rules?.weekend?.enabled || false,
            fridayMultiplier: item.pricing?.rules?.weekend?.fridayMultiplier || 1.0,
            saturdayMultiplier: item.pricing?.rules?.weekend?.saturdayMultiplier || 1.0,
            sundayMultiplier: item.pricing?.rules?.weekend?.sundayMultiplier || 1.0
          },
          lengthOfStay: item.pricing?.rules?.lengthOfStay || [],
          advanceBooking: item.pricing?.rules?.advanceBooking || []
        },
        optimization: item.pricing?.optimization
      },
      inventory: {
        totalUnits: item.inventory?.totalUnits || item.availability?.totalUnits || 0,
        availableUnits: item.inventory?.availableUnits || item.availability?.availableUnits || 0,
        occupiedUnits: item.inventory?.occupiedUnits || 0,
        maintenanceUnits: item.inventory?.maintenanceUnits || item.availability?.maintenanceUnits || 0,
        lastUpdated: item.inventory?.lastUpdated || new Date().toISOString()
      },
      media: {
        images: item.media?.images || [],
        floorPlan: item.media?.floorPlan
      },
      status: item.status || 'active',
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
      GSI1PK: item.GSI1PK || `PROPERTY_GROUP#${item.groupId}`,
      GSI1SK: item.GSI1SK || `MODEL#${item.configuration?.rooms || 1}R#${item.configuration?.beds || 1}B#${item.features?.view || 'city'}#${item.pricing?.basePrice || 0}`,
      GSI2PK: item.GSI2PK || `AVAILABILITY#available`,
      GSI2SK: item.GSI2SK || `MODEL#${item.groupId}#${item.inventory?.availableUnits || 0}`
    };
  }

  /**
   * Map DynamoDB item to User
   */
  private mapToUser(item: any): User {
    return {
      PK: item.PK || `USER#${item.userId}`,
      SK: item.SK || 'PROFILE',
      userId: item.userId || item.PK?.replace('USER#', ''),
      email: item.email || '',
      emailVerified: item.emailVerified || false,
      phone: item.phone,
      phoneVerified: item.phoneVerified || false,
      profile: {
        firstName: item.profile?.firstName || item.firstName || '',
        lastName: item.profile?.lastName || item.lastName || '',
        dateOfBirth: item.profile?.dateOfBirth || item.dateOfBirth,
        gender: item.profile?.gender,
        nationality: item.profile?.nationality || item.nationality,
        preferredLanguage: item.profile?.preferredLanguage || 'en',
        timezone: item.profile?.timezone || 'UTC',
        avatar: item.profile?.avatar
      },
      address: item.address,
      auth: {
        passwordHash: item.auth?.passwordHash,
        providers: item.auth?.providers || [],
        lastLogin: item.auth?.lastLogin || new Date().toISOString(),
        loginCount: item.auth?.loginCount || 0,
        twoFactorEnabled: item.auth?.twoFactorEnabled || false,
        securityQuestions: item.auth?.securityQuestions || []
      },
      preferences: {
        currency: item.preferences?.currency || 'EUR',
        notifications: {
          email: item.preferences?.notifications?.email ?? true,
          sms: item.preferences?.notifications?.sms ?? false,
          push: item.preferences?.notifications?.push ?? true,
          marketing: item.preferences?.notifications?.marketing ?? false,
          bookingReminders: item.preferences?.notifications?.bookingReminders ?? true,
          priceAlerts: item.preferences?.notifications?.priceAlerts ?? false
        },
        accessibility: {
          screenReader: item.preferences?.accessibility?.screenReader ?? false,
          highContrast: item.preferences?.accessibility?.highContrast ?? false,
          largeText: item.preferences?.accessibility?.largeText ?? false
        },
        privacy: {
          profileVisibility: item.preferences?.privacy?.profileVisibility || 'private',
          shareDataForMarketing: item.preferences?.privacy?.shareDataForMarketing ?? false,
          shareDataForAnalytics: item.preferences?.privacy?.shareDataForAnalytics ?? false
        }
      },
      travelProfile: {
        frequentDestinations: item.travelProfile?.frequentDestinations || [],
        preferredRoomType: item.travelProfile?.preferredRoomType || '',
        specialRequests: item.travelProfile?.specialRequests || [],
        dietaryRestrictions: item.travelProfile?.dietaryRestrictions || [],
        emergencyContact: {
          name: item.travelProfile?.emergencyContact?.name || '',
          phone: item.travelProfile?.emergencyContact?.phone || '',
          relationship: item.travelProfile?.emergencyContact?.relationship || ''
        },
        travelPurpose: item.travelProfile?.travelPurpose || 'leisure',
        budgetRange: {
          min: item.travelProfile?.budgetRange?.min || 0,
          max: item.travelProfile?.budgetRange?.max || 1000,
          currency: item.travelProfile?.budgetRange?.currency || 'EUR'
        }
      },
      loyalty: {
        points: item.loyalty?.points || 0,
        tier: item.loyalty?.tier || 'bronze',
        totalBookings: item.loyalty?.totalBookings || 0,
        totalSpent: item.loyalty?.totalSpent || 0,
        memberSince: item.loyalty?.memberSince || new Date().toISOString(),
        benefits: item.loyalty?.benefits || [],
        nextTierRequirement: item.loyalty?.nextTierRequirement
      },
      paymentMethods: item.paymentMethods || [],
      role: item.role || 'guest',
      status: (item.status === 'suspended' || item.status === 'deleted') ? item.status : 'active',
      verification: {
        identityVerified: item.verification?.identityVerified || false,
        phoneVerified: item.verification?.phoneVerified || item.phoneVerified || false,
        emailVerified: item.verification?.emailVerified || item.emailVerified || false,
        documents: item.verification?.documents || [],
        verificationLevel: item.verification?.verificationLevel || 'basic'
      },

      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
      lastActiveAt: item.lastActiveAt || new Date().toISOString(),
      GSI1PK: item.GSI1PK || `EMAIL#${item.email}`,
      GSI1SK: item.GSI1SK || 'USER',
      GSI2PK: item.GSI2PK || `PHONE#${item.phone || 'none'}`,
      GSI2SK: item.GSI2SK || 'USER',
      GSI3PK: item.GSI3PK || `ROLE#${item.role || 'guest'}`,
      GSI3SK: item.GSI3SK || `USER#${item.createdAt || new Date().toISOString()}`
    };
  }

  /**
   * Map DynamoDB item to BookingModel
   */
  private mapToBooking(item: any): BookingModel {
    return {
      PK: item.PK || `BOOKING#${item.bookingId}`,
      SK: item.SK || 'METADATA',
      bookingId: item.bookingId || item.PK?.replace('BOOKING#', ''),
      userId: item.userId,
      propertyGroupId: item.propertyGroupId,
      stay: {
        checkIn: item.checkInDate || item.stay?.checkIn,
        checkOut: item.checkOutDate || item.stay?.checkOut,
        nights: item.nights || item.stay?.nights || 1,
        selectedModels: item.stay?.selectedModels || [],
        assignedUnits: item.stay?.assignedUnits || []
      },
      primaryGuest: {
        firstName: item.guestName?.split(' ')[0] || item.primaryGuest?.firstName || '',
        lastName: item.guestName?.split(' ')[1] || item.primaryGuest?.lastName || '',
        email: item.primaryGuest?.email || '',
        phone: item.primaryGuest?.phone || ''
      },
      pricing: {
        unitTotal: item.totalAmount || 0,
        taxes: 0,
        fees: 0,
        discounts: 0,
        total: item.totalAmount || 0,
        currency: 'EUR',
        breakdown: [],
        nightlyRates: []
      },
      status: item.status || 'pending',
      paymentStatus: item.paymentStatus || 'pending',
      source: {
        channel: 'direct' as const,
        referrer: '',
        campaign: '',
        affiliate: '',
        device: 'web' as const
      },
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
      GSI1PK: item.GSI1PK || `USER#${item.userId}`,
      GSI1SK: item.GSI1SK || `BOOKING#${item.bookingId}`,
      GSI2PK: item.GSI2PK || `PROPERTY_GROUP#${item.propertyGroupId}`,
      GSI2SK: item.GSI2SK || `BOOKING#${item.bookingId}`,
      GSI3PK: item.GSI3PK || `STATUS#${item.status}`,
      GSI3SK: item.GSI3SK || `BOOKING#${item.bookingId}`,
      GSI4PK: item.GSI4PK || `CHECK_IN_DATE#${item.checkInDate}`,
      GSI4SK: item.GSI4SK || `BOOKING#${item.propertyGroupId}`
    };
  }
}
