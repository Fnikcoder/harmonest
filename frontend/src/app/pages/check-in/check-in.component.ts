import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import feather from 'feather-icons';

import { NavbarComponent } from '../../components/navbar/navbar.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { SwitcherComponent } from '../../components/switcher/switcher.component';
import { IdScannerComponent } from '../../components/id-scanner/id-scanner.component';
import { EmailVerificationComponent } from '../../components/email-verification/email-verification.component';

import { CheckInService, IdScanResult, CheckInStep } from '../../services/check-in.service';
import { CheckInData, BookingData } from '../../interfaces/booking.interface';
import { EmailVerificationService } from '../../services/email-verification.service';

@Component({
  selector: 'app-check-in',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NavbarComponent,
    FooterComponent,
    SwitcherComponent,
    IdScannerComponent,
    EmailVerificationComponent
  ],
  templateUrl: './check-in.component.html',
  styleUrl: './check-in.component.scss'
})
export class CheckInComponent implements OnInit, OnDestroy, AfterViewInit {
  // Two-step process
  currentStep = 1;

  // Forms
  validationForm: FormGroup;
  checkInForm: FormGroup;

  // Document scanning
  selectedDocumentType: 'passport' | 'national_id' = 'national_id';
  uploadedIdFile: File | null = null;
  imagePreviewUrl: string | null = null;

  // Loading states
  isValidating = false;
  isSubmittingCheckIn = false;

  // Messages
  validationMessage: string = '';
  validationMessageType: 'success' | 'error' | 'info' = 'info';
  submissionMessage: string = '';
  submissionMessageType: 'success' | 'error' | 'info' = 'info';

  // Email verification
  isEmailVerified = false;
  verifiedEmail = '';

  // Reservation data (after validation) - full response data
  reservationData: {
    reservation: {
      reservationCode: string;
      reservationId: string;
      checkInDate: number;
      checkOutDate: number;
      roomName: string;
      roomAlias: string;
      originalGuestName: string;
      originalGuestSurname: string;
      originalEmail: string;
      originalPhoneNumber: string;
    };
    checkin: {
      exists: boolean;
      status: 'pending' | 'completed';
      canUpdate: boolean;
      requiresGuestInfo: boolean;
      currentFirstName: string;
      currentLastName: string;
      currentEmail: string;
      currentPhone: string;
    };
  } | null = null;

