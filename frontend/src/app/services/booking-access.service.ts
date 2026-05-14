import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { map, catchError, tap, delay } from 'rxjs/operators';
import { ModelService } from './model.service';
// import { Booking } from '../interfaces/booking.interface';

export interface BookingCredentials {
  confirmationCode: string;
  email?: string;
  phone?: string;
}

export interface BookingAccessResult {
  success: boolean;
  booking?: any; // Will be properly typed when Booking interface is available
  accessToken?: string;
  expiresAt?: Date;
  message?: string;
}

export interface BookingAccessState {
  isVerified: boolean;
  booking: any | null; // Will be properly typed when Booking interface is available
  accessToken: string | null;
  expiresAt: Date | null;
  loading: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class BookingAccessService {
  private accessStateSubject = new BehaviorSubject<BookingAccessState>({
    isVerified: false,
    booking: null,
    accessToken: null,
    expiresAt: null,
    loading: false,
    error: null
  });

  public accessState$ = this.accessStateSubject.asObservable();

  constructor(private modelService: ModelService) {
    this.checkExistingAccess();
  }

  private checkExistingAccess() {
    // Check if there's a valid access token in localStorage
    const storedToken = localStorage.getItem('booking_access_token');
    const storedExpiry = localStorage.getItem('booking_access_expiry');
    const storedBookingId = localStorage.getItem('booking_access_booking_id');

    if (storedToken && storedExpiry && storedBookingId) {
      const expiryDate = new Date(storedExpiry);
      if (expiryDate > new Date()) {
        // Token is still valid, restore access
        this.restoreBookingAccess(storedBookingId, storedToken, expiryDate);
      } else {
        // Token expired, clear storage
        this.clearStoredAccess();
      }
    }
  }

  private restoreBookingAccess(bookingId: string, accessToken: string, expiresAt: Date) {
    this.updateAccessState({ loading: true });

    // TODO: Implement getBookingById method in ModelService
    // For now, just clear the access since we can't restore it
    this.clearStoredAccess();
    this.updateAccessState({
      isVerified: false,
      booking: null,
      accessToken: null,
      expiresAt: null,
      loading: false,
      error: null
    });
  }

  /**
   * Verify booking access with confirmation code and email/phone
   */
  verifyBookingAccess(credentials: BookingCredentials): Observable<BookingAccessResult> {
    this.updateAccessState({ loading: true, error: null });

    // TODO: Implement getBookingByConfirmation method in ModelService
    // For now, simulate the verification process
    return of(null).pipe(
      delay(1500), // Simulate API call
      map(() => {
        // Mock booking verification
        if (credentials.confirmationCode === 'TEST123' &&
            (credentials.email === 'test@example.com' || credentials.phone === '+1234567890')) {

          const mockBooking = {
            bookingId: 'booking_123',
            confirmationCode: credentials.confirmationCode,
            guestInfo: {
              email: credentials.email || '',
              phone: credentials.phone || ''
            }
          };

          // Generate temporary access token
          const accessToken = this.generateAccessToken(mockBooking.bookingId);
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

          // Store access token
          this.storeBookingAccess(mockBooking.bookingId, accessToken, expiresAt);

          // Update state
          this.updateAccessState({
            isVerified: true,
            booking: mockBooking,
            accessToken,
            expiresAt,
            loading: false,
            error: null
          });

          return {
            success: true,
            booking: mockBooking,
            accessToken,
            expiresAt,
            message: 'Booking access verified successfully'
          };
        } else {
          throw new Error('Invalid booking confirmation code or contact information');
        }
      }),
      catchError(error => {
        this.updateAccessState({
          isVerified: false,
          booking: null,
          accessToken: null,
          expiresAt: null,
          loading: false,
          error: error.message || 'Booking verification failed'
        });

        return throwError(() => ({
          success: false,
          message: error.message || 'Booking verification failed'
        }));
      })
    );
  }

  /**
   * Clear booking access and sign out
   */
  clearBookingAccess(): Observable<void> {
    this.clearStoredAccess();
    this.updateAccessState({
      isVerified: false,
      booking: null,
      accessToken: null,
      expiresAt: null,
      loading: false,
      error: null
    });

    return of(undefined);
  }

  /**
   * Check if current access is valid
   */
  isAccessValid(): boolean {
    const state = this.accessStateSubject.value;
    return state.isVerified &&
           state.accessToken !== null &&
           state.expiresAt !== null &&
           state.expiresAt > new Date();
  }

  /**
   * Get current booking if access is valid
   */
  getCurrentBooking(): any | null {
    return this.isAccessValid() ? this.accessStateSubject.value.booking : null;
  }

  /**
   * Get current access token if valid
   */
  getCurrentAccessToken(): string | null {
    return this.isAccessValid() ? this.accessStateSubject.value.accessToken : null;
  }

  /**
   * Extend access token expiry (for active users)
   */
  extendAccess(): Observable<boolean> {
    const state = this.accessStateSubject.value;

    if (!this.isAccessValid() || !state.booking) {
      return of(false);
    }

    const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Extend by 24 hours

    this.storeBookingAccess(state.booking.bookingId, state.accessToken!, newExpiresAt);

    this.updateAccessState({
      ...state,
      expiresAt: newExpiresAt
    });

    return of(true);
  }

  private generateAccessToken(bookingId: string): string {
    // Generate a simple access token (in production, use proper JWT or similar)
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    return btoa(`${bookingId}:${timestamp}:${random}`);
  }

  private storeBookingAccess(bookingId: string, accessToken: string, expiresAt: Date) {
    localStorage.setItem('booking_access_token', accessToken);
    localStorage.setItem('booking_access_expiry', expiresAt.toISOString());
    localStorage.setItem('booking_access_booking_id', bookingId);
  }

  private clearStoredAccess() {
    localStorage.removeItem('booking_access_token');
    localStorage.removeItem('booking_access_expiry');
    localStorage.removeItem('booking_access_booking_id');
  }

  private updateAccessState(newState: Partial<BookingAccessState>) {
    const currentState = this.accessStateSubject.value;
    this.accessStateSubject.next({ ...currentState, ...newState });
  }

  /**
   * Validate booking credentials format
   */
  validateCredentials(credentials: BookingCredentials): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!credentials.confirmationCode || credentials.confirmationCode.trim().length === 0) {
      errors.push('Confirmation code is required');
    }

    if (!credentials.email && !credentials.phone) {
      errors.push('Either email or phone number is required');
    }

    if (credentials.email && !this.isValidEmail(credentials.email)) {
      errors.push('Please enter a valid email address');
    }

    if (credentials.phone && !this.isValidPhone(credentials.phone)) {
      errors.push('Please enter a valid phone number');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }
}
