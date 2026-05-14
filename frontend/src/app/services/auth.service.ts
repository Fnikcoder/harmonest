import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, throwError, of } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ModelService } from './model.service';
import { ConfigService } from './config.service';
import { Amplify } from 'aws-amplify';
import {
  signUp,
  confirmSignUp,
  signIn,
  signOut,
  getCurrentUser,
  fetchAuthSession,
  fetchUserAttributes,
  resendSignUpCode,
  resetPassword,
  confirmResetPassword,
  updatePassword,
  deleteUser,
  updateUserAttributes,
  confirmUserAttribute,
  setUpTOTP,
  verifyTOTPSetup
} from 'aws-amplify/auth';
import { User } from '../interfaces/user.interface';

export interface AuthUser {
  userId: string;
  email: string;
  emailVerified: boolean;
  phone?: string;
  phoneVerified: boolean;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'owner' | 'admin' | 'support' | 'user' | 'guest';
  customUserId?: string;
  mfaEnabled: boolean;
  deviceTrusted: boolean;
  profileImage?: string; // URL to user's profile image
}

export interface SignUpData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface SignInData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface MfaSetupResult {
  secretCode: string;
  qrCodeUrl: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authStateSubject = new BehaviorSubject<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true,
    error: null
  });

  public authState$ = this.authStateSubject.asObservable();

  constructor(
    private router: Router,
    private modelService: ModelService,
    private configService: ConfigService
  ) {
    this.initializeAuth();
  }

  private async initializeAuth() {
    try {
      // Wait for config to be loaded
      const config = this.configService.getConfig();
      if (!config) {
        // Subscribe to config changes and initialize when ready
        this.configService.getConfigObservable().subscribe(loadedConfig => {
          if (loadedConfig) {
            this.configureAmplify(loadedConfig);
          }
        });
        return;
      }

      this.configureAmplify(config);
    } catch (error) {
      this.updateAuthState({
        isAuthenticated: false,
        user: null,
        loading: false,
        error: 'Authentication initialization failed'
      });
    }
  }

  private async configureAmplify(config: any) {
    try {
      const cognitoConfig = config.technical?.aws?.cognito;
      if (!cognitoConfig) {
        throw new Error('Cognito configuration not found in master config');
      }

      // Configure Amplify with Cognito settings from centralized config
      const amplifyConfig: any = {
        Auth: {
          Cognito: {
            userPoolId: cognitoConfig.userPoolId,
            userPoolClientId: cognitoConfig.userPoolWebClientId,
            identityPoolId: cognitoConfig.identityPoolId,
            loginWith: {
              email: true,
              phone: true
            }
          }
        }
      };

      // Identity Pool now included for direct AWS service access

      // Add OAuth configuration if available
      if (cognitoConfig.oauth) {
        amplifyConfig.Auth.Cognito.loginWith.oauth = {
          domain: cognitoConfig.oauth.domain,
          scopes: cognitoConfig.oauth.scope,
          redirectSignIn: [cognitoConfig.oauth.redirectSignIn],
          redirectSignOut: [cognitoConfig.oauth.redirectSignOut],
          responseType: cognitoConfig.oauth.responseType as 'code'
        };
      }

      Amplify.configure(amplifyConfig);

      // Check if user is already authenticated
      await this.checkAuthState();
    } catch (error) {
      this.updateAuthState({
        isAuthenticated: false,
        user: null,
        loading: false,
        error: 'Authentication configuration failed'
      });
    }
  }

  private async checkAuthState() {
    try {
      this.updateAuthState({ ...this.authStateSubject.value, loading: true });

      const user = await getCurrentUser();
      const session = await fetchAuthSession();

      if (user && session.tokens) {
        const authUser = await this.buildAuthUser(user, session);
        this.updateAuthState({
          isAuthenticated: true,
          user: authUser,
          loading: false,
          error: null
        });
      } else {
        this.updateAuthState({
          isAuthenticated: false,
          user: null,
          loading: false,
          error: null
        });
      }
    } catch (error) {
      this.updateAuthState({
        isAuthenticated: false,
        user: null,
        loading: false,
        error: null
      });
    }
  }

  private async buildAuthUser(cognitoUser: any, session: any): Promise<AuthUser> {
    // Fetch user attributes separately in Amplify v6
    let attributes: any = {};

    try {
      attributes = await fetchUserAttributes();
    } catch (error) {
      // Fallback to cognitoUser.attributes if available
      attributes = cognitoUser.attributes || {};
    }

    const authUser = {
      userId: cognitoUser.userId || cognitoUser.username,
      email: attributes.email || '',
      emailVerified: attributes.email_verified === 'true',
      phone: attributes.phone_number,
      phoneVerified: attributes.phone_number_verified === 'true',
      firstName: attributes.given_name || '',
      lastName: attributes.family_name || '',
      role: (attributes['custom:role'] as any) || 'user',
      customUserId: attributes['custom:user_id'],
      mfaEnabled: cognitoUser.preferredMFA !== 'NOMFA',
      deviceTrusted: false, // Will be updated based on device status
      profileImage: attributes.picture // Profile image URL from Cognito or social providers
    };

    return authUser;
  }

  private updateAuthState(newState: Partial<AuthState>) {
    const currentState = this.authStateSubject.value;
    this.authStateSubject.next({ ...currentState, ...newState });
  }

  // Method to refresh user data from Cognito (useful after role updates)
  async refreshUserData(): Promise<void> {
    try {
      this.updateAuthState({ ...this.authStateSubject.value, loading: true });

      // Force fresh fetch from Cognito
      const user = await getCurrentUser();
      const session = await fetchAuthSession({ forceRefresh: true });

      if (user && session.tokens) {
        const authUser = await this.buildAuthUser(user, session);
        this.updateAuthState({
          isAuthenticated: true,
          user: authUser,
          loading: false,
          error: null
        });
      } else {
        this.updateAuthState({
          isAuthenticated: false,
          user: null,
          loading: false,
          error: null
        });
      }
    } catch (error) {
      this.updateAuthState({
        ...this.authStateSubject.value,
        loading: false,
        error: 'Failed to refresh user data'
      });
      throw error; // Re-throw for interceptor to handle
    }
  }

  // Method to refresh authentication token
  async refreshAuthToken(): Promise<string | null> {
    try {
      const session = await fetchAuthSession({ forceRefresh: true });

      if (session.tokens?.accessToken) {
        // Update user data as well
        await this.refreshUserData();
        return session.tokens.accessToken.toString();
      }

      return null;
    } catch (error) {
      throw error;
    }
  }

  // Sign Up
  signUp(signUpData: SignUpData): Observable<{ userId: string; codeDeliveryDetails: any }> {
    return from(signUp({
      username: signUpData.email,
      password: signUpData.password,
      options: {
        userAttributes: {
          email: signUpData.email,
          given_name: signUpData.firstName || 'User',
          family_name: signUpData.lastName || 'Account',
          ...(signUpData.phone && { phone_number: signUpData.phone }),
          'custom:role': 'guest', // Default role for regular signup
          'custom:inDynamoDB': 'false' // Default status for regular signup
        }
      }
    })).pipe(
      switchMap(result => {
        // Only create user in Cognito during signup
        // User will be created in DynamoDB after email verification
        const userId = result.userId || `user_${Date.now()}`;

        return of({
          userId: userId,
          codeDeliveryDetails: result.nextStep
        });
      }),
      catchError(error => {
        this.updateAuthState({ ...this.authStateSubject.value, error: error.message });
        return throwError(() => error);
      })
    );
  }





  /**
   * Determine user role based on email
   */
  private determineUserRole(email: string): string {
    // Define admin emails - you can modify this list
    const adminEmails = [
      'admin@harmonest.com',
      'superadmin@harmonest.com',
      'farhad@harmonest.com',
      // Add your email here to get superadmin access
    ];

    // Check if email is in admin list
    if (adminEmails.includes(email.toLowerCase())) {
      return 'super_admin';
    }

    // Default role for regular users
    return 'guest';
  }

  // ========== DYNAMODB USER ROLE MANAGEMENT - COMMENTED OUT ==========
  // The following method was used to upgrade users to superadmin role in DynamoDB.
  // Since we're now using only AWS Cognito for user management, this DynamoDB role management is disabled.
  // Role management should now be done directly in AWS Cognito User Pool or through Cognito APIs.

  /**
   * Upgrade user to superadmin role (for development/testing) - DISABLED
   * This method is commented out because we no longer use DynamoDB for user storage.
   * To upgrade a user role, update the custom:role attribute in AWS Cognito User Pool directly.
   */
  // upgradeToSuperAdmin(email: string): Observable<any> {
  //   console.log('Upgrading user to superadmin:', email);

  //   return this.modelService.getUserByEmail(email).pipe(
  //     switchMap(user => {
  //       if (!user) {
  //         throw new Error('User not found');
  //       }

  //       // Update user role in DynamoDB
  //       return this.modelService.updateUser(user.userId, {
  //         role: 'super_admin',
  //         'GSI3PK': 'ROLE#super_admin',
  //         updatedAt: new Date().toISOString()
  //       }).pipe(
  //         switchMap(() => {
  //           // Also try to update Cognito custom attribute if user is authenticated
  //           return from(updateUserAttributes({
  //             userAttributes: {
  //               'custom:role': 'super_admin'
  //             }
  //           })).pipe(
  //             catchError(cognitoError => {
  //               console.warn('Could not update Cognito role (user may not be authenticated):', cognitoError);
  //               // Don't fail the operation if Cognito update fails
  //               return of({ success: true, cognitoError: cognitoError.message });
  //             })
  //           );
  //         })
  //       );
  //     }),
  //     catchError(error => {
  //       console.error('Failed to upgrade user to superadmin:', error);
  //       return throwError(() => error);
  //     })
  //   );
  // }

  // Confirm Sign Up
  confirmSignUp(email: string, confirmationCode: string): Observable<boolean> {
    return from(confirmSignUp({
      username: email,
      confirmationCode
    })).pipe(
      switchMap(() => {
        return of(true);

        // ========== DYNAMODB USER SYNC - COMMENTED OUT ==========
        // The following code was used to create user records in DynamoDB after email verification.
        // Since we're now using only AWS Cognito for user management, this DynamoDB sync is disabled.
        // This code created comprehensive user profiles with preferences, travel profiles, loyalty data, etc.
        // If you need to re-enable DynamoDB user storage in the future, uncomment the code below:

        // console.log('Email verified in Cognito, creating user in DynamoDB...');
        // After successful Cognito confirmation, create user in DynamoDB with verified status
        // return this.createVerifiedUserInDynamoDB(email).pipe(
        //   map(() => true),
        //   catchError(dbError => {
        //     console.error('Failed to create verified user in DynamoDB:', dbError);
        //     // Still return success since Cognito confirmation was successful
        //     return of(true);
        //   })
        // );
      }),
      catchError(error => {
        this.updateAuthState({ ...this.authStateSubject.value, error: error.message });
        return throwError(() => error);
      })
    );
  }



  // Resend Confirmation Code
  resendConfirmationCode(email: string): Observable<any> {
    return from(resendSignUpCode({ username: email })).pipe(
      catchError(error => {
        this.updateAuthState({ ...this.authStateSubject.value, error: error.message });
        return throwError(() => error);
      })
    );
  }

  // Sign In
  signIn(signInData: SignInData): Observable<AuthUser> {
    this.updateAuthState({ ...this.authStateSubject.value, loading: true, error: null });

    return from(signIn({
      username: signInData.email,
      password: signInData.password
    })).pipe(
      switchMap(async (result) => {
        if (result.isSignedIn) {
          const user = await getCurrentUser();
          const session = await fetchAuthSession();
          const authUser = await this.buildAuthUser(user, session);

          // ========== DYNAMODB USER SYNC - COMMENTED OUT ==========
          // The following code was used to sync user data with DynamoDB after successful sign-in.
          // Since we're now using only AWS Cognito for user management, this DynamoDB sync is disabled.
          // await this.syncUserWithDatabase(authUser);

          this.updateAuthState({
            isAuthenticated: true,
            user: authUser,
            loading: false,
            error: null
          });

          return authUser;
        } else {
          // Handle different sign-in challenges
          if (result.nextStep) {
            const signInStep = result.nextStep.signInStep;

            if (signInStep === 'CONFIRM_SIGN_UP') {
              // Redirect to email verification page
              throw new Error('EMAIL_VERIFICATION_REQUIRED');
            } else if (signInStep === 'RESET_PASSWORD') {
              throw new Error('Password reset required. Please reset your password.');
            } else if (signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
              throw new Error('New password required. Please set a new password.');
            } else if (signInStep === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') {
              throw new Error('TOTP code required for two-factor authentication.');
            } else if (signInStep === 'CONFIRM_SIGN_IN_WITH_SMS_CODE') {
              throw new Error('SMS verification code required.');
            } else if (signInStep === 'CONFIRM_SIGN_IN_WITH_EMAIL_CODE') {
              throw new Error('Email verification code required.');
            } else {
              throw new Error(`Sign in requires additional steps: ${signInStep}`);
            }
          } else {
            throw new Error('Sign in failed. Please check your credentials.');
          }
        }
      }),
      catchError(error => {
        this.updateAuthState({
          ...this.authStateSubject.value,
          loading: false,
          error: error.message
        });
        return throwError(() => error);
      })
    );
  }

  // Sign Out
  signOut(): Observable<void> {
    return from(signOut()).pipe(
      tap(() => {
        this.updateAuthState({
          isAuthenticated: false,
          user: null,
          loading: false,
          error: null
        });
        this.router.navigate(['/']);
      }),
      catchError(error => {
        // Force local sign out even if remote fails
        this.updateAuthState({
          isAuthenticated: false,
          user: null,
          loading: false,
          error: null
        });
        this.router.navigate(['/']);
        return of(undefined);
      })
    );
  }

  // Reset Password
  resetPassword(email: string): Observable<any> {
    return from(resetPassword({ username: email })).pipe(
      catchError(error => {
        this.updateAuthState({ ...this.authStateSubject.value, error: error.message });
        return throwError(() => error);
      })
    );
  }

  // Confirm Reset Password
  confirmResetPassword(email: string, confirmationCode: string, newPassword: string): Observable<void> {
    return from(confirmResetPassword({
      username: email,
      confirmationCode,
      newPassword
    })).pipe(
      catchError(error => {
        this.updateAuthState({ ...this.authStateSubject.value, error: error.message });
        return throwError(() => error);
      })
    );
  }

  // Change Password (for authenticated users)
  changePassword(oldPassword: string, newPassword: string): Observable<void> {
    return from(updatePassword({
      oldPassword,
      newPassword
    })).pipe(
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  // ========== DYNAMODB USER DATA SYNC - COMMENTED OUT ==========
  // The following method was used to sync user data between Cognito and DynamoDB.
  // Since we're now using only AWS Cognito for user management, this sync functionality is disabled.
  // User data updates should now be done directly through AWS Cognito APIs using updateUserAttributes.

  /**
   * Sync user data between Cognito and DynamoDB - DISABLED
   * This method is commented out because we no longer use DynamoDB for user storage.
   * User data should now be managed entirely through AWS Cognito User Pool.
   */
  // syncUserData(userId: string, userData: Partial<User>): Observable<User> {
  //   console.log('syncUserData called with:', { userId, userData });

  //   return from(getCurrentUser()).pipe(
  //     switchMap(cognitoUser => {
  //       const updatePromises: Promise<any>[] = [];

  //       // 1. Update DynamoDB first
  //       console.log('Updating DynamoDB with userData:', userData);
  //       const dynamoUpdate = this.modelService.updateUser(userId, userData).toPromise();
  //       updatePromises.push(dynamoUpdate);

  //       // 2. Update Cognito attributes if profile data is being updated
  //       if (userData.profile || userData.email || userData.phone) {
  //         const cognitoAttributes: Record<string, string> = {};

  //         if (userData.profile?.firstName) {
  //           cognitoAttributes['given_name'] = userData.profile.firstName;
  //         }
  //         if (userData.profile?.lastName) {
  //           cognitoAttributes['family_name'] = userData.profile.lastName;
  //         }
  //         if (userData.email) {
  //           cognitoAttributes['email'] = userData.email;
  //         }
  //         if (userData.phone) {
  //           cognitoAttributes['phone_number'] = userData.phone;
  //         }
  //         if (userData.role) {
  //           cognitoAttributes['custom:role'] = userData.role;
  //         }

  //         if (Object.keys(cognitoAttributes).length > 0) {
  //           const cognitoUpdate = updateUserAttributes({
  //             userAttributes: cognitoAttributes
  //           });
  //           updatePromises.push(cognitoUpdate);
  //         }
  //       }

  //       // 3. Execute all updates
  //       return from(Promise.all(updatePromises));
  //     }),
  //     switchMap(() => {
  //       // Return the updated user from DynamoDB
  //       return this.modelService.getUserByEmail(userData.email || this.getCurrentUser()?.email || '');
  //     }),
  //     map(user => {
  //       if (!user) {
  //         throw new Error('User not found after update');
  //       }
  //       return user;
  //     }),
  //     catchError(error => {
  //       console.error('Error syncing user data:', error);
  //       return throwError(() => error);
  //     })
  //   );
  // }

  // ========== DYNAMODB USER ROLE UPDATE - COMMENTED OUT ==========
  // The following method was used to update user roles in both Cognito and DynamoDB.
  // Since we're now using only AWS Cognito for user management, this role update is disabled.
  // User roles should now be updated directly in AWS Cognito User Pool using the custom:role attribute.

  /**
   * Update user role in both Cognito and DynamoDB - DISABLED
   * This method is commented out because we no longer use DynamoDB for user storage.
   * To update user roles, use AWS Cognito APIs to update the custom:role attribute directly.
   */
  // updateUserRole(email: string, newRole: string): Observable<void> {
  //   return this.modelService.getUserByEmail(email).pipe(
  //     switchMap(user => {
  //       if (!user) {
  //         throw new Error('User not found');
  //       }

  //       // Update both systems
  //       return this.syncUserData(user.userId, { role: newRole as any });
  //     }),
  //     map(() => void 0),
  //     catchError(error => {
  //       console.error('Error updating user role:', error);
  //       return throwError(() => error);
  //     })
  //   );
  // }

  // Utility methods
  getCurrentUser(): AuthUser | null {
    return this.authStateSubject.value.user;
  }

  isAuthenticated(): boolean {
    return this.authStateSubject.value.isAuthenticated;
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user?.role === role;
  }

  hasAnyRole(roles: string[]): boolean {
    const user = this.getCurrentUser();
    return user ? roles.includes(user.role) : false;
  }

  isOwnerOrAdmin(): boolean {
    return this.hasAnyRole(['super_admin', 'owner', 'admin']);
  }

  canManageUsers(): boolean {
    return this.hasAnyRole(['super_admin', 'owner']);
  }

  canAccessBookings(): boolean {
    return this.hasAnyRole(['super_admin', 'owner', 'admin', 'support']);
  }


// ==================== DYNAMODB USER OPERATIONS - COMMENTED OUT ====================
// ==================== ALL CODE BELOW IS DISABLED FOR COGNITO-ONLY APPROACH ====================
//
// The following section contains all DynamoDB user management code that was used to:
// 1. Create user records in DynamoDB after Cognito authentication
// 2. Sync user data between Cognito and DynamoDB
// 3. Manage comprehensive user profiles with preferences, travel data, loyalty points, etc.
// 4. Handle user verification and role management in DynamoDB
//
// Since we're now using AWS Cognito exclusively for user management, all this code is commented out.
// If you need to re-enable DynamoDB user storage in the future, uncomment the relevant sections below.
//
// Key methods that are disabled:
// - syncUserWithDatabase()
// - createUserInDynamoDB()
// - ensureUserInDynamoDB()
// - createUserFromCognitoData()
// - createVerifiedUserInDynamoDB()
//
// ----------------------------------------------------------------------------------------------------------

  // private async syncUserWithDatabase(authUser: AuthUser): Promise<void> {
  //   try {
  //     // Check if user exists in DynamoDB
  //     const existingUser = await this.modelService.getUserByEmail(authUser.email).toPromise();

  //     if (!existingUser) {
  //       // Create new user in DynamoDB
  //       const newUser: User = {
  //         PK: `USER#${authUser.userId}`,
  //         SK: 'PROFILE',
  //         userId: authUser.userId,
  //         email: authUser.email,
  //         emailVerified: authUser.emailVerified,
  //         phone: authUser.phone,
  //         phoneVerified: authUser.phoneVerified,
  //         profile: {
  //           firstName: authUser.firstName,
  //           lastName: authUser.lastName,
  //           preferredLanguage: 'en',
  //           timezone: 'UTC'
  //         },
  //         address: {
  //           street: '',
  //           city: '',
  //           state: '',
  //           country: '',
  //           zipCode: ''
  //         },
  //         auth: {
  //           providers: [{
  //             type: 'email',
  //             providerId: authUser.email,
  //             connectedAt: new Date().toISOString()
  //           }],
  //           lastLogin: new Date().toISOString(),
  //           loginCount: 1,
  //           twoFactorEnabled: authUser.mfaEnabled
  //         },
  //         preferences: {
  //           currency: 'USD',
  //           notifications: {
  //             email: true,
  //             sms: false,
  //             push: true,
  //             marketing: false,
  //             bookingReminders: true,
  //             priceAlerts: false
  //           },
  //           accessibility: {
  //             screenReader: false,
  //             highContrast: false,
  //             largeText: false
  //           },
  //           privacy: {
  //             profileVisibility: 'private',
  //             shareDataForMarketing: false,
  //             shareDataForAnalytics: true
  //           }
  //         },
  //         travelProfile: {
  //           frequentDestinations: [],
  //           preferredRoomType: 'standard',
  //           specialRequests: [],
  //           dietaryRestrictions: [],
  //           emergencyContact: {
  //             name: '',
  //             phone: '',
  //             relationship: ''
  //           },
  //           travelPurpose: 'leisure',
  //           budgetRange: {
  //             min: 0,
  //             max: 1000,
  //             currency: 'USD'
  //           }
  //         },
  //         loyalty: {
  //           points: 0,
  //           tier: 'bronze',
  //           totalBookings: 0,
  //           totalSpent: 0,
  //           memberSince: new Date().toISOString(),
  //           benefits: []
  //         },
  //         paymentMethods: [],
  //         verification: {
  //           identityVerified: false,
  //           phoneVerified: authUser.phoneVerified,
  //           emailVerified: authUser.emailVerified,
  //           verificationLevel: 'basic'
  //         },
  //         status: 'active',
  //         role: authUser.role === 'user' ? 'guest' : authUser.role === 'owner' ? 'host' : authUser.role as 'guest' | 'host' | 'admin' | 'super_admin',
  //         createdAt: new Date().toISOString(),
  //         updatedAt: new Date().toISOString(),
  //         lastActiveAt: new Date().toISOString(),
  //         GSI1PK: `EMAIL#${authUser.email}`,
  //         GSI1SK: 'USER',
  //         GSI2PK: authUser.phone ? `PHONE#${authUser.phone}` : '',
  //         GSI2SK: 'USER',
  //         GSI3PK: `ROLE#${authUser.role}`,
  //         GSI3SK: `USER#${new Date().toISOString()}`
  //       };
  //       console.log('Creating new user in DynamoDB:', newUser);

  //       await this.modelService.createUser(newUser).toPromise();
  //     }
  //   } catch (error) {
  //     console.error('Error syncing user with database:', error);
  //   }
  // }


  // /**
  //  * Create user record in DynamoDB - DISABLED
  //  */
  // private createUserInDynamoDB(signUpData: SignUpData, userId: string): Observable<any> {
  //   const newUser = {
  //     PK: `USER#${userId}`,
  //     SK: 'PROFILE',
  //     userId: userId,
  //     email: signUpData.email,
  //     emailVerified: false,
  //     phone: signUpData.phone || undefined,
  //     phoneVerified: false,
  //     profile: {
  //       firstName: signUpData.firstName,
  //       lastName: signUpData.lastName,
  //       preferredLanguage: 'en',
  //       timezone: 'UTC'
  //     },
  //     address: undefined,
  //     auth: {
  //       providers: ['cognito'],
  //       lastLogin: new Date().toISOString(),
  //       loginCount: 0,
  //       twoFactorEnabled: false
  //     },
  //     preferences: {
  //       currency: 'USD',
  //       notifications: {
  //         email: true,
  //         sms: false,
  //         push: false,
  //         marketing: false,
  //         bookingReminders: true,
  //         priceAlerts: false
  //       },
  //       accessibility: {
  //         screenReader: false,
  //         highContrast: false,
  //         largeText: false
  //       },
  //       privacy: {
  //         profileVisibility: 'public',
  //         shareDataForMarketing: false,
  //         shareDataForAnalytics: false
  //       }
  //     },
  //     travelProfile: {
  //       frequentDestinations: [],
  //       preferredRoomType: '',
  //       specialRequests: [],
  //       dietaryRestrictions: [],
  //       emergencyContact: {
  //         name: '',
  //         phone: '',
  //         relationship: ''
  //       },
  //       travelPurpose: 'leisure',
  //       budgetRange: {
  //         min: 0,
  //         max: 1000,
  //         currency: 'USD'
  //       }
  //     },
  //     loyalty: {
  //       points: 0,
  //       tier: 'bronze',
  //       totalBookings: 0,
  //       totalSpent: 0,
  //       memberSince: new Date().toISOString(),
  //       benefits: []
  //     },
  //     paymentMethods: [],
  //     verification: {
  //       identityVerified: false,
  //       phoneVerified: false,
  //       emailVerified: false,
  //       verificationLevel: 'basic'
  //     },
  //     status: 'active',
  //     role: this.determineUserRole(signUpData.email),
  //     createdAt: new Date().toISOString(),
  //     updatedAt: new Date().toISOString(),
  //     lastActiveAt: new Date().toISOString(),

  //     // GSI Keys for DynamoDB
  //     GSI1PK: `EMAIL#${signUpData.email}`,
  //     GSI1SK: 'USER',
  //     GSI2PK: signUpData.phone ? `PHONE#${signUpData.phone}` : `PHONE#${userId}`,
  //     GSI2SK: 'USER',
  //     GSI3PK: `ROLE#${this.determineUserRole(signUpData.email)}`,
  //     GSI3SK: `USER#${new Date().toISOString()}`
  //   };

  //   return this.modelService.createUser(newUser as any);
  // }

  // /**
  //  * Ensure user exists in DynamoDB, create if missing - DISABLED
  //  */
  // private ensureUserInDynamoDB(email: string): Observable<any> {
  //   // First check if user already exists in DynamoDB
  //   return this.modelService.getUserByEmail(email).pipe(
  //     switchMap(existingUser => {
  //       if (existingUser) {
  //         // User already exists, just update email verification status
  //         return this.modelService.updateUser(existingUser.userId, {
  //           emailVerified: true,
  //           updatedAt: new Date().toISOString()
  //         });
  //       } else {
  //         // User doesn't exist in DynamoDB, create from Cognito data
  //         return this.createUserFromCognitoData(email);
  //       }
  //     })
  //   );
  // }

  // /**
  //  * Create user in DynamoDB from Cognito user data - DISABLED
  //  */
  // private createUserFromCognitoData(email: string): Observable<any> {
  //   console.log('Creating user from Cognito data for email:', email);

  //   return from(getCurrentUser()).pipe(
  //     switchMap(cognitoUser => {
  //       console.log('Got current user:', cognitoUser);
  //       const userId = cognitoUser.userId || `user_${Date.now()}`;

  //       // Try to get user attributes, but don't fail if it doesn't work
  //       return from(fetchUserAttributes()).pipe(
  //         switchMap(attributes => {
  //           console.log('Got user attributes:', attributes);

  //           const signUpData: SignUpData = {
  //             email: email,
  //             password: '', // Not needed for DynamoDB creation
  //             firstName: attributes.given_name || 'User',
  //             lastName: attributes.family_name || '',
  //             phone: attributes.phone_number
  //           };

  //           return this.createUserInDynamoDB(signUpData, userId);
  //         }),
  //         catchError(attributeError => {
  //           console.warn('Failed to fetch user attributes, using minimal data:', attributeError);

  //           // Create user with minimal data if attributes fetch fails
  //           const minimalSignUpData: SignUpData = {
  //             email: email,
  //             password: '',
  //             firstName: 'User',
  //             lastName: ''
  //           };

  //           return this.createUserInDynamoDB(minimalSignUpData, userId);
  //         })
  //       );
  //     }),
  //     catchError(error => {
  //       console.error('Failed to get current user:', error);

  //       // Last resort: create minimal user record with generated ID
  //       const userId = `user_${Date.now()}`;
  //       const minimalSignUpData: SignUpData = {
  //         email: email,
  //         password: '',
  //         firstName: 'User',
  //         lastName: ''
  //       };

  //       return this.createUserInDynamoDB(minimalSignUpData, userId);
  //     })
  //   );
  // }

  // /**
  //  * Create verified user in DynamoDB after email confirmation - DISABLED
  //  */
  // private createVerifiedUserInDynamoDB(email: string): Observable<any> {
  //   console.log('Creating verified user in DynamoDB for:', email);

  //   // Create user with minimal data since we can't reliably get Cognito user info immediately after confirmation
  //   const userRole = this.determineUserRole(email);
  //   const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  //   console.log('Creating user with generated ID:', userId, 'and role:', userRole);

  //   const verifiedUser = {
  //     PK: `USER#${userId}`,
  //     SK: 'PROFILE',
  //     userId: userId,
  //     email: email,
  //     emailVerified: true, // User is verified since they confirmed their email
  //     phoneVerified: false,
  //     role: userRole,
  //     status: 'active',
  //     profile: {
  //       firstName: 'User',
  //       lastName: '',
  //       preferredLanguage: 'en',
  //       timezone: 'UTC'
  //     },
  //     auth: {
  //       providers: ['cognito'],
  //       lastLogin: new Date().toISOString(),
  //       loginCount: 1,
  //       twoFactorEnabled: false
  //     },
  //     preferences: {
  //       currency: 'USD',
  //       notifications: {
  //         email: true,
  //         sms: false,
  //         push: false,
  //         marketing: false,
  //         bookingReminders: true,
  //         priceAlerts: false
  //       },
  //       accessibility: {
  //         screenReader: false,
  //         highContrast: false,
  //         largeText: false
  //       },
  //       privacy: {
  //         profileVisibility: 'private',
  //         shareDataForMarketing: false,
  //         shareDataForAnalytics: false
  //       }
  //     },
  //     travelProfile: {
  //       frequentDestinations: [],
  //       preferredRoomType: '',
  //       specialRequests: [],
  //       dietaryRestrictions: [],
  //       emergencyContact: {
  //         name: '',
  //         phone: '',
  //         relationship: ''
  //       },
  //       travelPurpose: 'leisure',
  //       budgetRange: {
  //         min: 0,
  //         max: 1000,
  //         currency: 'USD'
  //       }
  //     },
  //     loyalty: {
  //       points: 0,
  //       tier: 'bronze',
  //       totalBookings: 0,
  //       totalSpent: 0,
  //       memberSince: new Date().toISOString(),
  //       benefits: []
  //     },
  //     paymentMethods: [],
  //     verification: {
  //       identityVerified: false,
  //       phoneVerified: false,
  //       emailVerified: true,
  //       verificationLevel: 'basic'
  //     },
  //     createdAt: new Date().toISOString(),
  //     updatedAt: new Date().toISOString(),
  //     lastActiveAt: new Date().toISOString(),

  //     // GSI Keys for DynamoDB
  //     GSI1PK: `EMAIL#${email}`,
  //     GSI1SK: 'USER',
  //     GSI2PK: `PHONE#${userId}`,
  //     GSI2SK: 'USER',
  //     GSI3PK: `ROLE#${userRole}`,
  //     GSI3SK: `USER#${new Date().toISOString()}`
  //   };

  //   console.log('Creating verified user with data:', verifiedUser);

  //   return this.modelService.createUser(verifiedUser as any).pipe(
  //     map(result => {
  //       console.log('Successfully created user in DynamoDB:', result);
  //       return result;
  //     }),
  //     catchError(error => {
  //       console.error('Failed to create verified user in DynamoDB:', error);
  //       // Don't throw error - email verification was successful
  //       return of({ success: false, error: error.message });
  //     })
  //   );
  // }
}
