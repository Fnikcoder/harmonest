import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { CheckInComponent } from './check-in.component';
import { CheckInService } from '../../services/check-in.service';
import { EmailVerificationService } from '../../services/email-verification.service';

describe('CheckInComponent', () => {
  let component: CheckInComponent;
  let fixture: ComponentFixture<CheckInComponent>;
  let mockCheckInService: jasmine.SpyObj<CheckInService>;
  let mockEmailVerificationService: jasmine.SpyObj<EmailVerificationService>;

  beforeEach(async () => {
    const checkInServiceSpy = jasmine.createSpyObj('CheckInService', ['verifyBooking', 'completeCheckInSubmission', 'setUploadedIdFile']);
    const emailVerificationServiceSpy = jasmine.createSpyObj('EmailVerificationService', ['resetVerification']);

    // Mock the observables
    checkInServiceSpy.reservationData$ = of(null);
    checkInServiceSpy.uploadedIdFileSubject = { next: jasmine.createSpy() };
    emailVerificationServiceSpy.verificationState$ = of({
      email: '',
      isVerified: false,
      verificationSent: false,
      verificationCode: '',
      sentAt: null,
      attempts: 0,
      maxAttempts: 3,
      cooldownUntil: null
    });

    await TestBed.configureTestingModule({
      imports: [CheckInComponent, ReactiveFormsModule],
      providers: [
        { provide: CheckInService, useValue: checkInServiceSpy },
        { provide: EmailVerificationService, useValue: emailVerificationServiceSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({})
          }
        }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CheckInComponent);
    component = fixture.componentInstance;
    mockCheckInService = TestBed.inject(CheckInService) as jasmine.SpyObj<CheckInService>;
    mockEmailVerificationService = TestBed.inject(EmailVerificationService) as jasmine.SpyObj<EmailVerificationService>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with email verification disabled', () => {
    expect(component.isEmailVerified).toBeFalse();
    expect(component.verifiedEmail).toBe('');
  });

  it('should require email verification for step 2 validation', () => {
    // Set up valid form data
    component.checkInForm.patchValue({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      agbAccepted: true,
      privacyAccepted: true
    });
    component.uploadedIdFile = new File([''], 'test.jpg');

    // Without email verification
    expect(component.isStep2Valid()).toBeFalse();

    // With email verification
    component.isEmailVerified = true;
    expect(component.isStep2Valid()).toBeTrue();
  });

  it('should handle email verification status change', () => {
    component.submissionMessage = 'Error message';
    component.submissionMessageType = 'error';

    component.onEmailVerificationStatusChange(true);

    expect(component.isEmailVerified).toBeTrue();
    expect(component.submissionMessage).toBe('');
  });

  it('should handle verified email change', () => {
    const testEmail = 'verified@example.com';

    component.onVerifiedEmailChange(testEmail);

    expect(component.verifiedEmail).toBe(testEmail);
  });

  it('should reset email verification on resetCheckIn', () => {
    component.isEmailVerified = true;
    component.verifiedEmail = 'test@example.com';

    component.resetCheckIn();

    expect(component.isEmailVerified).toBeFalse();
    expect(component.verifiedEmail).toBe('');
    expect(mockEmailVerificationService.resetVerification).toHaveBeenCalled();
  });
});
