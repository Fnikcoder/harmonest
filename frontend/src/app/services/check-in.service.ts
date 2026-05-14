import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { delay, map, catchError } from 'rxjs/operators';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CheckInData, GuestIdDocument, BookingData } from '../interfaces/booking.interface';
import { ConfigService } from './config.service';

// API Response interfaces
export interface CheckInApiResponse {
  success: boolean;
  message: string;
  data: any;
  errorCode?: string;
  timestamp: number;
}

export interface ReservationValidationResponse extends CheckInApiResponse {
  data: {
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
  };
}

export interface CheckInSubmissionResponse extends CheckInApiResponse {
  data: {
    reservationCode: string;
    reservationId: string;
    status: 'completed';
    message: string;
    qrCodeDelivery: {
      timing: '24_hours_before' | '15_minutes';
      scheduledTime: number;
      checkInDate: number;
    };
  };
}

export interface CheckInStatusResponse extends CheckInApiResponse {
  data: {
    reservationCode: string;
    reservationId: string;
    status: 'pending' | 'completed';
    hasCheckedIn: boolean;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    canUpdate: boolean;
    createdAt: number;
    updatedAt: number;
  };
}

export interface IdScanResult {
  success: boolean;
  message: string;
  extractedData?: {
    firstName?: string;
    lastName?: string;
    documentNumber?: string;
    expiryDate?: Date;
    dateOfBirth?: Date;
    nationality?: string;
    gender?: string;
    address?: string;
  };
  confidence?: number;
}

export interface CheckInStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  active: boolean;
}

// Validation interfaces
export interface ReservationValidationRequest {
  reservationCode: string;
  guestFirstName: string;
}

export interface CheckInSubmissionRequest {
  reservationCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  idCardFile: string; // base64 encoded
  fileExtension: string;
}

@Injectable({
  providedIn: 'root'
})
export class CheckInService {
  private apiEndpoint: string = '';
  private apiConfig = {
    fileUpload: {
      maxSizeBytes: 5 * 1024 * 1024, // 5MB
      allowedFormats: ['JPEG', 'PNG', 'GIF', 'WebP'],
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    }
  };

  private checkInDataSubject = new BehaviorSubject<CheckInData | null>(null);
  private currentStepSubject = new BehaviorSubject<number>(1);
  private reservationDataSubject = new BehaviorSubject<any>(null);
  public uploadedIdFileSubject = new BehaviorSubject<{ file: string; extension: string } | null>(null);

  checkInData$ = this.checkInDataSubject.asObservable();
  currentStep$ = this.currentStepSubject.asObservable();
  reservationData$ = this.reservationDataSubject.asObservable();
  uploadedIdFile$ = this.uploadedIdFileSubject.asObservable();