  // Cleanup
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private checkInService: CheckInService,
    private route: ActivatedRoute,
    private emailVerificationService: EmailVerificationService
  ) {
    // Step 1: Validation form (name must match part of booking guest full name on server)
    this.validationForm = this.fb.group({
      reservationCode: ['', [Validators.required, Validators.minLength(5)]],
      guestNameHint: ['', [Validators.required, Validators.minLength(2)]]
    });

    // Step 2: Complete check-in form
    this.checkInForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [this.phoneValidator]], // Optional phone with flexible format validation
      agbAccepted: [false, Validators.requiredTrue],
      privacyAccepted: [false, Validators.requiredTrue]
    });
  }

  ngOnInit(): void {
    // Handle URL parameters for pre-filling
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(queryParams => {
      if (queryParams['reservationCode']) {
        this.validationForm.patchValue({
          reservationCode: queryParams['reservationCode']
        });
      }
      const namePrefill =
        queryParams['guestName'] || queryParams['guestFirstName'] || queryParams['firstName'];
      if (namePrefill) {
        this.validationForm.patchValue({
          guestNameHint: namePrefill
        });
      }
    });

    // Subscribe to reservation data changes
    this.checkInService.reservationData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.reservationData = data;
        if (data && this.currentStep === 1) {
          // Pre-fill step 2 form based on check-in status
          let firstName = '';
          let lastName = '';
          let email = '';
          let phone = '';

          if (data.checkin.status === 'completed') {
            // Use current check-in data if already completed
            firstName = data.checkin.currentFirstName || '';
            lastName = data.checkin.currentLastName || '';
            email = data.checkin.currentEmail || '';
            phone = data.checkin.currentPhone || '';
          } else {
            // Use original reservation data if pending
            firstName = data.reservation.originalGuestName || '';
            lastName = data.reservation.originalGuestSurname || '';
            email =  '';
            phone = data.reservation.originalPhoneNumber || '';
          }

          this.checkInForm.patchValue({
            firstName,
            lastName,
            email,
            phone
          });
        }
      });

    // Watch for email field changes to reset verification
    this.checkInForm.get('email')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(email => {
        if (email !== this.verifiedEmail) {
          this.isEmailVerified = false;
          this.verifiedEmail = '';
          this.emailVerificationService.resetVerification();
        }
      });
  }

  // Step 1: Validate reservation
  validateReservation(): void {
    if (this.validationForm.invalid) {
      this.validationForm.markAllAsTouched();
      return;
    }

    const { reservationCode, guestNameHint } = this.validationForm.value;
    this.isValidating = true;
    this.validationMessage = '';

    this.checkInService.verifyBooking(reservationCode, guestNameHint)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.isValidating = false;
          if (result.success && result.data) {
            this.validationMessage = 'Reservation verified successfully!';
            this.validationMessageType = 'success';
            this.reservationData = result.data;

            // When API gives you a document:
            const docs = result.data.checkin?.documents;
            if (docs && docs.length > 0 && docs[0].fileData) {
              // normalize mime (jpg → jpeg)
              const ext = (docs[0].fileExtension || 'jpeg').toLowerCase();
              const mime = ext === 'jpg' ? 'jpeg' : ext;

              this.imagePreviewUrl = `data:image/${mime};base64,${docs[0].fileData}`;
            }

            // Move to step 2 after a short delay
            setTimeout(() => {
              this.currentStep = 2;
              // Refresh icons when moving to step 2
              this.refreshFeatherIcons();
            }, 1500);
          } else {
            this.validationMessage = result.message;
            this.validationMessageType = 'error';
          }
        },
        error: (error) => {
          this.isValidating = false;
          this.validationMessage = error.message || 'Failed to verify reservation. Please try again.';
          this.validationMessageType = 'error';
        }
      });
  }

  // Step 2: Complete check-in process
  submitCheckIn(): void {
    // Clear any previous submission messages
    this.submissionMessage = '';

    // Check individual validation conditions
    if (this.checkInForm.invalid) {
      this.checkInForm.markAllAsTouched();
      this.submissionMessage = 'Please fill in all required fields correctly.';
      this.submissionMessageType = 'error';
      return;
    }

    if (!this.uploadedIdFile) {
      this.submissionMessage = 'Please scan your ID document first';
      this.submissionMessageType = 'error';
      return;
    }

    if (!this.isEmailVerified) {
      this.submissionMessage = 'Please verify your email address before proceeding';
      this.submissionMessageType = 'error';
      return;
    }

    const formData = this.checkInForm.value;
    this.isSubmittingCheckIn = true;
    this.submissionMessage = '';

    // Submit the complete check-in (reservation already validated in step 1)
    const guestData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: this.verifiedEmail || formData.email, // Use verified email
      phone: formData.phone
    };

    this.checkInService.completeCheckInSubmission(guestData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.isSubmittingCheckIn = false;
          if (result.success) {
            this.submissionMessage = result.data?.message || result.message;
            this.submissionMessageType = 'success';
          } else {
            this.submissionMessage = result.message;
            this.submissionMessageType = 'error';
          }

          // Refresh icons after submission
          setTimeout(() => {
            this.refreshFeatherIcons();
          }, 100);
        },
        error: (error) => {
          this.isSubmittingCheckIn = false;

          // Handle different types of errors
          let errorMessage = 'Failed to complete check-in. Please try again.';

          if (error.status === 400) {
            errorMessage = 'Invalid request. Please check your information and try again.';
          } else if (error.status === 0 || error.status === undefined) {
            errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
          } else if (error.message) {
            errorMessage = error.message;
          } else if (error.error?.message) {
            errorMessage = error.error.message;
          }

          this.submissionMessage = errorMessage;
          this.submissionMessageType = 'error';

          // Refresh icons after error
          setTimeout(() => {
            this.refreshFeatherIcons();
          }, 100);
        }
      });
  }

  // ID Document handling
  onDocumentTypeChange(type: 'passport' | 'national_id'): void {
    this.selectedDocumentType = type;
  }

  onIdScanComplete(result: any): void {
    if (result.success) {
      // Use the actual captured/uploaded file from the scanner
      if (result.capturedFile) {
        this.uploadedIdFile = result.capturedFile;

        // Create image preview URL from the actual file
        const reader = new FileReader();
        reader.onload = (e) => {
          this.imagePreviewUrl = e.target?.result as string;
        };
        reader.onerror = (error) => {
          // Handle error silently
        };

        // Only read the file if it's not null
        if (this.uploadedIdFile) {
          reader.readAsDataURL(this.uploadedIdFile);
        }
      }

      // Store the file for submission
      if (this.uploadedIdFile) {
        this.checkInService.setUploadedIdFile(this.uploadedIdFile);
      }

      // Refresh icons after scan completion
      setTimeout(() => {
        this.refreshFeatherIcons();
      }, 100);
    }
  }

  onIdScanError(error: string): void {
    // Handle ID scan error silently
  }

  getImagePreview(): string {
    if (this.imagePreviewUrl) {
      return this.imagePreviewUrl;
    }

    // Return a placeholder SVG if no image is available
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JRCBEb2N1bWVudDwvdGV4dD48L3N2Zz4=';
  }

  removeUploadedImage(): void {
    // Clean up the image preview URL if it's a blob URL
    if (this.imagePreviewUrl && this.imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.imagePreviewUrl);
    }

    this.uploadedIdFile = null;
    this.imagePreviewUrl = null;
    this.checkInService.uploadedIdFileSubject.next(null);

    // Refresh icons after image removal
    setTimeout(() => {
      this.refreshFeatherIcons();
    }, 100);
  }



  // Navigation methods
  goToStep(step: number): void {
    if (step === 1 || (step === 2 && this.reservationData)) {
      this.currentStep = step;
      this.validationMessage = '';
      this.submissionMessage = '';

      // Refresh icons when step changes
      setTimeout(() => {
        this.refreshFeatherIcons();
      }, 100);
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;

      // Refresh icons when step changes
      setTimeout(() => {
        this.refreshFeatherIcons();
      }, 100);
    }
  }

  // Email verification handlers
  onEmailVerificationStatusChange(isVerified: boolean): void {
    this.isEmailVerified = isVerified;

    // Clear submission message when verification status changes
    if (this.submissionMessage && this.submissionMessageType === 'error') {
      this.submissionMessage = '';
    }
  }

  onVerifiedEmailChange(email: string): void {
    this.verifiedEmail = email;
  }

  // Form validation
  isStep1Valid(): boolean {
    return this.validationForm.valid && !!this.reservationData;
  }

  isStep2Valid(): boolean {
    if (!this.checkInForm) {
      return false;
    }

    const formValid = this.checkInForm.valid;
    const fileUploaded = !!this.uploadedIdFile;
    const emailVerified = this.isEmailVerified;

    return formValid && fileUploaded && emailVerified;
  }

  private getFormErrors(): any {
    if (!this.checkInForm) {
      return {};
    }

    const errors: any = {};
    Object.keys(this.checkInForm.controls).forEach(key => {
      const control = this.checkInForm.get(key);
      if (control && control.errors) {
        errors[key] = control.errors;
      }
    });
    return errors;
  }



  // Utility methods
  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatCheckInTime(timestamp: number): string {
    const date = new Date(timestamp);
    const checkInDate = new Date(date);
    checkInDate.setHours(14, 0, 0, 0); // 14:00
    return checkInDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }) + ' at 14:00';
  }

  formatCheckOutTime(timestamp: number): string {
    const date = new Date(timestamp);
    const checkOutDate = new Date(date);
    checkOutDate.setHours(11, 0, 0, 0); // 11:00
    return checkOutDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }) + ' until 11:00';
  }

  resetCheckIn(): void {
    // Clean up the image preview URL if it's a blob URL
    if (this.imagePreviewUrl && this.imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.imagePreviewUrl);
    }

    // Reset component state
    this.currentStep = 1;
    this.validationForm.reset();
    this.checkInForm.reset();
    this.uploadedIdFile = null;
    this.imagePreviewUrl = null;
    this.reservationData = null;
    this.validationMessage = '';
    this.submissionMessage = '';
    this.isEmailVerified = false;
    this.verifiedEmail = '';

    // Reset services using proper service methods
    this.checkInService.resetCheckIn();
    this.emailVerificationService.resetVerification();

    // Refresh icons after reset
    setTimeout(() => {
      this.refreshFeatherIcons();
    }, 100);
  }

  ngAfterViewInit(): void {
    // Initialize Feather icons
    this.refreshFeatherIcons();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private refreshFeatherIcons(): void {
    // Use multiple timeouts to ensure icons are replaced properly
    setTimeout(() => {
      feather.replace();
    }, 50);

    setTimeout(() => {
      feather.replace();
    }, 200);

    setTimeout(() => {
      feather.replace();
    }, 500);
  }

  // Custom phone validator that accepts multiple formats and is optional
  private phoneValidator = (control: any) => {
    const value = control.value;

    // If empty, it's valid (optional field)
    if (!value || value.trim() === '') {
      return null;
    }

    // Remove all spaces, dashes, parentheses, and dots for validation
    const cleanPhone = value.replace(/[\s\-\(\)\.]/g, '');

    // Phone number patterns to accept:
    // +4917647149968 (international with +)
    // 004917647149968 (international with 00)
    // 017647149968 (national format)
    // Must be between 10-15 digits after cleaning
    const phonePattern = /^(\+\d{1,3}|00\d{1,3}|0)?\d{9,14}$/;

    if (phonePattern.test(cleanPhone)) {
      return null; // Valid
    }

    return {
      invalidPhone: {
        value: value,
        message: 'Please enter a valid phone number (e.g., +49 176 47149968, 017647149968, 004917647149968)'
      }
    };
  }


}
