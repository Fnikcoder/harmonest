import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, from, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { fetchAuthSession } from 'aws-amplify/auth';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Skip authentication for public endpoints
    if (this.isPublicEndpoint(req.url)) {
      return next.handle(req);
    }

    // Add authentication token to requests
    return from(this.addAuthToken(req)).pipe(
      switchMap(authReq => next.handle(authReq)),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 || this.isTokenExpiredError(error)) {
          return this.handle401Error(req, next);
        }
        return throwError(() => error);
      })
    );
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return from(this.refreshToken()).pipe(
        switchMap((token: any) => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next(token);

          // Retry the original request with new token
          return from(this.addAuthToken(request)).pipe(
            switchMap(authReq => next.handle(authReq))
          );
        }),
        catchError((error) => {
          this.isRefreshing = false;

          // If refresh fails, sign out user
          this.authService.signOut().subscribe();
          this.router.navigate(['/login']);

          return throwError(() => error);
        })
      );
    } else {
      // If already refreshing, wait for the refresh to complete
      return this.refreshTokenSubject.pipe(
        filter(token => token != null),
        take(1),
        switchMap(() => {
          // Retry the original request with refreshed token
          return from(this.addAuthToken(request)).pipe(
            switchMap(authReq => next.handle(authReq))
          );
        })
      );
    }
  }

  private async refreshToken(): Promise<any> {
    try {
      // Force refresh the session
      const session = await fetchAuthSession({ forceRefresh: true });

      if (session.tokens?.accessToken) {
        // Also refresh user data in auth service
        await this.authService.refreshUserData();
        return session.tokens.accessToken;
      } else {
        throw new Error('No access token after refresh');
      }
    } catch (error) {
      throw error;
    }
  }

  private isTokenExpiredError(error: HttpErrorResponse): boolean {
    // Check for various token expiration error patterns
    if (error.error) {
      const errorMessage = error.error.message || error.error.toString();
      const errorCode = error.error.__type || error.error.code;

      return (
        errorCode === 'ExpiredTokenException' ||
        errorCode === 'TokenExpiredException' ||
        errorMessage.includes('expired') ||
        errorMessage.includes('ExpiredTokenException') ||
        errorMessage.includes('The security token included in the request is expired')
      );
    }

    return false;
  }

  private async addAuthToken(req: HttpRequest<any>): Promise<HttpRequest<any>> {
    try {
      const session = await fetchAuthSession();

      if (session.tokens?.accessToken) {
        const token = session.tokens.accessToken.toString();

        return req.clone({
          setHeaders: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }

    return req;
  }

  private isPublicEndpoint(url: string): boolean {
    const publicEndpoints = [
      '/auth/',
      '/public/',
      '/health',
      '/properties/search', // Public property search
      '/properties/details', // Public property details
      '/checkin', // Public check-in endpoints
      'execute-api.eu-central-1.amazonaws.com/prod/checkin' // Check-in API
    ];

    return publicEndpoints.some(endpoint => url.includes(endpoint));
  }
}

@Injectable()
export class BookingAccessInterceptor implements HttpInterceptor {
  constructor() {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Handle anonymous booking access
    if (this.isBookingEndpoint(req.url) && this.hasBookingCredentials(req)) {
      const modifiedReq = this.addBookingCredentials(req);
      return next.handle(modifiedReq);
    }

    return next.handle(req);
  }

  private isBookingEndpoint(url: string): boolean {
    return url.includes('/bookings/') || url.includes('/check-in/');
  }

  private hasBookingCredentials(req: HttpRequest<any>): boolean {
    const params = req.params;
    const headers = req.headers;

    return (
      (params.has('confirmation') && (params.has('email') || params.has('phone'))) ||
      (headers.has('X-Booking-Confirmation') && (headers.has('X-Booking-Email') || headers.has('X-Booking-Phone')))
    );
  }

  private addBookingCredentials(req: HttpRequest<any>): HttpRequest<any> {
    // Extract booking credentials from query params or headers
    const confirmation = req.params.get('confirmation') || req.headers.get('X-Booking-Confirmation');
    const email = req.params.get('email') || req.headers.get('X-Booking-Email');
    const phone = req.params.get('phone') || req.headers.get('X-Booking-Phone');

    let headers = req.headers;

    if (confirmation) {
      headers = headers.set('X-Booking-Confirmation', confirmation);
    }
    if (email) {
      headers = headers.set('X-Booking-Email', email);
    }
    if (phone) {
      headers = headers.set('X-Booking-Phone', phone);
    }

    return req.clone({ headers });
  }
}