  private checkInSteps: CheckInStep[] = [
    { id: 1, title: 'Booking Verification', description: 'Verify your booking details', completed: false, active: true },
    { id: 2, title: 'ID Scanning', description: 'Scan your identification document', completed: false, active: false },
    { id: 3, title: 'Guest Information', description: 'Confirm guest details', completed: false, active: false },
    { id: 4, title: 'Access Code', description: 'Receive your room access code', completed: false, active: false }
  ];



  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.initializeApiEndpoint();
  }

  private initializeApiEndpoint() {
    const config = this.configService.getConfig();
    if (config?.technical?.apis?.checkin?.baseUrl) {
      this.apiEndpoint = config.technical.apis.checkin.baseUrl;
    } else {
      // Subscribe to config changes
      this.configService.getConfigObservable().subscribe(loadedConfig => {
        if (loadedConfig?.technical?.apis?.checkin?.baseUrl) {
          this.apiEndpoint = loadedConfig.technical.apis.checkin.baseUrl;
        }
      });
    }
  }

  getCheckInSteps(): CheckInStep[] {
    return [...this.checkInSteps];
  }

  getCurrentStep(): number {
    return this.currentStepSubject.value;
  }

  setCurrentStep(step: number): void {
    this.currentStepSubject.next(step);
    this.updateStepStatus(step);
  }

  nextStep(): void {
    const currentStep = this.currentStepSubject.value;
    if (currentStep < this.checkInSteps.length) {
      this.setCurrentStep(currentStep + 1);
    }
  }

  previousStep(): void {
    const currentStep = this.currentStepSubject.value;
    if (currentStep > 1) {
      this.setCurrentStep(currentStep - 1);
    }
  }

  private updateStepStatus(activeStep: number): void {
    this.checkInSteps.forEach((step, index) => {
      step.active = step.id === activeStep;
      step.completed = step.id < activeStep;
    });
  }

  // API Methods
  validateReservation(reservationCode: string, guestFirstName: string): Observable<ReservationValidationResponse> {
    const request: ReservationValidationRequest = {
      reservationCode,
      guestFirstName
    };

    return this.http.post<ReservationValidationResponse>(this.apiEndpoint, {
      operation: 'validate',
      ...request
    }).pipe(
      catchError(this.handleError)
    );
  }

  submitCheckIn(submissionData: CheckInSubmissionRequest): Observable<CheckInSubmissionResponse> {
    const payload = {
      operation: 'submit',
      ...submissionData
    };

    return this.http.post<CheckInSubmissionResponse>(this.apiEndpoint, payload).pipe(
      catchError(this.handleError)
    );
  }

  getCheckInStatus(reservationCode: string): Observable<CheckInStatusResponse> {
    return this.http.get<CheckInStatusResponse>(`${this.apiEndpoint}?reservationCode=${reservationCode}`).pipe(
      catchError(this.handleError)
    );
  }

  private handleError = (error: HttpErrorResponse): Observable<never> => {

    // Handle different error scenarios based on API documentation
    let errorMessage = 'An error occurred during check-in process';
    let errorCode = 'UNKNOWN_ERROR';

    if (error.error) {
      errorMessage = error.error.message || errorMessage;
      errorCode = error.error.errorCode || errorCode;

      // Map common error codes to user-friendly messages
      switch (errorCode) {
        case 'RESERVATION_NOT_FOUND':
          errorMessage = 'Reservation not found. Please check your reservation code. If you have recently booked, please wait for 15 minutes for system update.';
          break;
        case 'INVALID_GUEST_NAME':
          errorMessage = 'Guest name does not match the reservation. Please check your first name.';
          break;
        case 'RESERVATION_CANCELED':
          errorMessage = 'This reservation has been canceled and cannot be used for check-in.';
          break;
        case 'CHECKIN_DEADLINE_PASSED':
          errorMessage = 'Check-in deadline has passed. Please contact support.';
          break;
        case 'INVALID_FILE':
          errorMessage = 'The uploaded file is invalid or too large. Please try again.';
          break;
        case 'MISSING_REQUIRED_FIELDS':
          errorMessage = 'Please fill in all required fields.';
          break;
      }
    }

    return throwError(() => ({
      success: false,
      message: errorMessage,
      errorCode: errorCode
    }));
  };

  // Updated verifyBooking method to use real API
  verifyBooking(reservationCode: string, guestFirstName: string): Observable<{ success: boolean; data?: any; message: string }> {
    return this.validateReservation(reservationCode, guestFirstName).pipe(
      map((response: ReservationValidationResponse) => {
        if (response.success) {
          // Store full data for later use
          this.reservationDataSubject.next(response.data);

          return {
            success: true,
            data: response.data,
            message: response.message
          };
        } else {
          return {
            success: false,
            message: response.message
          };
        }
      }),
      catchError((error) => {
        return of({
          success: false,
          message: error.message || 'Failed to verify reservation'
        });
      })
    );
  }

  // File upload utilities
  convertFileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (data:image/jpeg;base64,)
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  validateIdFile(file: File): { valid: boolean; error?: string } {
    // Check file size
    if (file.size > this.apiConfig.fileUpload.maxSizeBytes) {
      return { valid: false, error: `File size must be less than ${this.apiConfig.fileUpload.maxSizeBytes / (1024 * 1024)}MB` };
    }

    // Check file type
    if (!this.apiConfig.fileUpload.allowedMimeTypes.includes(file.type)) {
      return { valid: false, error: `File must be ${this.apiConfig.fileUpload.allowedFormats.join(', ')} format` };
    }

    return { valid: true };
  }

  getFileExtension(file: File): string {
    const type = file.type;
    switch (type) {
      case 'image/jpeg': return 'jpg';
      case 'image/png': return 'png';
      case 'image/gif': return 'gif';
      case 'image/webp': return 'webp';
      default: return 'jpg';
    }
  }

  // Store uploaded ID file for later submission
  setUploadedIdFile(file: File): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const validation = this.validateIdFile(file);
        if (!validation.valid) {
          reject(new Error(validation.error));
          return;
        }

        const base64 = await this.convertFileToBase64(file);
        const extension = this.getFileExtension(file);

        this.uploadedIdFileSubject.next({ file: base64, extension });
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  scanIdDocument(imageFile: File, documentType: 'passport' | 'national_id' = 'passport'): Observable<IdScanResult> {
    // Info extraction is currently disabled - just process the file upload
    return this.processFileUploadOnly(imageFile, documentType);
  }

  private processFileUploadOnly(imageFile: File, documentType: string): Observable<IdScanResult> {

    return of(null).pipe(
      delay(800), // Short delay to show processing
      map(() => {
        // Return success with no extraction data
        const result: IdScanResult = {
          success: true,
          message: 'ID document uploaded successfully. Please complete your information in the form below.',
          extractedData: undefined, // No extraction data
          confidence: 0.0 // No extraction performed
        };

        // Store the scanned document with minimal info
        const currentCheckIn = this.checkInDataSubject.value;
        if (currentCheckIn) {
          const idDocument: GuestIdDocument = {
            id: 'doc_' + Date.now(),
            type: documentType as 'passport' | 'national_id',
            documentNumber: '', // Will be filled by user
            expiryDate: new Date(), // Placeholder
            issuingCountry: '', // Will be filled by user
            extractedData: undefined,
            verificationStatus: 'pending',
            scannedAt: new Date(),
            scannedImageUrl: URL.createObjectURL(imageFile)
          };

          const updatedCheckIn: CheckInData = {
            ...currentCheckIn,
            checkInStatus: 'id_scanned',
            idDocuments: [...currentCheckIn.idDocuments, idDocument],
            updatedAt: new Date().toISOString()
          };

          this.checkInDataSubject.next(updatedCheckIn);
        }

        return result;
      })
    );
  }

  // Complete check-in with real API submission
  completeCheckInSubmission(guestData: { firstName: string; lastName: string; email: string; phone: string }): Observable<{ success: boolean; message: string; data?: any }> {
    const reservationData = this.reservationDataSubject.value;
    const uploadedFile = this.uploadedIdFileSubject.value;

    if (!reservationData) {
      return throwError(() => ({ success: false, message: 'No reservation data found. Please verify your booking first.' }));
    }

    if (!uploadedFile) {
      return throwError(() => ({ success: false, message: 'No ID document uploaded. Please scan your ID first.' }));
    }

    const submissionRequest: CheckInSubmissionRequest = {
      reservationCode: reservationData.reservation?.reservationCode || reservationData.reservationCode || 'UNKNOWN',
      firstName: guestData.firstName,
      lastName: guestData.lastName,
      email: guestData.email,
      phone: guestData.phone,
      idCardFile: uploadedFile.file,
      fileExtension: uploadedFile.extension
    };

    if (!this.apiEndpoint || this.apiEndpoint === '') {
      return throwError(() => new Error('Check-in API endpoint not configured'));
    }

    return this.submitCheckIn(submissionRequest).pipe(
      map((response: CheckInSubmissionResponse) => {
        if (response.success) {
          return {
            success: true,
            message: response.message,
            data: response.data
          };
        } else {
          return {
            success: false,
            message: response.message
          };
        }
      })
    );
  }



  // QR Code generation is now handled automatically by the API
  // No frontend method needed - QR codes are sent via email

  completeCheckIn(): void {
    const currentCheckIn = this.checkInDataSubject.value;
    if (currentCheckIn) {
      const updatedCheckIn: CheckInData = {
        ...currentCheckIn,
        checkInStatus: 'completed',
        updatedAt: new Date().toISOString()
      };
      this.checkInDataSubject.next(updatedCheckIn);
    }
  }

  resetCheckIn(): void {
    this.checkInDataSubject.next(null);
    this.reservationDataSubject.next(null);
    this.uploadedIdFileSubject.next(null);
    this.setCurrentStep(1);
  }

  getCurrentCheckInData(): CheckInData | null {
    return this.checkInDataSubject.value;
  }

  updateCheckInData(checkInData: CheckInData): void {
    this.checkInDataSubject.next(checkInData);
  }

  getReservationData(): any {
    return this.reservationDataSubject.value;
  }

  getUploadedIdFile(): { file: string; extension: string } | null {
    return this.uploadedIdFileSubject.value;
  }

  // Frontend validation methods
  validateEmail(email: string): { valid: boolean; error?: string } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      return { valid: false, error: 'Email is required' };
    }
    if (!emailRegex.test(email)) {
      return { valid: false, error: 'Please enter a valid email address' };
    }
    return { valid: true };
  }

  validatePhone(phone: string): { valid: boolean; error?: string } {
    // Phone validation - optional field that accepts multiple formats
    if (!phone || phone.trim() === '') {
      return { valid: true }; // Optional field - empty is valid
    }

    // Remove all spaces, dashes, parentheses, and dots for validation
    const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, '');

    // Phone number patterns to accept:
    // +4917647149968 (international with +)
    // 004917647149968 (international with 00)
    // 017647149968 (national format)
    // Must be between 10-15 digits after cleaning
    const phonePattern = /^(\+\d{1,3}|00\d{1,3}|0)?\d{9,14}$/;

    if (!phonePattern.test(cleanPhone)) {
      return {
        valid: false,
        error: 'Please enter a valid phone number (e.g., +49 176 47149968, 017647149968, 004917647149968)'
      };
    }

    return { valid: true };
  }

  validateReservationCode(code: string): { valid: boolean; error?: string } {
    if (!code) {
      return { valid: false, error: 'Reservation code is required' };
    }
    if (code.length < 5) {
      return { valid: false, error: 'Reservation code must be at least 5 characters' };
    }
    return { valid: true };
  }

  validateGuestName(name: string): { valid: boolean; error?: string } {
    if (!name) {
      return { valid: false, error: 'Guest name is required' };
    }
    if (name.length < 2) {
      return { valid: false, error: 'Name must be at least 2 characters' };
    }
    return { valid: true };
  }

  // Info extraction is currently disabled
  // OCR functionality can be re-enabled by updating the scanIdDocument method
}
