import { Injectable } from '@angular/core';
import { ConfigService } from '../services/config.service';

export interface AuthConfig {
  cognito: {
    region: string;
    userPoolId: string;
    userPoolWebClientId: string;
    oauth: {
      domain: string;
      scope: string[];
      redirectSignIn: string;
      redirectSignOut: string;
      responseType: string;
    };
  };
  socialProviders: {
    google: {
      enabled: boolean;
      clientId?: string;
    };
    facebook: {
      enabled: boolean;
      appId?: string;
    };
    apple: {
      enabled: boolean;
      clientId?: string;
    };
  };
  mfa: {
    enabled: boolean;
    requiredForRoles: string[];
    methods: ('SMS' | 'TOTP' | 'EMAIL')[];
  };
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSymbols: boolean;
    preventReuse: number;
  };
  session: {
    timeout: number; // minutes
    extendOnActivity: boolean;
    rememberMeDuration: number; // days
  };
  deviceTrust: {
    enabled: boolean;
    trustDuration: number; // days
    requireMfaOnNewDevice: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthConfigService {
  constructor(private configService: ConfigService) {}

  /**
   * Get authentication configuration from centralized config
   */
  getAuthConfig(): AuthConfig | null {
    const config = this.configService.getConfig();
    if (!config) {
      return null;
    }

    const awsConfig = config.technical.aws;
    const authFeatures = config.features.authentication;
    const socialProviders = config.technical.socialProviders;

    if (!awsConfig?.cognito || !authFeatures) {
      return null;
    }

    return {
      cognito: {
        region: awsConfig.region,
        userPoolId: awsConfig.cognito.userPoolId,
        userPoolWebClientId: awsConfig.cognito.userPoolWebClientId,
        oauth: awsConfig.cognito.oauth || {
          domain: '',
          scope: ['openid', 'email', 'profile'],
          redirectSignIn: 'http://localhost:4200/auth/callback',
          redirectSignOut: 'http://localhost:4200/auth/logout',
          responseType: 'code'
        }
      },
      socialProviders: {
        google: {
          enabled: socialProviders?.google?.enabled || false,
          clientId: socialProviders?.google?.clientId
        },
        facebook: {
          enabled: socialProviders?.facebook?.enabled || false,
          appId: socialProviders?.facebook?.appId
        },
        apple: {
          enabled: socialProviders?.apple?.enabled || false,
          clientId: socialProviders?.apple?.clientId
        }
      },
      mfa: authFeatures.mfa ? {
        enabled: authFeatures.mfa.enabled,
        requiredForRoles: authFeatures.mfa.requiredForRoles,
        methods: (authFeatures.mfa.methods as ('SMS' | 'TOTP' | 'EMAIL')[])
      } : {
        enabled: true,
        requiredForRoles: ['super_admin', 'owner', 'admin'],
        methods: ['TOTP' as const, 'SMS' as const, 'EMAIL' as const]
      },
      passwordPolicy: authFeatures.passwordPolicy || {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: true,
        preventReuse: 5
      },
      session: authFeatures.session || {
        timeout: 480,
        extendOnActivity: true,
        rememberMeDuration: 30
      },
      deviceTrust: {
        enabled: true,
        trustDuration: 30,
        requireMfaOnNewDevice: true
      }
    };
  }

  /**
   * Get Cognito configuration
   */
  getCognitoConfig() {
    const authConfig = this.getAuthConfig();
    return authConfig?.cognito || null;
  }

  /**
   * Get social providers configuration
   */
  getSocialProvidersConfig() {
    const authConfig = this.getAuthConfig();
    return authConfig?.socialProviders || null;
  }

  /**
   * Get MFA configuration
   */
  getMfaConfig() {
    const authConfig = this.getAuthConfig();
    return authConfig?.mfa || null;
  }
}

export const roleHierarchy = {
  'super_admin': 5,
  'owner': 4,
  'admin': 3,
  'support': 2,
  'user': 1,
  'guest': 0
};

export const rolePermissions = {
  'super_admin': [
    'manage_users',
    'manage_roles',
    'manage_properties',
    'manage_bookings',
    'manage_payments',
    'view_analytics',
    'manage_settings',
    'access_all_data',
    'manage_system',
    'system_administration',
    'global_configuration',
    'security_management'
  ],
  'owner': [
    'manage_users',
    'manage_roles',
    'manage_properties',
    'manage_bookings',
    'manage_payments',
    'view_analytics',
    'manage_settings',
    'access_all_data',
    'manage_system'
  ],
  'admin': [
    'manage_properties',
    'manage_bookings',
    'manage_payments',
    'view_analytics',
    'manage_settings',
    'access_most_data',
    'view_users'
  ],
  'support': [
    'manage_bookings',
    'view_bookings',
    'access_chat',
    'view_customer_data',
    'update_booking_status',
    'process_refunds'
  ],
  'user': [
    'view_own_bookings',
    'manage_own_profile',
    'make_bookings',
    'cancel_own_bookings',
    'update_own_data'
  ],
  'guest': [
    'view_properties',
    'make_bookings',
    'view_public_data'
  ]
};

export function hasPermission(userRole: string, permission: string): boolean {
  const permissions = rolePermissions[userRole as keyof typeof rolePermissions] || [];
  return permissions.includes(permission);
}

export function hasAnyPermission(userRole: string, permissions: string[]): boolean {
  return permissions.some(permission => hasPermission(userRole, permission));
}

export function hasRole(userRole: string, requiredRole: string): boolean {
  const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0;
  const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;
  return userLevel >= requiredLevel;
}

export function hasAnyRole(userRole: string, requiredRoles: string[]): boolean {
  return requiredRoles.some(role => hasRole(userRole, role));
}

export function canAccessResource(userRole: string, resourceOwner?: string, userId?: string): boolean {
  // Super admin, owner and admin can access any resource
  if (hasAnyRole(userRole, ['super_admin', 'owner', 'admin'])) {
    return true;
  }

  // Support can access customer resources
  if (userRole === 'support') {
    return true;
  }

  // Users can only access their own resources
  if (userRole === 'user' && resourceOwner && userId) {
    return resourceOwner === userId;
  }

  return false;
}

export const authRoutes = {
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  confirmSignup: '/confirm-signup',
  mfaSetup: '/mfa-setup',
  profile: '/profile',
  dashboard: '/',
  forbidden: '/403',
  unauthorized: '/401'
};

export const publicRoutes = [
  '/',
  '/properties',
  '/search',
  '/about',
  '/contact',
  '/terms',
  '/privacy',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/confirm-signup'
];

export const protectedRoutes = [
  '/profile',
  '/bookings',
  '/admin',
  '/dashboard'
];

export const anonymousBookingRoutes = [
  '/check-in',
  '/booking-details'
];

export function isPublicRoute(path: string): boolean {
  return publicRoutes.some(route => path.startsWith(route));
}

export function isProtectedRoute(path: string): boolean {
  return protectedRoutes.some(route => path.startsWith(route));
}

export function isAnonymousBookingRoute(path: string): boolean {
  return anonymousBookingRoutes.some(route => path.startsWith(route));
}
