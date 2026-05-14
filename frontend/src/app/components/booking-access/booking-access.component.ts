import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { BookingAccessService, BookingCredentials } from '../../services/booking-access.service';

@Component({
  selector: 'app-booking-access',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
  ],
  template: `
    <div class="max-w-md mx-auto bg-white dark:bg-slate-900 shadow-md dark:shadow-gray-700 rounded-md p-6">
      <div class="text-center mb-6">
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white">Access Your Booking</h3>
        <p class="text-gray-600 dark:text-gray-400 mt-2">
          Enter your booking confirmation code and contact information to access your booking details.
        </p>
      </div>

      <!-- Error Message -->
      <div *ngIf="error" class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
        <p class="text-red-600 dark:text-red-400 text-sm">{{ error }}</p>
      </div>

      <!-- Success Message -->
      <div *ngIf="successMessage" class="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
        <p class="text-green-600 dark:text-green-400 text-sm">{{ successMessage }}</p>
      </div>

      <form [formGroup]="accessForm" (ngSubmit)="onSubmit()">
        <!-- Confirmation Code -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Booking Confirmation Code *
          </label>
          <input
            type="text"
            formControlName="confirmationCode"
            placeholder="Enter your confirmation code"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-slate-800 dark:text-white"
            [class.border-red-500]="isFieldInvalid('confirmationCode')">
          <div *ngIf="isFieldInvalid('confirmationCode')" class="mt-1 text-red-500 text-sm">
            {{ getFieldError('confirmationCode') }}
          </div>
        </div>

        <!-- Contact Method Selection -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Verification Method
          </label>
          <div class="flex space-x-4">
            <label class="flex items-center">
              <input
                type="radio"
                value="email"
                formControlName="contactMethod"
                class="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300">
              <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Email</span>
            </label>
            <label class="flex items-center">
              <input
                type="radio"
                value="phone"
                formControlName="contactMethod"
                class="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300">
              <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Phone</span>
            </label>
          </div>
        </div>

        <!-- Email Field -->
        <div *ngIf="accessForm.get('contactMethod')?.value === 'email'" class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email Address *
          </label>
          <input
            type="email"
            formControlName="email"
            placeholder="Enter your email address"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-slate-800 dark:text-white"
            [class.border-red-500]="isFieldInvalid('email')">
          <div *ngIf="isFieldInvalid('email')" class="mt-1 text-red-500 text-sm">
            {{ getFieldError('email') }}
          </div>
        </div>

        <!-- Phone Field -->
        <div *ngIf="accessForm.get('contactMethod')?.value === 'phone'" class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Phone Number *
          </label>
          <input
            type="tel"
            formControlName="phone"
            placeholder="Enter your phone number"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-slate-800 dark:text-white"
            [class.border-red-500]="isFieldInvalid('phone')">
          <div *ngIf="isFieldInvalid('phone')" class="mt-1 text-red-500 text-sm">
            {{ getFieldError('phone') }}
          </div>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          [disabled]="loading || accessForm.invalid"
          class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-400 disabled:cursor-not-allowed">
          <span *ngIf="loading" class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
          {{ loading ? 'Verifying...' : 'Access Booking' }}
        </button>
      </form>

      <!-- Help Text -->
      <div class="mt-6 text-center">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Can't find your confirmation code? Check your email or contact support.
        </p>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
          Have an account?
          <a routerLink="/login" class="text-red-600 hover:text-red-500 font-medium">Sign in here</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      padding: 2rem 1rem;
    }
  `]
})
export class BookingAccessComponent implements OnInit, OnDestroy {
  accessForm!: FormGroup;
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private formBuilder: FormBuilder,
    private bookingAccessService: BookingAccessService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.initializeForm();
    this.subscribeToAccessState();
    this.prefillFromQueryParams();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm() {
    this.accessForm = this.formBuilder.group({
      confirmationCode: ['', [Validators.required]],
      contactMethod: ['email', [Validators.required]],
      email: [''],
      phone: ['']
    });

    // Add conditional validators based on contact method
    this.accessForm.get('contactMethod')?.valueChanges.subscribe(method => {
      const emailControl = this.accessForm.get('email');
      const phoneControl = this.accessForm.get('phone');

      if (method === 'email') {
        emailControl?.setValidators([Validators.required, Validators.email]);
        phoneControl?.clearValidators();
      } else if (method === 'phone') {
        phoneControl?.setValidators([Validators.required, Validators.pattern(/^\+?[1-9]\d{1,14}$/)]);
        emailControl?.clearValidators();
      }

      emailControl?.updateValueAndValidity();
      phoneControl?.updateValueAndValidity();
    });
  }

  private subscribeToAccessState() {
    this.bookingAccessService.accessState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.loading = state.loading;
        this.error = state.error;

        if (state.isVerified && state.booking) {
          this.successMessage = 'Booking access verified successfully!';
          // Redirect to booking details or check-in page
          setTimeout(() => {
            this.router.navigate(['/check-in', state.booking!.bookingId]);
          }, 1500);
        }
      });
  }

  private prefillFromQueryParams() {
    const queryParams = this.route.snapshot.queryParams;

    if (queryParams['confirmation']) {
      this.accessForm.patchValue({
        confirmationCode: queryParams['confirmation']
      });
    }

    if (queryParams['email']) {
      this.accessForm.patchValue({
        contactMethod: 'email',
        email: queryParams['email']
      });
    } else if (queryParams['phone']) {
      this.accessForm.patchValue({
        contactMethod: 'phone',
        phone: queryParams['phone']
      });
    }
  }

  onSubmit() {
    if (this.accessForm.valid) {
      const credentials: BookingCredentials = {
        confirmationCode: this.accessForm.value.confirmationCode,
        email: this.accessForm.value.contactMethod === 'email' ? this.accessForm.value.email : undefined,
        phone: this.accessForm.value.contactMethod === 'phone' ? this.accessForm.value.phone : undefined
      };

      this.bookingAccessService.verifyBookingAccess(credentials)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (result) => {
            console.log('Booking access verified:', result);
          },
          error: (error) => {
            console.error('Booking access error:', error);
          }
        });
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched() {
    Object.keys(this.accessForm.controls).forEach(key => {
      const control = this.accessForm.get(key);
      control?.markAsTouched();
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.accessForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.accessForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) {
        return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
      }
      if (field.errors['email']) {
        return 'Please enter a valid email address';
      }
      if (field.errors['pattern']) {
        return 'Please enter a valid phone number';
      }
    }
    return '';
  }
}
