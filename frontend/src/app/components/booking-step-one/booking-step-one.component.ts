import { Component, OnInit, OnDestroy, HostListener, AfterViewInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { BookingService } from '../../services/booking.service';
import { EmailVerificationService } from '../../services/email-verification.service';
import { GuestDetails, BookingDateRange, BookingGuest } from '../../interfaces/booking.interface';
import { Subject, takeUntil } from 'rxjs';
import * as feather from 'feather-icons';

// Custom components
import { CustomDatepickerComponent } from '../custom-datepicker/custom-datepicker.component';
import { EmailVerificationComponent } from '../email-verification/email-verification.component';

@Component({
  selector: 'app-booking-step-one',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DatePipe,
    CustomDatepickerComponent,
    EmailVerificationComponent
  ],
  templateUrl: './booking-step-one.component.html',
  styleUrl: './booking-step-one.component.scss'
})
export class BookingStepOneComponent implements OnInit, OnDestroy, AfterViewInit {
  guestForm: FormGroup;
  showGuestDropdown = false;
  showDatepicker = false;
  guests: BookingGuest = { rooms: 1, adults: 1, children: 0 };
  isEmailVerified = false;
  currentEmail = '';
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private bookingService: BookingService,
    private emailVerificationService: EmailVerificationService
  ) {
    this.guestForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^\+?[\d\s\-\(\)]+$/)]],
      specialRequests: [''],
      dateRange: this.fb.group({
        start: [null, Validators.required],
        end: [null, Validators.required]
      })
    });
  }

  ngOnInit(): void {
    // Load existing booking data if available
    this.bookingService.bookingData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        if (data.guestDetails) {
          this.guestForm.patchValue({
            firstName: data.guestDetails.firstName,
            lastName: data.guestDetails.lastName,
            email: data.guestDetails.email,
            phone: data.guestDetails.phone,
            specialRequests: data.guestDetails.specialRequests
          });
        }

        if (data.dateRange) {
          this.guestForm.get('dateRange')?.patchValue({
            start: data.dateRange.start,
            end: data.dateRange.end
          });
        }

        if (data.guests) {
          this.guests = { ...data.guests };
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    feather.replace();
  }

  get dateRangeGroup(): FormGroup {
    return this.guestForm.get('dateRange') as FormGroup;
  }

  adjustGuests(type: 'rooms' | 'adults' | 'children', change: number): void {
    const newValue = this.guests[type] + change;
    if (newValue < 0) return;
    if (type === 'adults' && newValue < 1) return; // At least 1 adult required
    if (type === 'rooms' && newValue < 1) return; // At least 1 room required

    this.guests[type] = newValue;
    this.updateBookingData();
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.guest-selector')) {
      this.showGuestDropdown = false;
    }
  }

  onDateRangeChange(): void {
    this.updateBookingData();
  }

  openDatepicker(): void {
    this.showDatepicker = true;
  }

  closeDatepicker(): void {
    this.showDatepicker = false;
  }

  onDateRangeSelected(dateRange: { start: Date | null; end: Date | null }): void {
    this.guestForm.get('dateRange')?.patchValue({
      start: dateRange.start,
      end: dateRange.end
    });
    this.updateBookingData();
  }

  private updateBookingData(): void {
    if (this.guestForm.valid) {
      const formValue = this.guestForm.value;

      const guestDetails: GuestDetails = {
        firstName: formValue.firstName,
        lastName: formValue.lastName,
        email: formValue.email,
        phone: formValue.phone,
        specialRequests: formValue.specialRequests
      };

      const dateRange: BookingDateRange = {
        start: formValue.dateRange.start,
        end: formValue.dateRange.end
      };

      this.bookingService.updateGuestDetails(guestDetails);
      this.bookingService.updateDateRange(dateRange);
      this.bookingService.updateGuests(this.guests);
    }
  }

  onNext(): void {
    if (this.guestForm.valid && this.isEmailVerified) {
      this.updateBookingData();
      // Mark step 1 as completed before moving to next step
      this.bookingService.markStepCompleted(1);
      this.bookingService.nextStep();
    } else {
      // Mark all fields as touched to show validation errors
      this.guestForm.markAllAsTouched();

      if (!this.isEmailVerified) {
        // Show email verification requirement
        console.log('Email verification required');
      }
    }
  }

  onEmailVerificationStatusChange(isVerified: boolean): void {
    this.isEmailVerified = isVerified;
    // Update booking service with verification status
    if (isVerified && this.currentEmail) {
      this.bookingService.updateEmailVerificationStatus(this.currentEmail, isVerified);
    }
  }

  onVerifiedEmailChange(email: string): void {
    this.currentEmail = email;
  }

  get canProceed(): boolean {
    return this.guestForm.valid && this.isEmailVerified;
  }

  get emailForVerification(): string {
    return this.guestForm.get('email')?.value || '';
  }

  // Helper methods for validation
  isFieldInvalid(fieldName: string): boolean {
    const field = this.guestForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.guestForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['email']) return 'Please enter a valid email';
      if (field.errors['minlength']) return `${fieldName} must be at least ${field.errors['minlength'].requiredLength} characters`;
      if (field.errors['pattern']) return 'Please enter a valid phone number';
    }
    return '';
  }
}
