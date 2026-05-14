import { Injectable } from '@angular/core';
import { Observable, from, throwError, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { fetchAuthSession } from 'aws-amplify/auth';
import { environment } from '../../environments/environment';

// AWS SDK v3 imports for Cognito operations
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  ListUsersCommandOutput,
  UserType,
  AttributeType
} from '@aws-sdk/client-cognito-identity-provider';

export interface User {
  userId: string;
  email: string;
  emailVerified: boolean;
  phone?: string;
  phoneVerified: boolean;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'owner' | 'admin' | 'support' | 'guest';
  status: 'CONFIRMED' | 'UNCONFIRMED' | 'ARCHIVED' | 'COMPROMISED' | 'UNKNOWN' | 'RESET_REQUIRED' | 'FORCE_CHANGE_PASSWORD' | 'EXTERNAL_PROVIDER';
  enabled: boolean;
  createdAt: Date;
  lastModified: Date;
  lastLogin?: Date;
  mfaEnabled?: boolean;
  attributes?: { [key: string]: string };
  dateOfBirth?: string; // Fixed: was dataOfBirth
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  nationality?: string;
  preferredLanguage?: string;
  currency?: string;
  timezone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
  };
  auth?: {
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
  preferences?: {
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
}

export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string;
  temporaryPassword?: string;
  sendWelcomeEmail?: boolean;
}

export interface UpdateUserRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  phone?: string;

}

export interface UserListResponse {
  users: User[];
  nextToken?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private cognitoClient: CognitoIdentityProviderClient | null = null;
  private readonly userPoolId = environment.cognito.userPoolId;
  private readonly region = environment.cognito.region;

  constructor() {}

  /**
   * Initialize Cognito client with current session credentials
   */
  private async initializeCognitoClient(): Promise<CognitoIdentityProviderClient> {
    if (this.cognitoClient) {
      return this.cognitoClient;
    }

    try {
      const session = await fetchAuthSession();

      if (!session.credentials) {
        throw new Error('No valid AWS credentials available');
      }

      this.cognitoClient = new CognitoIdentityProviderClient({
        region: this.region,
        credentials: {
          accessKeyId: session.credentials.accessKeyId!,
          secretAccessKey: session.credentials.secretAccessKey!,
          sessionToken: session.credentials.sessionToken
        }
      });

      return this.cognitoClient;
    } catch (error) {
      console.error('Failed to initialize Cognito client:', error);
      throw error;
    }
  }

