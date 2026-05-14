import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmailVerificationService, EmailVerificationState, VerificationResult } from '../../services/email-verification.service';
import { ConfigService } from '../../services/config.service';
import { Subject, takeUntil, interval } from 'rxjs';
import * as feather from 'feather-icons';

@Component({
  selector: 'app-email-verification',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './email-verification.component.html',
  styleUrl: './email-verification.component.scss'
})
export class EmailVerificationComponent implements OnInit, OnDestroy {
  @Input() email: string = '';
  @Input() required: boolean = true;
  @Output() verificationStatusChange = new EventEmitter<boolean>();
  @Output() verifiedEmailChange = new EventEmitter<string>();

  // Check if email verification is enabled for booking
  isBookingVerificationEnabled = true; // Will be set in ngOnInit

  verificationCodeControl = new FormControl('', [
    Validators.required,
    Validators.pattern(/^\d{6}$/)
  ]);

  verificationState: EmailVerificationState = {
    email: '',
    isVerified: false,
    verificationSent: false,
    verificationCode: '',
    sentAt: null,
    attempts: 0,
    maxAttempts: 3,
    cooldownUntil: null
  };

  isLoading = false;
  isVerifying = false;
  message = '';
  messageType: 'success' | 'error' | 'info' = 'info';
  showVerificationInput = false;
  cooldownTimer = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private emailVerificationService: EmailVerificationService,
    private configService: ConfigService
  ) {}

  ngOnInit(): void {
    // Get email verification setting from config
    const config = this.configService.getConfig();
    this.isBookingVerificationEnabled = config?.features?.authentication?.emailVerification?.booking ?? true;

    // If booking verification is disabled, automatically mark as verified
    if (!this.isBookingVerificationEnabled) {
      this.verificationStatusChange.emit(true);
      if (this.email) {
        this.verifiedEmailChange.emit(this.email);
      }
      return;
    }

    // Subscribe to verification state changes
    this.emailVerificationService.verificationState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.verificationState = state;
        this.showVerificationInput = state.verificationSent && !state.isVerified;
        this.verificationStatusChange.emit(state.isVerified);

        if (state.isVerified) {
          this.verifiedEmailChange.emit(state.email);
        }
      });

    // Start cooldown timer if needed
    this.startCooldownTimer();

    // Check if email is already verified
    if (this.email && this.emailVerificationService.isEmailVerified(this.email)) {
      this.verificationStatusChange.emit(true);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      feather.replace();
    }, 100);
  }

  sendVerificationCode(): void {
    if (!this.email) {
      this.showMessage('Please enter your email address first.', 'error');
      return;
    }

    this.isLoading = true;
    this.message = '';

    this.emailVerificationService.sendVerificationCode(this.email)
      .subscribe({
        next: (result: VerificationResult) => {
          this.isLoading = false;
          // Don't show the message, just update the UI state
          this.showVerificationInput = true;
          this.startCooldownTimer();
          // Clear any previous verification code input
          this.verificationCodeControl.reset();
        },
        error: (error) => {
          this.isLoading = false;
          this.showMessage(error.message || 'Failed to send verification code.', 'error');
        }
      });
  }

  verifyCode(): void {
    if (this.verificationCodeControl.invalid) {
      // Mark as touched to show validation errors
      this.verificationCodeControl.markAsTouched();

      if (this.verificationCodeControl.errors?.['required']) {
        this.showMessage('Verification code is required.', 'error');
      } else if (this.verificationCodeControl.errors?.['pattern']) {
        this.showMessage('Please enter a valid 6-digit verification code.', 'error');
      } else {
        this.showMessage('Please enter a valid 6-digit verification code.', 'error');
      }
      return;
    }

    const code = this.verificationCodeControl.value || '';
    this.isVerifying = true;
    this.message = '';

    this.emailVerificationService.verifyCode(code)
      .subscribe({
        next: (result: VerificationResult) => {
          this.isVerifying = false;
          this.showMessage(result.message, 'success');
          this.showVerificationInput = false;
          this.verificationCodeControl.reset();
        },
        error: (error) => {
          this.isVerifying = false;
          this.showMessage(error.message || 'Verification failed.', 'error');
          this.verificationCodeControl.reset();
        }
      });
  }



  private showMessage(text: string, type: 'success' | 'error' | 'info'): void {
    this.message = text;
    this.messageType = type;

    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        this.message = '';
      }, 5000);
    }
  }

  private startCooldownTimer(): void {
    if (this.emailVerificationService.isCooldownActive()) {
      this.cooldownTimer = this.emailVerificationService.getRemainingCooldownTime();

      const timer$ = interval(1000).pipe(takeUntil(this.destroy$));
      timer$.subscribe(() => {
        this.cooldownTimer = this.emailVerificationService.getRemainingCooldownTime();
        if (this.cooldownTimer <= 0) {
          this.cooldownTimer = 0;
        }
      });
    }
  }

  get isVerified(): boolean {
    return this.verificationState.isVerified && this.verificationState.email === this.email;
  }

  get canSendCode(): boolean {
    return !this.isLoading && !this.emailVerificationService.isCooldownActive() && this.email.length > 0;
  }




  // Helper method to format time
  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}
