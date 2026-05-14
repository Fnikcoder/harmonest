import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, SignInData } from '../../../services/auth.service';
import { SwitcherComponent } from '../../../components/switcher/switcher.component';
import { BackToHomeComponent } from '../../../components/back-to-home/back-to-home.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    SwitcherComponent,
    BackToHomeComponent
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm!: FormGroup;
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  returnUrl = '/';
  showPassword = false;
  resendingConfirmation = false;
  confirmationResent = false;

  private destroy$ = new Subject<void>();

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.initializeForm();
    this.getReturnUrl();
    this.subscribeToAuthState();
    this.checkForSuccessMessage();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm() {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      rememberMe: [false]
    });
  }

  private getReturnUrl() {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
  }

  private checkForSuccessMessage() {
    const message = this.route.snapshot.queryParams['message'];
    const email = this.route.snapshot.queryParams['email'];

    if (message) {
      this.successMessage = message;

      // Pre-fill email if provided
      if (email) {
        this.loginForm.patchValue({ email: email });
      }

      // Clear success message after 10 seconds
      setTimeout(() => {
        this.successMessage = null;
      }, 10000);
    }
  }

  private subscribeToAuthState() {
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(authState => {
        this.loading = authState.loading;
        this.error = authState.error;

        if (authState.isAuthenticated && authState.user) {
          // Redirect based on user role
          if (this.returnUrl && this.returnUrl !== '/') {
            this.router.navigate([this.returnUrl]);
          } else {
            // Redirect to management panel for admin users, home for regular users
            const hasManagementAccess = ['super_admin', 'owner', 'admin', 'support'].includes(authState.user.role);
            const redirectUrl = hasManagementAccess ? '/management' : '/';
            this.router.navigate([redirectUrl]);
          }
        }
      });
  }

  onSubmit() {
    if (this.loginForm.valid) {
      const signInData: SignInData = {
        email: this.loginForm.value.email,
        password: this.loginForm.value.password,
        rememberMe: this.loginForm.value.rememberMe
      };

      this.authService.signIn(signInData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (user) => {
            // Navigation is handled in subscribeToAuthState
          },
          error: (error) => {
            // Handle email verification required
            if (error.message === 'EMAIL_VERIFICATION_REQUIRED') {
              const email = this.loginForm.get('email')?.value;
              this.router.navigate(['/email-verification'], {
                queryParams: { email: email }
              });
              return;
            }

            this.error = error.message || 'Login failed. Please try again.';
          }
        });
    } else {
      this.markFormGroupTouched();
    }
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  private markFormGroupTouched() {
    Object.keys(this.loginForm.controls).forEach(key => {
      const control = this.loginForm.get(key);
      control?.markAsTouched();
    });
  }

  // Social login methods
  signInWithGoogle() {
    // Google OAuth implementation
  }

  signInWithFacebook() {
    // Facebook OAuth implementation
  }

  signInWithApple() {
    // Apple OAuth implementation
  }

  // Utility methods for template
  isFieldInvalid(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.loginForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) {
        return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
      }
      if (field.errors['email']) {
        return 'Please enter a valid email address';
      }
      if (field.errors['minlength']) {
        return `Password must be at least ${field.errors['minlength'].requiredLength} characters`;
      }
    }
    return '';
  }

  /**
   * Check if the current error is related to email confirmation
   */
  isEmailConfirmationError(): boolean {
    return this.error?.includes('confirm your email') ||
           this.error?.includes('CONFIRM_SIGN_UP') ||
           this.error?.includes('confirmation') ||
           false;
  }

  /**
   * Resend confirmation email
   */
  resendConfirmation(): void {
    const email = this.loginForm.get('email')?.value;
    if (!email) {
      this.error = 'Please enter your email address first';
      return;
    }

    this.resendingConfirmation = true;
    this.confirmationResent = false;
    this.error = null;

    this.authService.resendConfirmationCode(email)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.resendingConfirmation = false;
          this.confirmationResent = true;
          this.error = null;

          // Hide success message after 5 seconds
          setTimeout(() => {
            this.confirmationResent = false;
          }, 5000);
        },
        error: (error) => {
          this.resendingConfirmation = false;
          this.error = error.message || 'Failed to resend confirmation email';
        }
      });
  }
}
