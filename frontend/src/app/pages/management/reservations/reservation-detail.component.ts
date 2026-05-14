import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ManagementDataService, ReservationData } from '../shared/management-data.service';
import { getBookingSourceInfo, BookingSource } from '../shared/booking-source.utils';
import * as feather from 'feather-icons';
import { QrCodeComponent } from '../../../components/qr-code/qr-code.component';
import { S3DocumentService } from '../../../services/s3-document.service';

@Component({
  selector: 'app-reservation-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, QrCodeComponent],
  template: `
    <div class="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <!-- Header with Back Button -->
      <div class="mb-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <button (click)="goBack()"
                    class="flex items-center px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              <i data-feather="arrow-left" class="size-4 mr-2"></i>
              Back
            </button>
          </div>

          <div class="flex items-center space-x-3">
            <button (click)="saveChanges()"
                    [disabled]="!hasChanges || saving"
                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
              <i data-feather="save" class="size-4 mr-2"></i>
              {{saving ? 'Saving...' : 'Save Changes'}}
            </button>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="loading" class="flex items-center justify-center py-12">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p class="text-gray-600 dark:text-gray-400">Loading reservation details...</p>
        </div>
      </div>

      <!-- Error State -->
      <div *ngIf="error && !loading" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
        <div class="flex items-center">
          <i data-feather="alert-circle" class="size-5 text-red-600 dark:text-red-400 mr-2"></i>
          <p class="text-red-800 dark:text-red-200">{{error}}</p>
        </div>
      </div>

      <!-- Reservation Details -->
      <div *ngIf="reservation && !loading" class="space-y-6">
        <!-- Basic Information Card -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <i data-feather="info" class="size-5 mr-2 text-blue-600 dark:text-blue-400"></i>
            Reservation Information
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reservation Code</label>
              <p class="text-lg font-mono text-gray-900 dark:text-white">{{reservation.reservationCode}}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Guest Name</label>
              <p class="text-lg text-gray-900 dark:text-white">{{reservation.guestName}} {{reservation.guestSurname}}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <p class="text-lg text-gray-900 dark:text-white">{{reservation.email}}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
              <p class="text-lg text-gray-900 dark:text-white">{{reservation.phoneNumber}}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Room</label>
              <p class="text-lg text-gray-900 dark:text-white">{{reservation.roomName}} ({{reservation.roomAlias}})</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Booking Source</label>
              <div class="flex items-center space-x-2">
                <span
                  class="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium"
                  [class]="getBookingSourceClasses(reservation.bookingSource)"
                  [title]="getBookingSourceInfo(reservation.bookingSource)?.name">
                  <i
                    [attr.data-feather]="getBookingSourceInfo(reservation.bookingSource)?.icon"
                    class="size-3 mr-1"
                    [class]="getBookingSourceInfo(reservation.bookingSource)?.color">
                  </i>
                  {{ getBookingSourceInfo(reservation.bookingSource)?.name }}
                </span>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <span class="inline-flex px-2 py-1 text-sm font-medium rounded-full"
                    [class]="getStatusClass(reservation.status)">
                {{getStatusText(reservation.status)}}
              </span>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Check-in Date</label>
              <p class="text-lg text-gray-900 dark:text-white">{{formatDate(reservation.checkInDate)}}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Check-out Date</label>
              <p class="text-lg text-gray-900 dark:text-white">{{formatDate(reservation.checkOutDate)}}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nights</label>
              <p class="text-lg text-gray-900 dark:text-white">{{reservation.nights}}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Guests</label>
              <p class="text-lg text-gray-900 dark:text-white">
                {{reservation.numOfAdults}} Adults
                <span *ngIf="reservation.numOfKids > 0">, {{reservation.numOfKids}} Kids</span>
                <span *ngIf="reservation.numOfInfants > 0">, {{reservation.numOfInfants}} Infants</span>
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price</label>
              <p class="text-lg font-semibold text-gray-900 dark:text-white">{{reservation.price}} {{reservation.currency}}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Check-in Status</label>
              <span class="inline-flex px-2 py-1 text-sm font-medium rounded-full"
                    [class]="getCheckinStatusClass(reservation.checkinStatus)">
                {{getCheckinStatusText(reservation.checkinStatus)}}
              </span>
            </div>
          </div>
        </div>

        <!-- Door Access Information Card -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <i data-feather="key" class="size-5 mr-2 text-purple-600 dark:text-purple-400"></i>
            Door Access Information
          </h2>

          <div *ngIf="getDoorAccessInfo(); let doorAccess" class="space-y-4">
            <!-- Access Status -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Access Status</label>
                <span class="inline-flex px-2 py-1 text-sm font-medium rounded-full"
                      [class]="getDoorAccessStatusClass(doorAccess.status)">
                  {{getDoorAccessStatusText(doorAccess.status)}}
                </span>
              </div>

              <div *ngIf="doorAccess.generatedAt">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Generated At</label>
                <p class="text-lg text-gray-900 dark:text-white">{{formatDate(doorAccess.generatedAt)}}</p>
              </div>

              <div *ngIf="doorAccess.doorInfo">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Doors</label>
                <p class="text-lg text-gray-900 dark:text-white">{{doorAccess.doorInfo.total_doors || 0}}</p>
              </div>
            </div>

            <!-- Door Details -->
            <div *ngIf="doorAccess.doorInfo" class="mt-6">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Door Details</h3>

              <!-- QR Doors -->
              <div *ngIf="doorAccess.doorInfo.qr_doors && doorAccess.doorInfo.qr_doors.length > 0" class="mb-8">
                <h4 class="text-md font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                  <i data-feather="smartphone" class="size-4 mr-2"></i>
                  QR Code Doors
                </h4>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div *ngFor="let door of doorAccess.doorInfo.qr_doors"
                       class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <p class="font-medium text-blue-900 dark:text-blue-100">{{door.name || door.id}}</p>
                    <app-qr-code
                      [qrCodeData]="doorAccess.qrCode"
                      [size]="256"
                      [filename]="'door-access-qr'"
                      [emptyMessage]="'Invalid QR code data'">
                    </app-qr-code>
                    <p class="font-mono text-sm text-gray-900 dark:text-white break-all">QR Code: {{doorAccess.qrCode}}</p>

                    <p *ngIf="door.readerId" class="text-sm text-blue-700 dark:text-blue-300">Reader: {{door.readerId}}</p>
                  </div>
                </div>
              </div>

              <!-- PIN Doors -->
              <div *ngIf="doorAccess.doorInfo.pin_doors && doorAccess.doorInfo.pin_doors.length > 0" class="mt-4">
                <h4 class="text-md font-medium text-gray-700 dark:text-gray-300 flex items-center">
                  <i data-feather="hash" class="size-4 mr-2"></i>
                  PIN Code Doors
                </h4>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div *ngIf="doorAccess.pinCodes && hasPinCodes(doorAccess.pinCodes)" class="mt-2">
                    <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div *ngFor="let pinCode of getPinCodesArray(doorAccess.pinCodes)" class="flex justify-between items-center">
                          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{pinCode.door}}:</span>
                          <span class="font-mono text-lg text-gray-900 dark:text-white">{{pinCode.code}}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- PIN Codes -->


            <!-- Usage History -->
            <div *ngIf="doorAccess.usageHistory && doorAccess.usageHistory.length > 0" class="mt-6">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Usage History</h3>
              <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div class="space-y-2">
                  <div *ngFor="let usage of doorAccess.usageHistory" class="flex justify-between items-center text-sm">
                    <span class="text-gray-700 dark:text-gray-300">{{usage.door || 'Unknown Door'}}</span>
                    <span class="text-gray-500 dark:text-gray-400">{{formatDate(usage.timestamp)}}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Admin: Resend Door Access Email -->
          <div class="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                  <i data-feather="send" class="size-4 mr-2 text-blue-600 dark:text-blue-400"></i>
                  Resend Door Access Email
                </h3>
                <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Send the existing door access (QR / PIN) again to the guest or another email.
                </p>
              </div>
            </div>

            <form class="max-w-xl space-y-2" (ngSubmit)="onResendDoorAccess()">
              <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">
                Target Email Address
              </label>
              <div class="flex gap-2">
                <input
                  type="email"
                  [(ngModel)]="resendDoorAccessEmail"
                  name="resendDoorAccessEmail"
                  class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  [placeholder]="reservation?.email || 'guest@example.com'"
                  required
                />
                <button
                  type="submit"
                  [disabled]="!resendDoorAccessEmail || resendingDoorAccess || !getDoorAccessInfo()"
                  class="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
                  <i data-feather="send" class="size-4 mr-2"></i>
                  {{ resendingDoorAccess ? 'Sending...' : 'Resend' }}
                </button>
              </div>
              <p *ngIf="getDoorAccessInfo()"
                 class="text-[11px] text-gray-500 dark:text-gray-400">
                Uses the door access data already stored for this reservation. No new codes are generated.
              </p>
              <p *ngIf="!getDoorAccessInfo()"
                 class="text-[11px] text-gray-500 dark:text-gray-400">
                Door access has not been generated yet, so there is nothing to resend.
              </p>
            </form>
          </div>
        </div>

        <!-- Check-in Custom Fields Card -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <i data-feather="edit-3" class="size-5 mr-2 text-green-600 dark:text-green-400"></i>
            Check-in Information
            <span class="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">(Editable)</span>
          </h2>

          <!-- ID Documents Section -->
          <div *ngIf="getIdDocuments().length > 0" class="mb-6">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
              <i data-feather="file-text" class="size-4 mr-2"></i>
              ID Documents
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div *ngFor="let document of getIdDocuments()"
                   class="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {{getDocumentTypeText(document.type)}}
                  </span>
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    {{formatDate(document.uploadedAt)}}
                  </span>
                </div>

                <!-- Document Preview -->
                <div class="mb-3">
                  <div class="w-full h-32 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center overflow-hidden">
                    <img *ngIf="document.s3Key"
                         [src]="getDocumentPreviewUrl(document.s3Key)"
                         [attr.data-s3-key]="document.s3Key"
                         [alt]="document.fileName"
                         class="w-full h-full object-cover cursor-pointer"
                         (click)="viewDocument(document.s3Key)"
                         (error)="onImageError($event)">
                    <div *ngIf="!document.s3Key" class="text-gray-400 text-center">
                      <i data-feather="file" class="size-8 mx-auto mb-1"></i>
                      <p class="text-xs">No preview</p>
                    </div>
                  </div>
                </div>

                <p class="text-xs text-gray-600 dark:text-gray-400 mb-2">{{document.fileName}}</p>
                <button *ngIf="document.s3Key"
                        (click)="viewDocument(document.s3Key)"
                        class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  <i data-feather="eye" class="size-3 mr-1"></i>
                  View Document
                </button>
                <p *ngIf="!document.s3Key" class="text-xs text-gray-500 dark:text-gray-400">
                  Document not available
                </p>
              </div>
            </div>
          </div>

          <form [formGroup]="customFieldsForm" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label for="mainGuestEmail" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Main Guest Email
                </label>
                <input type="email"
                       id="mainGuestEmail"
                       formControlName="mainGuestEmail"
                       class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                       placeholder="main.guest@example.com">
              </div>

              <div>
                <label for="mainGuestFirstname" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Main Guest First Name
                </label>
                <input type="text"
                       id="mainGuestFirstname"
                       formControlName="mainGuestFirstname"
                       class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                       placeholder="First name">
              </div>

              <div>
                <label for="mainGuestLastname" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Main Guest Last Name
                </label>
                <input type="text"
                       id="mainGuestLastname"
                       formControlName="mainGuestLastname"
                       class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                       placeholder="Last name">
              </div>

              <div>
                <label for="mainGuestPhoneNumber" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Main Guest Phone Number
                </label>
                <input type="tel"
                       id="mainGuestPhoneNumber"
                       formControlName="mainGuestPhoneNumber"
                       class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                       placeholder="+1234567890">
              </div>
            </div>

            <!-- Save Button -->
            <div class="flex justify-end pt-4">
              <button type="button"
                      (click)="saveChanges()"
                      [disabled]="!hasChanges || saving"
                      class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
                <i data-feather="save" class="size-4 mr-2"></i>
                {{saving ? 'Saving...' : 'Save Check-in Information'}}
              </button>
            </div>
          </form>
        </div>

        <!-- Success Message -->
        <div *ngIf="successMessage" class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div class="flex items-center">
            <i data-feather="check-circle" class="size-5 text-green-600 dark:text-green-400 mr-2"></i>
            <p class="text-green-800 dark:text-green-200">{{successMessage}}</p>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ReservationDetailComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  reservation: ReservationData | null = null;
  customFieldsForm: FormGroup;
  loading = false;
  saving = false;
   // Door access resend state
  resendingDoorAccess = false;
  resendDoorAccessEmail = '';
  error: string | null = null;
  successMessage: string | null = null;
  hasChanges = false;

  private reservationId: string | null = null;

  // Add to component properties
  documentPreviews: { [key: string]: string } = {};
  loadingPreviews: { [key: string]: boolean } = {};

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dataService: ManagementDataService,
    private fb: FormBuilder,
    private s3DocumentService: S3DocumentService
  ) {
    this.customFieldsForm = this.fb.group({
      mainGuestEmail: [''],
      mainGuestFirstname: [''],
      mainGuestLastname: [''],
      mainGuestPhoneNumber: ['']
    });

    // Track form changes
    this.customFieldsForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.hasChanges = this.customFieldsForm.dirty;
        this.clearMessages();
      });
  }

  ngOnInit(): void {
    this.reservationId = this.route.snapshot.paramMap.get('id');
    if (this.reservationId) {
      this.loadReservation();
    } else {
      this.error = 'No reservation ID provided';
    }
    this.initializeFeatherIcons();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeFeatherIcons(): void {
    setTimeout(() => {
      feather.replace();
    }, 100);
  }

  private loadReservation(): void {
    if (!this.reservationId) return;

    this.loading = true;
    this.error = null;

    this.dataService.getReservations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (reservations) => {
          const foundReservation = reservations.find(r => r.reservationId === this.reservationId);
          this.reservation = foundReservation || null;
          if (this.reservation) {
            // Debug: Log the customFields structure
            console.log('Reservation customFields:', this.reservation.customFields);
            console.log('Documents:', this.getIdDocuments());
            this.populateCustomFields();
          } else {
            this.error = 'Reservation not found';
          }
          this.loading = false;
        },
        error: (error) => {
          this.error = 'Failed to load reservation details';
          this.loading = false;
          console.error('Error loading reservation:', error);
        }
      });
  }

  private populateCustomFields(): void {
    if (!this.reservation || !this.reservation.customFields) return;

    // Extract check-in custom fields from reservation data
    const checkinFields = this.reservation.customFields.checkin || {};

    this.customFieldsForm.patchValue({
      mainGuestEmail: checkinFields.mainGuestEmail || '',
      mainGuestFirstname: checkinFields.mainGuestFirstname || '',
      mainGuestLastname: checkinFields.mainGuestLastname || '',
      mainGuestPhoneNumber: checkinFields.mainGuestPhoneNumber || ''
    });

    this.customFieldsForm.markAsPristine();
  }

  saveChanges(): void {
    if (!this.reservation || !this.hasChanges) return;

    this.saving = true;
    this.error = null;
    this.successMessage = null;

    const updatedCheckinFields = this.customFieldsForm.value;

    const updateData: Partial<ReservationData> = {
      PK: this.reservation.PK,
      SK: this.reservation.SK,
      customFields: {
        ...this.reservation.customFields,
        checkin: {
          ...this.reservation.customFields?.checkin,
          ...updatedCheckinFields,
          updatedAt: Date.now()
        }
      }
    };

    this.dataService.updateReservation(updateData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.reservation = updated;
          this.customFieldsForm.markAsPristine();
          this.hasChanges = false;
          this.successMessage = 'Check-in information updated successfully!';
          this.saving = false;
          this.initializeFeatherIcons();

          // Clear success message after 3 seconds
          setTimeout(() => {
            this.successMessage = null;
          }, 3000);
        },
        error: (error) => {
          this.error = 'Failed to save changes. Please try again.';
          this.saving = false;
          console.error('Error saving reservation:', error);
        }
      });
  }

  goBack(): void {
    // Use browser's back functionality for smart navigation
    window.history.back();
  }

  openAccessDoorsPage(): void {
    if (!this.reservation) return;

    const fromBooking = [this.reservation.guestName, this.reservation.guestSurname]
      .map(s => (s || '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
    const c = this.reservation.customFields?.checkin;
    const fromCheckin = [c?.mainGuestFirstname, c?.mainGuestLastname]
      .map(s => (s || '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
    const nameHint = fromBooking || fromCheckin || 'Guest';

    // Get the QR code if available
    const qrCode = this.reservation.customFields?.doorAccesses?.qrCode || '';

    // Build the URL with query parameters (guestFirstName carries URL name hint for backward compatibility)
    const params = new URLSearchParams({
      reservationCode: this.reservation.reservationCode,
      guestFirstName: nameHint
    });

    // Add QR code if available
    if (qrCode) {
      params.append('qrCode', qrCode);
    }

    // Open in new tab
    const url = `/accessedDoors?${params.toString()}`;
    window.open(url, '_blank');
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
  }

  getStatusText(status: number): string {
    return status === 1 ? 'Confirmed' : 'Cancelled';
  }

  getStatusClass(status: number): string {
    return status === 1
      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
  }

  getCheckinStatusText(status?: string): string {
    switch (status) {
      case 'completed': return 'Checked In';
      case 'pending': return 'Pending';
      case 'in_progress': return 'In Progress';
      default: return 'Not Started';
    }
  }

  getCheckinStatusClass(status?: string): string {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'pending': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  }

  private clearMessages(): void {
    this.error = null;
    this.successMessage = null;
  }

  // Door Access Methods
  getDoorAccessInfo(): any {
    return this.reservation?.customFields?.doorAccesses || null;
  }

  getDoorAccessStatusText(status?: string): string {
    switch (status) {
      case 'active': return 'Active';
      case 'pending': return 'Pending';
      case 'expired': return 'Expired';
      case 'revoked': return 'Revoked';
      default: return 'Not Generated';
    }
  }

  getDoorAccessStatusClass(status?: string): string {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'expired': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'revoked': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  }

  onResendDoorAccess(): void {
    if (!this.reservation || !this.resendDoorAccessEmail || this.resendingDoorAccess) {
      return;
    }

    this.clearMessages();
    this.resendingDoorAccess = true;

    const reservationId = this.reservation.reservationId;
    const email = this.resendDoorAccessEmail.trim();

    this.dataService.resendDoorAccess(reservationId, email)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.successMessage = `Door access email resent to ${email}`;
          this.resendingDoorAccess = false;
          this.initializeFeatherIcons();
        },
        error: (error) => {
          console.error('Error resending door access email:', error);
          this.error = 'Failed to resend door access email. Please try again.';
          this.resendingDoorAccess = false;
        }
      });
  }

  // Booking Source Methods
  getBookingSourceInfo(source?: BookingSource) {
    if (!source) return getBookingSourceInfo('unknown');
    return getBookingSourceInfo(source);
  }

  getBookingSourceClasses(source?: BookingSource): string {
    const info = this.getBookingSourceInfo(source);
    return `${info.bgColor} ${info.color}`;
  }

  hasPinCodes(pinCodes: any): boolean {
    if (!pinCodes || typeof pinCodes !== 'object') return false;
    return Object.keys(pinCodes).length > 0;
  }

  getPinCodesArray(pinCodes: any): Array<{door: string, code: string}> {
    if (!pinCodes || typeof pinCodes !== 'object') return [];

    return Object.entries(pinCodes).map(([door, code]) => ({
      door,
      code: String(code)
    }));
  }

  // ID Document Methods
  getIdDocuments(): any[] {
    const checkinData = this.reservation?.customFields?.checkin;
    if (!checkinData || !checkinData.documents) return [];

    // Handle both DynamoDB format and regular format
    if (Array.isArray(checkinData.documents)) {
      return checkinData.documents.map(doc => {
        // If it's DynamoDB format with M wrapper
        if (doc.M) {
          return {
            type: doc.M.type?.S || 'id',
            fileName: doc.M.fileName?.S || 'Unknown',
            s3Key: doc.M.s3Key?.S || '',
            uploadedAt: doc.M.uploadedAt?.N ? parseInt(doc.M.uploadedAt.N) : Date.now()
          };
        }
        // If it's already in regular format
        return doc;
      });
    }

    return [];
  }

  getDocumentTypeText(type: string): string {
    switch (type) {
      case 'id': return 'ID Card';
      case 'passport': return 'Passport';
      case 'drivers_license': return 'Driver\'s License';
      default: return 'Document';
    }
  }

  async loadDocumentPreview(s3Key: string): Promise<void> {
    if (this.documentPreviews[s3Key] || this.loadingPreviews[s3Key]) {
      return;
    }

    this.loadingPreviews[s3Key] = true;

    try {
      const previewUrl = await this.s3DocumentService.getDocumentUrl(s3Key, this.reservation?.reservationId);
      this.documentPreviews[s3Key] = previewUrl;
    } catch (error) {
      console.error('Error loading document preview:', error);
      this.documentPreviews[s3Key] = this.getPlaceholderImage('Preview unavailable');
    } finally {
      this.loadingPreviews[s3Key] = false;
    }
  }

  getDocumentPreviewUrl(s3Key: string): string {
    // Load preview asynchronously
    this.loadDocumentPreview(s3Key);

    // Return cached preview or loading placeholder
    return this.documentPreviews[s3Key] || this.getPlaceholderImage('Loading preview...');
  }

  private getPlaceholderImage(text: string): string {
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="200" height="120" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f3f4f6"/>
        <text x="50%" y="50%" font-size="12" text-anchor="middle" dy=".3em" fill="#6b7280">
          ${text}
        </text>
      </svg>
    `)}`;
  }

  onImageError(event: any): void {
    // Replace broken image with placeholder
    event.target.src = `data:image/svg+xml;base64,${btoa(`
      <svg width="200" height="120" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#ef4444" opacity="0.1"/>
        <text x="50%" y="50%" font-size="12" text-anchor="middle" dy=".3em" fill="#ef4444">
          Preview unavailable
        </text>
      </svg>
    `)}`;
  }

  async viewDocument(s3Key: string): Promise<void> {
    try {
      console.log('Attempting to view document:', s3Key);

      // Show loading state
      const button = event?.target as HTMLButtonElement;
      if (button) {
        button.disabled = true;
        button.innerHTML = '<i data-feather="loader" class="size-3 mr-1 animate-spin"></i>Loading...';
        feather.replace();
      }

      const documentUrl = await this.s3DocumentService.getDocumentUrl(
        s3Key,
        this.reservation?.reservationId
      );

      // Open document in new tab
      window.open(documentUrl, '_blank');

    } catch (error) {
      console.error('Error viewing document:', error);
      alert(`Failed to load document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Reset button state
      const button = event?.target as HTMLButtonElement;
      if (button) {
        button.disabled = false;
        button.innerHTML = '<i data-feather="eye" class="size-3 mr-1"></i>View Document';
        feather.replace();
      }
    }
  }
}