  /**
   * List all users from Cognito User Pool
   */
  listUsers(limit: number = 60, paginationToken?: string): Observable<UserListResponse> {
    return from(this.initializeCognitoClient()).pipe(
      switchMap(async (client) => {
        const command = new ListUsersCommand({
          UserPoolId: this.userPoolId,
          Limit: limit,
          PaginationToken: paginationToken
        });

        const response: ListUsersCommandOutput = await client.send(command);

        const users: User[] = (response.Users || []).map(user => this.mapCognitoUserToInterface(user));

        return {
          users,
          nextToken: response.PaginationToken
        };
      }),
      catchError(error => {
        console.error('Error listing Cognito users:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get a specific user by email
   */
  getUserByEmail(email: string): Observable<User | null> {
    return from(this.initializeCognitoClient()).pipe(
      switchMap(async (client) => {
        const command = new AdminGetUserCommand({
          UserPoolId: this.userPoolId,
          Username: email
        });
        try {
          const response = await client.send(command);
          return this.mapCognitoUserResponseToInterface(response);
        } catch (error: any) {
          if (error.name === 'UserNotFoundException') {
            return null;
          }
          throw error;
        }
      }),
      catchError(error => {
        console.error('Error getting Cognito user:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get users by role
   */
  getUsersByRole(role: string): Observable<User[]> {
    return this.listUsers(100).pipe(
      map(response => response.users.filter(user => user.role === role))
    );
  }

  /**
   * Get guest users (users with role 'guest' or 'user')
   */
  getGuests(): Observable<User[]> {
    return this.listUsers(100).pipe(
      map(response => response.users.filter(user => user.role === 'guest'))
    );
  }

  /**
   * Create a new user in Cognito User Pool
   */
  createUser(userData: CreateUserRequest): Observable<string> {
    return from(this.initializeCognitoClient()).pipe(
      switchMap(async (client) => {
        const userAttributes: AttributeType[] = [
          { Name: 'email', Value: userData.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'given_name', Value: userData.firstName },
          { Name: 'family_name', Value: userData.lastName },
          { Name: 'custom:role', Value: userData.role }
        ];

        if (userData.phone) {
          userAttributes.push({ Name: 'phone_number', Value: userData.phone });
        }

        const command = new AdminCreateUserCommand({
          UserPoolId: this.userPoolId,
          Username: userData.email,
          UserAttributes: userAttributes,
          TemporaryPassword: userData.temporaryPassword || this.generateTemporaryPassword(),
          MessageAction: userData.sendWelcomeEmail ? "RESEND" : "SUPPRESS",
          DesiredDeliveryMediums: ['EMAIL']
        });

        const response = await client.send(command);
        return response.User?.Username || userData.email;
      }),
      catchError(error => {
        console.error('Error creating Cognito user:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update user attributes in Cognito User Pool
   */
  updateUser(email: string, updates: UpdateUserRequest): Observable<void> {
    return from(this.initializeCognitoClient()).pipe(
      switchMap(async (client) => {
        const userAttributes: AttributeType[] = [];

        if (updates.email) {
          userAttributes.push({ Name: 'email', Value: updates.email });
        }
        if (updates.firstName) {
          userAttributes.push({ Name: 'given_name', Value: updates.firstName });
        }
        if (updates.lastName) {
          userAttributes.push({ Name: 'family_name', Value: updates.lastName });
        }
        if (updates.role) {
          userAttributes.push({ Name: 'custom:role', Value: updates.role });
        }
        if (updates.phone) {
          userAttributes.push({ Name: 'phone_number', Value: updates.phone });
        }

        if (userAttributes.length === 0) {
          return;
        }

        const command = new AdminUpdateUserAttributesCommand({
          UserPoolId: this.userPoolId,
          Username: email,
          UserAttributes: userAttributes
        });

        await client.send(command);
      }),
      catchError(error => {
        console.error('Error updating Cognito user:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update user role specifically
   */
  updateUserRole(email: string, newRole: string): Observable<void> {
    return this.updateUser(email, { role: newRole });
  }

  /**
   * Delete user from Cognito User Pool
   */
  deleteUser(email: string): Observable<void> {
    return from(this.initializeCognitoClient()).pipe(
      switchMap(async (client) => {
        const command = new AdminDeleteUserCommand({
          UserPoolId: this.userPoolId,
          Username: email
        });

        await client.send(command);
      }),
      catchError(error => {
        console.error('Error deleting Cognito user:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Enable/Disable user in Cognito User Pool
   */
  setUserEnabled(email: string, enabled: boolean): Observable<void> {
    return from(this.initializeCognitoClient()).pipe(
      switchMap(async (client) => {
        const command = enabled
          ? new AdminEnableUserCommand({
              UserPoolId: this.userPoolId,
              Username: email
            })
          : new AdminDisableUserCommand({
              UserPoolId: this.userPoolId,
              Username: email
            });

        await client.send(command);
      }),
      catchError(error => {
        console.error('Error updating user enabled status:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Set user password (for admin operations)
   */
  setUserPassword(email: string, password: string, permanent: boolean = true): Observable<void> {
    return from(this.initializeCognitoClient()).pipe(
      switchMap(async (client) => {
        const command = new AdminSetUserPasswordCommand({
          UserPoolId: this.userPoolId,
          Username: email,
          Password: password,
          Permanent: permanent
        });

        await client.send(command);
      }),
      catchError(error => {
        console.error('Error setting user password:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Generate a temporary password
   */
  private generateTemporaryPassword(): string {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    // Ensure at least one of each required character type
    password += 'A'; // uppercase
    password += 'a'; // lowercase
    password += '1'; // number
    password += '!'; // symbol

    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Map Cognito UserType to our User interface
   */
  private mapCognitoUserToInterface(user: UserType): User {
    const attributes = user.Attributes || [];
    const getAttributeValue = (name: string): string => {
      const attr = attributes.find(a => a.Name === name);
      return attr?.Value || '';
    };

    return {
      userId: user.Username || '',
      email: getAttributeValue('email'),
      emailVerified: getAttributeValue('email_verified') === 'true',
      phone: getAttributeValue('phone_number') || undefined,
      phoneVerified: getAttributeValue('phone_number_verified') === 'true',
      firstName: getAttributeValue('given_name') || 'User',
      lastName: getAttributeValue('family_name') || '',
      role: (getAttributeValue('custom:role') as any) || 'guest',
      status: user.UserStatus || 'UNKNOWN',
      enabled: user.Enabled || false,
      createdAt: user.UserCreateDate || new Date(),
      lastModified: user.UserLastModifiedDate || new Date(),
      mfaEnabled: (user.MFAOptions?.length || 0) > 0,
      currency: getAttributeValue('custom:currency') || 'EUR',
      attributes: this.parseUserAttributes(attributes)
    };
  }

  /**
   * Map AdminGetUser response to our User interface
   */
  private mapCognitoUserResponseToInterface(response: any): User {
    const attributes = response.UserAttributes || [];
    const getAttributeValue = (name: string): string => {
      const attr = attributes.find((a: any) => a.Name === name);
      return attr?.Value || '';
    };

    return {
      userId: response.Username || '',
      email: getAttributeValue('email'),
      emailVerified: getAttributeValue('email_verified') === 'true',
      phone: getAttributeValue('phone_number') || undefined,
      phoneVerified: getAttributeValue('phone_number_verified') === 'true',
      firstName: getAttributeValue('given_name') || 'User',
      lastName: getAttributeValue('family_name') || '',
      role: (getAttributeValue('custom:role') as any) || 'guest',
      status: response.UserStatus || 'UNKNOWN',
      enabled: response.Enabled || false,
      createdAt: response.UserCreateDate || new Date(),
      lastModified: response.UserLastModifiedDate || new Date(),
      mfaEnabled: false, // Would need to check MFA status separately
      currency: getAttributeValue('custom:currency') || 'EUR',
      attributes: this.parseUserAttributes(attributes)
    };
  }

  /**
   * Parse user attributes array into key-value object
   */
  private parseUserAttributes(attributes: AttributeType[]): { [key: string]: string } {
    const parsed: { [key: string]: string } = {};
    attributes.forEach(attr => {
      if (attr.Name && attr.Value) {
        parsed[attr.Name] = attr.Value;
      }
    });
    return parsed;
  }
}
