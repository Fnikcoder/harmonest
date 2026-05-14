import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, SignUpData } from '../../../services/auth.service';
import { SwitcherComponent } from '../../../components/switcher/switcher.component';
import { BackToHomeComponent } from '../../../components/back-to-home/back-to-home.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    SwitcherComponent,
    BackToHomeComponent
  ],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss'
})
export class SignupComponent implements OnInit, OnDestroy {
  signupForm!: FormGroup;
  loading = false;
  error: string | null = null;
  showPassword = false;
  showConfirmPassword = false;

  private destroy$ = new Subject<void>();

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.initializeForm();
    this.subscribeToAuthState();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm() {
    this.signupForm = this.formBuilder.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8), this.passwordValidator]],
      confirmPassword: ['', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]]
    }, { validators: this.passwordMatchValidator });
  }

  private subscribeToAuthState() {
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(authState => {
        this.loading = authState.loading;
        this.error = authState.error;
      });
  }

  onSubmit() {
    if (this.signupForm.valid) {
      const signUpData: SignUpData = {
        email: this.signupForm.value.email,
        password: this.signupForm.value.password,
        firstName: this.signupForm.value.firstName.trim(),
        lastName: this.signupForm.value.lastName.trim(),
        phone: undefined // Removed phone field
      };

      this.authService.signUp(signUpData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (result) => {
            // Always redirect to email verification page after signup
            this.router.navigate(['/email-verification'], {
              queryParams: { email: signUpData.email }
            });
          },
          error: (error) => {
            this.error = error.message || 'Signup failed. Please try again.';
          }
        });
    } else {
      this.markFormGroupTouched();
    }
  }

  togglePasswordVisibility(field: 'password' | 'confirmPassword') {
    if (field === 'password') {
      this.showPassword = !this.showPassword;
    } else {
      this.showConfirmPassword = !this.showConfirmPassword;
    }
  }

  private markFormGroupTouched() {
    Object.keys(this.signupForm.controls).forEach(key => {
      const control = this.signupForm.get(key);
      control?.markAsTouched();
    });
  }

  // Custom validators
  private passwordValidator(control: any) {
    const value = control.value;
    if (!value) return null;

    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasNumeric = /[0-9]/.test(value);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);

    const valid = hasUpperCase && hasLowerCase && hasNumeric && hasSpecialChar;
    return valid ? null : { passwordStrength: true };
  }

  private passwordMatchValidator(group: FormGroup) {
    const password = group.get('password');
    const confirmPassword = group.get('confirmPassword');

    if (!password || !confirmPassword) return null;

    return password.value === confirmPassword.value ? null : { passwordMismatch: true };
  }

  // Social signup methods
  signUpWithGoogle() {
    // Google OAuth implementation
  }

  signUpWithFacebook() {
    // Facebook OAuth implementation
  }

  signUpWithApple() {
    // Apple OAuth implementation
  }

  // Utility methods for template
  isFieldInvalid(fieldName: string): boolean {
    const field = this.signupForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.signupForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) {
        const fieldLabels: { [key: string]: string } = {
          'firstName': 'First name',
          'lastName': 'Last name',
          'email': 'Email',
          'password': 'Password',
          'confirmPassword': 'Confirm password',
          'acceptTerms': 'Terms and conditions acceptance'
        };
        return `${fieldLabels[fieldName] || fieldName} is required`;
      }
      if (field.errors['email']) {
        return 'Please enter a valid email address';
      }
      if (field.errors['minlength']) {
        const fieldLabels: { [key: string]: string } = {
          'firstName': 'First name',
          'lastName': 'Last name',
          'password': 'Password'
        };
        return `${fieldLabels[fieldName] || fieldName} must be at least ${field.errors['minlength'].requiredLength} characters`;
      }
      if (field.errors['passwordStrength']) {
        return 'Password must contain uppercase, lowercase, number, and special character';
      }
      if (field.errors['requiredTrue']) {
        return 'You must accept the terms and conditions';
      }
    }

    // Check form-level errors
    if (fieldName === 'confirmPassword' && this.signupForm.errors?.['passwordMismatch']) {
      return 'Passwords do not match';
    }

    return '';
  }
}
