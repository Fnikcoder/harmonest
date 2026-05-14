import { Injectable } from '@angular/core';
import { Observable, map, from, of, catchError, filter } from 'rxjs';
import { AuthService, AuthUser } from './auth.service';
import { UserRole, getRoleInfo, hasPermission, hasAnyRole } from '../utils/role.utils';
import { fetchAuthSession } from 'aws-amplify/auth';

export interface UserRoleInfo {
  groups: string[];
  primaryRole: UserRole;
  hasRole: (role: string) => boolean;
}

@Injectable({
  providedIn: 'root'
})
export class RoleService {

  private roleHierarchy = {
    'super_admin': 5,
    'owner': 4,
    'admin': 3,
    'support': 2,
    'user': 1,
    'guest': 0
  };

  constructor(private authService: AuthService) {}

  /**
   * Get current user's role information from JWT token
   */
  getCurrentUserRoleInfo(): Observable<UserRoleInfo> {
    return from(this.getCurrentUserRoleFromToken()).pipe(
      catchError(error => {
        return of({ groups: [], primaryRole: 'guest' as UserRole, hasRole: () => false });
      })
    );
  }

  /**
   * Get current user's role from JWT ID token (most efficient method)
   */
  private async getCurrentUserRoleFromToken(): Promise<UserRoleInfo> {
    try {
      const session = await fetchAuthSession();

      if (!session.tokens?.idToken) {
        return { groups: [], primaryRole: 'guest' as UserRole, hasRole: () => false };
      }

      const payload = session.tokens.idToken.payload;

      // Groups are in the 'cognito:groups' claim
      const groups = (payload['cognito:groups'] as string[]) || [];

      // Return the highest priority role
      const userRole = groups.reduce((highest, group) => {
        const currentLevel = this.roleHierarchy[group as keyof typeof this.roleHierarchy] || 0;
        const highestLevel = this.roleHierarchy[highest as keyof typeof this.roleHierarchy] || 0;
        return currentLevel > highestLevel ? group : highest;
      }, 'guest') as UserRole;

      return {
        groups: groups,
        primaryRole: userRole,
        hasRole: (role: string) => groups.includes(role)
      };
    } catch (error) {
      return { groups: [], primaryRole: 'guest' as UserRole, hasRole: () => false };
    }
  }

  /**
   * Get current user's primary role
   */
  getCurrentUserRole(): Observable<UserRole | null> {
    return this.getCurrentUserRoleInfo().pipe(
      map(roleInfo => roleInfo.primaryRole)
    );
  }

  /**
   * Get current user
   */
  getCurrentUser(): Observable<AuthUser | null> {
    return this.authService.authState$.pipe(
      map(authState => authState.user)
    );
  }

  /**
   * Check if current user has management panel access
   * Management panel is accessible to: super_admin, owner, admin, support
   */
  hasManagementAccess(): Observable<boolean> {
    return this.authService.authState$.pipe(
      filter(authState => !authState.loading), // Wait for loading to complete
      map(authState => {
        // If we have user info, check their role
        if (authState.isAuthenticated && authState.user) {
          const managementRoles = ['super_admin', 'owner', 'admin', 'support'];
          return managementRoles.includes(authState.user.role);
        }

        return false;
      })
    );
  }

  /**
   * Check if current user has specific permission
   */
  hasPermission(permission: string): Observable<boolean> {
    return this.getCurrentUserRole().pipe(
      map(role => {
        if (!role) return false;
        return hasPermission(role, permission);
      })
    );
  }

  /**
   * Check if current user has any of the specified roles
   */
  hasAnyRole(roles: UserRole[]): Observable<boolean> {
    return this.authService.authState$.pipe(
      map(authState => {
        // If still loading and no user info yet, return false
        if (authState.loading && !authState.user) {
          return false;
        }

        // If we have user info, check their role regardless of loading state
        if (authState.isAuthenticated && authState.user) {
          return roles.includes(authState.user.role);
        }

        return false;
      })
    );
  }

  /**
   * Check if current user has specific role
   */
  hasRole(role: UserRole): Observable<boolean> {
    return this.getCurrentUserRoleInfo().pipe(
      map(roleInfo => roleInfo.hasRole(role))
    );
  }

  /**
   * Check if current user is admin level (admin, owner, or super_admin)
   */
  isAdminLevel(): Observable<boolean> {
    return this.hasAnyRole(['admin', 'owner', 'super_admin']);
  }

  /**
   * Check if current user is owner level (owner or super_admin)
   */
  isOwnerLevel(): Observable<boolean> {
    return this.hasAnyRole(['owner', 'super_admin']);
  }

  /**
   * Check if current user is super admin
   */
  isSuperAdmin(): Observable<boolean> {
    return this.hasRole('super_admin');
  }

  /**
   * Get current user's role information (using getRoleInfo utility)
   */
  getCurrentUserRoleDetails(): Observable<any> {
    return this.getCurrentUserRole().pipe(
      map(role => role ? getRoleInfo(role) : null)
    );
  }

  /**
   * Check if user can access a specific route/feature
   */
  canAccessFeature(feature: string): Observable<boolean> {
    const featurePermissions: { [key: string]: string[] } = {
      'management': ['super_admin', 'owner', 'admin'],
      'user_management': ['super_admin', 'owner'],
      'property_management': ['super_admin', 'owner', 'admin'],
      'booking_management': ['super_admin', 'owner', 'admin', 'support'],
      'analytics': ['super_admin', 'owner', 'admin'],
      'settings': ['super_admin', 'owner', 'admin'],
      'support_chat': ['super_admin', 'owner', 'admin', 'support']
    };

    return this.getCurrentUserRoleInfo().pipe(
      map(roleInfo => {
        const allowedRoles = featurePermissions[feature] || [];
        return allowedRoles.some(role => roleInfo.hasRole(role));
      })
    );
  }

  /**
   * Get user details from API (fallback method)
   */
  getUserDetailsFromAPI(): Observable<string[]> {
    return from(this.fetchUserDetailsFromAPI()).pipe(
      catchError(error => {
        return of([]);
      })
    );
  }

  /**
   * Fetch user details from the user management API
   */
  private async fetchUserDetailsFromAPI(): Promise<string[]> {
    try {
      const session = await fetchAuthSession();

      if (!session.tokens?.accessToken || !session.tokens?.idToken) {
        return [];
      }

      const token = session.tokens.accessToken.toString();
      const userId = session.tokens.idToken.payload.sub;

      const response = await fetch(
        `https://8y8k22wgzj.execute-api.eu-central-1.amazonaws.com/prod/users/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const userData = await response.json();
        return userData.groups || [];
      }
    } catch (error) {
      // Handle API error silently
    }
    return [];
  }

  /**
   * Get comprehensive user role info (combines JWT and API data)
   */
  getComprehensiveUserRoleInfo(): Observable<UserRoleInfo> {
    return this.getCurrentUserRoleInfo().pipe(
      map(jwtRoleInfo => {
        // If JWT has groups, use them; otherwise could fallback to API
        if (jwtRoleInfo.groups.length > 0) {
          return jwtRoleInfo;
        }

        // For now, return JWT info even if empty
        // You could implement API fallback here if needed
        return jwtRoleInfo;
      })
    );
  }
}
