import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { delay, map, catchError } from 'rxjs/operators';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ConfigService } from './config.service';

export interface VerificationResult {
  success: boolean;
  message: string;
  remainingAttempts?: number;
}

export interface EmailVerificationState {
  email: string;
  isVerified: boolean;
  verificationSent: boolean;
  verificationCode: string;
  sentAt: Date | null;
  attempts: number;
  maxAttempts: number;
  cooldownUntil: Date | null;
}

@Injectable({
  providedIn: 'root'
})
export class EmailVerificationService {
  private verificationStateSubject = new BehaviorSubject<EmailVerificationState>({
    email: '',
    isVerified: false,
    verificationSent: false,
    verificationCode: '',
    sentAt: null,
    attempts: 0,
    maxAttempts: 3,
    cooldownUntil: null
  });

  verificationState$ = this.verificationStateSubject.asObservable();

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {}

  sendVerificationCode(email: string): Observable<VerificationResult> {
    const currentState = this.verificationStateSubject.value;

    // Check cooldown period
    if (currentState.cooldownUntil && new Date() < currentState.cooldownUntil) {
      const remainingTime = Math.ceil((currentState.cooldownUntil.getTime() - new Date().getTime()) / 1000);
      return throwError(() => ({
        success: false,
        message: `Please wait ${remainingTime} seconds before requesting another code.`
      }));
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const sentAt = new Date();

    // Set cooldown period (60 seconds)
    const cooldownUntil = new Date(sentAt.getTime() + 60000); // 60 seconds cooldown

    // Prepare request payload for AWS Lambda
    const payload = {
      operation: 'send-verification-email',
      email: email,
      verificationCode: verificationCode,
      type: 'checkin' // Specify this is for check-in process
    };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });

    // Get API endpoint from centralized config
    const apiUrl = this.configService.getApiUrl('emailVerification');
    if (!apiUrl) {
      return throwError(() => ({
        success: false,
        message: 'Email verification API endpoint not configured'
      }));
    }

    // Call AWS API Gateway endpoint
    return this.http.post<any>(apiUrl, payload, { headers }).pipe(
      map(response => {
        // Update state on successful API call
        this.verificationStateSubject.next({
          ...currentState,
          email,
          verificationCode,
          verificationSent: true,
          sentAt,
          cooldownUntil,
          attempts: 0 // Reset attempts when new code is sent
        });

        return {
          success: true,
          message: response.message || 'Verification code sent successfully'
        };
      }),
      catchError(error => {
        return throwError(() => ({
          success: false,
          message: error.error?.message || 'Failed to send verification code. Please try again.'
        }));
      })
    );
  }

  verifyCode(inputCode: string): Observable<VerificationResult> {
    const currentState = this.verificationStateSubject.value;

    if (!currentState.verificationSent) {
      return throwError(() => ({
        success: false,
        message: 'No verification code has been sent. Please request a new code.'
      }));
    }

    // Check if code has expired (10 minutes)
    if (currentState.sentAt) {
      const expirationTime = new Date(currentState.sentAt.getTime() + 10 * 60000); // 10 minutes
      if (new Date() > expirationTime) {
        this.verificationStateSubject.next({
          ...currentState,
          verificationSent: false,
          verificationCode: '',
          sentAt: null
        });

        return throwError(() => ({
          success: false,
          message: 'Verification code has expired. Please request a new code.'
        }));
      }
    }

    const newAttempts = currentState.attempts + 1;

    // Check max attempts
    if (newAttempts > currentState.maxAttempts) {
      // Lock verification for 5 minutes
      const lockUntil = new Date(new Date().getTime() + 5 * 60000);

      this.verificationStateSubject.next({
        ...currentState,
        attempts: newAttempts,
        cooldownUntil: lockUntil,
        verificationSent: false,
        verificationCode: ''
      });

      return throwError(() => ({
        success: false,
        message: 'Too many failed attempts. Please wait 5 minutes before trying again.'
      }));
    }

    // Prepare request payload for AWS Lambda verification
    const payload = {
      operation: 'verify-email-code',
      email: currentState.email,
      verificationCode: inputCode,
      type: 'checkin'
    };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });

    // Get API endpoint from centralized config
    const apiUrl = this.configService.getApiUrl('emailVerification');
    if (!apiUrl) {
      return throwError(() => ({
        success: false,
        message: 'Email verification API endpoint not configured'
      }));
    }

    // Call AWS API Gateway endpoint to verify code
    return this.http.post<any>(apiUrl, payload, { headers }).pipe(
      map(response => {
        if (response.success) {
          // Update state on successful verification
          this.verificationStateSubject.next({
            ...currentState,
            isVerified: true,
            attempts: newAttempts
          });

          return {
            success: true,
            message: response.message || 'Email verified successfully'
          };
        } else {
          // Update attempts on failed verification
          this.verificationStateSubject.next({
            ...currentState,
            attempts: newAttempts
          });

          const remainingAttempts = currentState.maxAttempts - newAttempts;
          throw {
            success: false,
            message: response.message || `Invalid verification code. ${remainingAttempts} attempts remaining.`,
            remainingAttempts
          };
        }
      }),
      catchError(error => {
        // Update attempts on API error
        this.verificationStateSubject.next({
          ...currentState,
          attempts: newAttempts
        });

        const remainingAttempts = currentState.maxAttempts - newAttempts;
        return throwError(() => ({
          success: false,
          message: error.error?.message || `Verification failed. ${remainingAttempts} attempts remaining.`,
          remainingAttempts
        }));
      })
    )
  }

  resendVerificationCode(): Observable<VerificationResult> {
    const currentState = this.verificationStateSubject.value;

    if (!currentState.email) {
      return throwError(() => ({
        success: false,
        message: 'No email address found. Please enter your email first.'
      }));
    }

    return this.sendVerificationCode(currentState.email);
  }

  resetVerification(): void {
    this.verificationStateSubject.next({
      email: '',
      isVerified: false,
      verificationSent: false,
      verificationCode: '',
      sentAt: null,
      attempts: 0,
      maxAttempts: 3,
      cooldownUntil: null
    });
  }

  isEmailVerified(email: string): boolean {
    const currentState = this.verificationStateSubject.value;
    return currentState.email === email && currentState.isVerified;
  }

  getVerificationStatus(): EmailVerificationState {
    return this.verificationStateSubject.value;
  }



  // Check if cooldown is active
  isCooldownActive(): boolean {
    const currentState = this.verificationStateSubject.value;
    return currentState.cooldownUntil ? new Date() < currentState.cooldownUntil : false;
  }

  // Get remaining cooldown time in seconds
  getRemainingCooldownTime(): number {
    const currentState = this.verificationStateSubject.value;
    if (!currentState.cooldownUntil) return 0;

    const remaining = Math.ceil((currentState.cooldownUntil.getTime() - new Date().getTime()) / 1000);
    return Math.max(0, remaining);
  }
}
