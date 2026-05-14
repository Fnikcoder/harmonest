import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { AuthService } from '../../../services/auth.service';
import { SwitcherComponent } from '../../../components/switcher/switcher.component';
import { BackToHomeComponent } from '../../../components/back-to-home/back-to-home.component';

@Component({
  selector: 'app-email-verification',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    SwitcherComponent,
    BackToHomeComponent
  ],
  templateUrl: './email-verification.component.html'
})
export class EmailVerificationComponent implements OnInit, OnDestroy {
  verificationForm!: FormGroup;
  email: string = '';
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  resendingCode = false;
  resendCooldown = 0;

  private destroy$ = new Subject<void>();
  private resendTimer?: any;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.getEmailFromRoute();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
    }
  }

  private initializeForm(): void {
    this.verificationForm = this.fb.group({
      verificationCode: ['', [
        Validators.required,
        Validators.pattern(/^\d{6}$/)
      ]]
    });
  }

  private getEmailFromRoute(): void {
    this.email = this.route.snapshot.queryParams['email'] || '';
    if (!this.email) {
      // If no email provided, redirect to login
      this.router.navigate(['/login']);
      return;
    }
  }

  verifyCode(): void {
    if (this.verificationForm.invalid) {
      this.verificationForm.markAllAsTouched();
      return;
    }

    const verificationCode = this.verificationForm.get('verificationCode')?.value;

    this.loading = true;
    this.error = null;
    this.successMessage = null;

    this.authService.confirmSignUp(this.email, verificationCode)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loading = false;
          this.successMessage = 'Email verified successfully! Redirecting to sign in...';

          // Redirect to login after 2 seconds
          setTimeout(() => {
            this.router.navigate(['/login'], {
              queryParams: {
                message: 'Email verified successfully! Please sign in.',
                email: this.email
              }
            });
          }, 2000);
        },
        error: (error) => {
          this.loading = false;

          // Handle specific error cases
          if (error.message?.includes('CodeMismatchException')) {
            this.error = 'Invalid verification code. Please check and try again.';
          } else if (error.message?.includes('ExpiredCodeException')) {
            this.error = 'Verification code has expired. Please request a new code.';
          } else if (error.message?.includes('LimitExceededException')) {
            this.error = 'Too many attempts. Please wait before trying again.';
          } else {
            this.error = error.message || 'Verification failed. Please try again.';
          }
        }
      });
  }

  resendCode(): void {
    if (this.resendCooldown > 0 || this.resendingCode) {
      return;
    }

    this.resendingCode = true;
    this.error = null;
    this.successMessage = null;

    this.authService.resendConfirmationCode(this.email)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.resendingCode = false;
          this.successMessage = 'Verification code sent! Please check your email.';
          this.startResendCooldown();

          // Clear success message after 5 seconds
          setTimeout(() => {
            this.successMessage = null;
          }, 5000);
        },
        error: (error) => {
          this.resendingCode = false;

          if (error.message?.includes('LimitExceededException')) {
            this.error = 'Too many requests. Please wait before requesting another code.';
          } else {
            this.error = error.message || 'Failed to resend code. Please try again.';
          }
        }
      });
  }

  private startResendCooldown(): void {
    this.resendCooldown = 60; // 60 seconds cooldown

    this.resendTimer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        clearInterval(this.resendTimer);
      }
    }, 1000);
  }
}
