import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, take, tap, filter } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate, CanActivateChild {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.checkAuth(state.url);
  }

  canActivateChild(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.checkAuth(state.url);
  }

  private checkAuth(url: string): Observable<boolean> {
    return this.authService.authState$.pipe(
      filter(authState => !authState.loading), // Wait for loading to complete
      take(1),
      map(authState => {
        if (authState.isAuthenticated) {
          return true;
        }

        // Store the attempted URL for redirecting after login
        this.router.navigate(['/login'], {
          queryParams: { returnUrl: url }
        });
        return false;
      })
    );
  }
}

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate, CanActivateChild {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.checkRole(route);
  }

  canActivateChild(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.checkRole(route);
  }

  private checkRole(route: ActivatedRouteSnapshot): Observable<boolean> {
    const requiredRoles = route.data['roles'] as string[];
    const requiredPermissions = route.data['permissions'] as string[];

    return this.authService.authState$.pipe(
      filter(authState => !authState.loading), // Wait for loading to complete
      take(1),
      map(authState => {
        if (!authState.isAuthenticated || !authState.user) {
          this.router.navigate(['/login']);
          return false;
        }

        // Check roles
        if (requiredRoles && requiredRoles.length > 0) {
          if (!requiredRoles.includes(authState.user.role)) {
            this.router.navigate(['/403']); // Forbidden page
            return false;
          }
        }

        // Check permissions (custom logic based on your needs)
        if (requiredPermissions && requiredPermissions.length > 0) {
          if (!this.hasPermissions(authState.user.role, requiredPermissions)) {
            this.router.navigate(['/403']);
            return false;
          }
        }

        return true;
      })
    );
  }

  private hasPermissions(userRole: string, requiredPermissions: string[]): boolean {
    const rolePermissions = this.getRolePermissions(userRole);
    return requiredPermissions.every(permission => rolePermissions.includes(permission));
  }

  private getRolePermissions(role: string): string[] {
    const permissions: { [key: string]: string[] } = {
      'super_admin': [
        'manage_users',
        'manage_roles',
        'manage_properties',
        'manage_bookings',
        'manage_payments',
        'view_analytics',
        'manage_settings',
        'access_all_data',
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
        'access_all_data'
      ],
      'admin': [
        'manage_properties',
        'manage_bookings',
        'manage_payments',
        'view_analytics',
        'manage_settings',
        'access_most_data'
      ],
      'support': [
        'manage_bookings',
        'view_bookings',
        'access_chat',
        'view_customer_data'
      ],
      'user': [
        'view_own_bookings',
        'manage_own_profile',
        'make_bookings'
      ],
      'guest': [
        'view_properties',
        'make_bookings'
      ]
    };

    return permissions[role] || [];
  }
}

@Injectable({
  providedIn: 'root'
})
export class GuestGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.authService.authState$.pipe(
      take(1),
      map(authState => {
        if (authState.loading) {
          return false;
        }

        if (authState.isAuthenticated) {
          // User is already logged in, redirect to dashboard or home
          this.router.navigate(['/']);
          return false;
        }

        return true; // Allow access to login/signup pages
      })
    );
  }
}

@Injectable({
  providedIn: 'root'
})
export class BookingAccessGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    const bookingId = route.params['bookingId'];
    const confirmationCode = route.queryParams['confirmation'];
    const email = route.queryParams['email'];
    const phone = route.queryParams['phone'];

    return this.authService.authState$.pipe(
      take(1),
      map(authState => {
        // If user is authenticated and has booking access permissions
        if (authState.isAuthenticated && authState.user) {
          if (this.authService.canAccessBookings()) {
            return true; // Super Admin/Admin/Support/Owner can access any booking
          }

          // Regular users can only access their own bookings
          // This would need additional logic to verify ownership
          return true;
        }

        // Anonymous access with booking credentials
        if (bookingId && confirmationCode && (email || phone)) {
          // This would need to be validated against the booking data
          // For now, allow access if all required parameters are present
          return true;
        }

        // No valid authentication or booking credentials
        this.router.navigate(['/login'], {
          queryParams: { returnUrl: state.url }
        });
        return false;
      })
    );
  }
}
