import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, Observable, of, throwError } from 'rxjs';
import { ManagementDataService, ReservationData } from '../management/shared/management-data.service';
import { QrCodeComponent } from '../../components/qr-code/qr-code.component';
import * as feather from 'feather-icons';

interface DoorAccessInfo {
  status?: string;
  generatedAt?: number;
  qrCode?: string;
  pinCodes?: any;
  doorInfo?: {
    pin_doors?: any[];
    qr_doors?: any[];
    total_doors?: number;
  };
  usageHistory?: any[];
}

@Component({
  selector: 'app-access-doors',
  standalone: true,
  imports: [CommonModule, QrCodeComponent],
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div class="max-w-4xl mx-auto px-4">
        <!-- Header -->
        <div class="text-center mb-8">
          <div class="w-20 h-20 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <i data-feather="key" class="size-10 text-purple-600 dark:text-purple-400"></i>
          </div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Door Access</h1>
          <p class="text-gray-600 dark:text-gray-400">Your digital keys and access information</p>
        </div>

        <!-- Loading State -->
        <div *ngIf="loading" class="flex items-center justify-center py-12">
          <div class="text-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p class="text-gray-600 dark:text-gray-400">Loading access information...</p>
          </div>
        </div>

        <!-- Error State -->
        <div *ngIf="error && !loading" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mb-6">
          <div class="flex items-center">
            <i data-feather="alert-circle" class="size-6 text-red-600 dark:text-red-400 mr-3"></i>
            <div>
              <h3 class="text-lg font-medium text-red-800 dark:text-red-200">Access Error</h3>
              <p class="text-red-700 dark:text-red-300">{{error}}</p>
            </div>
          </div>
        </div>

        <!-- Reservation Info -->
        <div *ngIf="reservation && !loading" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <i data-feather="info" class="size-5 mr-2 text-blue-600 dark:text-blue-400"></i>
            Reservation Details
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reservation Code</label>
              <p class="text-lg font-mono text-gray-900 dark:text-white">{{reservation.reservationCode}}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Guest Name</label>
              <p class="text-lg text-gray-900 dark:text-white">{{reservation.guestName}} {{reservation.guestSurname}}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Room</label>
              <p class="text-lg text-gray-900 dark:text-white">{{reservation.roomName}} ({{reservation.roomAlias}})</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Check-in</label>
              <p class="text-lg text-gray-900 dark:text-white">{{formatDate(reservation.checkInDate)}}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Check-out</label>
              <p class="text-lg text-gray-900 dark:text-white">{{formatDate(reservation.checkOutDate)}}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <span class="inline-flex px-2 py-1 text-sm font-medium rounded-full"
                    [class]="getAccessStatusClass(doorAccessInfo?.status)">
                {{getAccessStatusText(doorAccessInfo?.status)}}
              </span>
            </div>
          </div>
        </div>

        <!-- QR Code Section -->
        <div *ngIf="!loading" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
            <i data-feather="smartphone" class="size-5 mr-2 text-purple-600 dark:text-purple-400"></i>
            QR Code Access
          </h2>

          <div class="flex flex-col lg:flex-row gap-8">
            <!-- QR Code Display -->
            <div class="flex-1">
              <app-qr-code
                [qrCodeData]="getQRCodeData()"
                [size]="300"
                [filename]="getQRCodeFilename()"
                [emptyMessage]="getQRCodeEmptyMessage()">
              </app-qr-code>
            </div>

            <!-- QR Code Info -->
            <div class="flex-1 space-y-4">
              <div>
                <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">How to Use</h3>
                <ul class="space-y-2 text-gray-700 dark:text-gray-300">
                  <li class="flex items-start">
                    <i data-feather="check" class="size-4 mr-2 mt-1 text-green-600"></i>
                    <span>Download or screenshot the QR code</span>
                  </li>
                  <li class="flex items-start">
                    <i data-feather="check" class="size-4 mr-2 mt-1 text-green-600"></i>
                    <span>Present it to the door scanner</span>
                  </li>
                  <li class="flex items-start">
                    <i data-feather="check" class="size-4 mr-2 mt-1 text-green-600"></i>
                    <span>Wait for the green light and enter</span>
                  </li>
                </ul>
              </div>

              <div *ngIf="doorAccessInfo?.generatedAt">
                <h4 class="text-md font-medium text-gray-900 dark:text-white mb-2">Access Details</h4>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-600 dark:text-gray-400">Generated:</span>
                    <span class="text-gray-900 dark:text-white">{{formatDateTime(doorAccessInfo?.generatedAt)}}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600 dark:text-gray-400">Total Doors:</span>
                    <span class="text-gray-900 dark:text-white">{{doorAccessInfo?.doorInfo?.total_doors || 0}}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Door Information -->
        <div *ngIf="doorAccessInfo && !loading" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
            <i data-feather="lock" class="size-5 mr-2 text-green-600 dark:text-green-400"></i>
            Door Access Information
          </h2>

          <!-- QR Doors -->
          <div *ngIf="hasQRDoors()" class="mb-6">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
              <i data-feather="smartphone" class="size-4 mr-2"></i>
              QR Code Doors ({{doorAccessInfo.doorInfo?.qr_doors?.length || 0}})
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div *ngFor="let door of doorAccessInfo.doorInfo?.qr_doors"
                   class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 class="font-medium text-blue-900 dark:text-blue-100 mb-2">{{door.name || door.id}}</h4>
                <div class="space-y-1 text-sm">
                  <div class="flex justify-between">
                    <span class="text-blue-700 dark:text-blue-300">Type:</span>
                    <span class="text-blue-900 dark:text-blue-100">{{door.type || 'QR'}}</span>
                  </div>
                  <div *ngIf="door.readerId" class="flex justify-between">
                    <span class="text-blue-700 dark:text-blue-300">Reader:</span>
                    <span class="text-blue-900 dark:text-blue-100">{{door.readerId}}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- PIN Doors -->
          <div *ngIf="hasPINDoors()" class="mb-6">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
              <i data-feather="hash" class="size-4 mr-2"></i>
              PIN Code Doors ({{doorAccessInfo.doorInfo?.pin_doors?.length || 0}})
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div *ngFor="let door of doorAccessInfo.doorInfo?.pin_doors"
                   class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h4 class="font-medium text-green-900 dark:text-green-100 mb-2">{{door.name || door.id}}</h4>
                <div class="space-y-1 text-sm">
                  <div class="flex justify-between">
                    <span class="text-green-700 dark:text-green-300">Type:</span>
                    <span class="text-green-900 dark:text-green-100">{{door.type || 'PIN'}}</span>
                  </div>
                  <div *ngIf="door.readerId" class="flex justify-between">
                    <span class="text-green-700 dark:text-green-300">Reader:</span>
                    <span class="text-green-900 dark:text-green-100">{{door.readerId}}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- PIN Codes -->
          <div *ngIf="hasPinCodes()" class="mb-6">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
              <i data-feather="key" class="size-4 mr-2"></i>
              PIN Codes
            </h3>
            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div *ngFor="let pinCode of getPinCodesArray()"
                     class="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded border">
                  <span class="font-medium text-gray-700 dark:text-gray-300">{{pinCode.door}}:</span>
                  <span class="font-mono text-xl text-gray-900 dark:text-white">{{pinCode.code}}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- No Access Info -->
        <div *ngIf="!doorAccessInfo && !loading && !error" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <i data-feather="info" class="size-16 text-gray-400 mx-auto mb-4"></i>
          <h3 class="text-xl font-medium text-gray-900 dark:text-white mb-2">No Door Access Available</h3>
          <p class="text-gray-600 dark:text-gray-400 mb-6">Door access has not been generated for this reservation yet.</p>
          <button (click)="generateAccess()"
                  [disabled]="generating"
                  class="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors">
            <i data-feather="key" class="size-4 mr-2"></i>
            {{generating ? 'Generating...' : 'Generate Door Access'}}
          </button>
        </div>
      </div>
    </div>
  `
})
export class AccessDoorsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // URL Parameters (name hint: substring of booking guest full name; legacy param guestFirstName)
  reservationCode: string | null = null;
  guestNameHint: string | null = null;
  qrCode: string | null = null;

  // Data
  reservation: ReservationData | null = null;
  doorAccessInfo: DoorAccessInfo | null = null;

  // State
  loading = false;
  generating = false;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dataService: ManagementDataService
  ) {}

  ngOnInit(): void {
    this.extractUrlParameters();
    this.loadReservationData();
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

  private normalizeGuestNamePart(s: string | null | undefined): string {
    return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private bookingGuestHaystack(first?: string | null, last?: string | null): string {
    return this.normalizeGuestNamePart(`${first || ''} ${last || ''}`.trim());
  }

  private guestUrlHintMatchesReservation(r: ReservationData, hint: string | null): boolean {
    const needle = this.normalizeGuestNamePart(hint);
    if (needle.length < 2) {
      return false;
    }
    const fromBooking = this.bookingGuestHaystack(r.guestName, r.guestSurname);
    if (fromBooking.length > 0 && fromBooking.includes(needle)) {
      return true;
    }
    const c = r.customFields?.checkin;
    const fromCheckin = this.bookingGuestHaystack(c?.mainGuestFirstname, c?.mainGuestLastname);
    return fromCheckin.length > 0 && fromCheckin.includes(needle);
  }

  private extractUrlParameters(): void {
    this.route.queryParams.subscribe(params => {
      this.reservationCode = params['reservationCode'];
      this.guestNameHint = params['guestName'] || params['guestFirstName'] || null;
      this.qrCode = params['qrCode'];

      if (!this.reservationCode || !this.guestNameHint) {
        this.error = 'Missing required parameters. Please use the link provided in your email.';
      }
    });
  }

  private loadReservationData(): void {
    if (!this.reservationCode || !this.guestNameHint) return;

    this.loading = true;
    this.error = null;

    this.dataService.getReservations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (reservations) => {
          const foundReservation = reservations.find(r =>
            r.reservationCode === this.reservationCode &&
            this.guestUrlHintMatchesReservation(r, this.guestNameHint)
          );

          if (foundReservation) {
            this.reservation = foundReservation;
            this.doorAccessInfo = foundReservation.customFields?.doorAccesses as DoorAccessInfo || null;

            // If QR code is provided in URL but not in database, update it
            if (this.qrCode && (!this.doorAccessInfo?.qrCode || this.doorAccessInfo.qrCode === '')) {
              this.updateQRCodeInReservation();
            }
          } else {
            this.error = 'Reservation not found or guest name does not match.';
          }
          this.loading = false;
        },
        error: (error) => {
          this.error = 'Failed to load reservation data. Please try again later.';
          this.loading = false;
          console.error('Error loading reservation:', error);
        }
      });
  }

  private updateQRCodeInReservation(): void {
    if (!this.reservation || !this.qrCode) return;

    const updateData: Partial<ReservationData> = {
      PK: this.reservation.PK,
      SK: this.reservation.SK,
      customFields: {
        ...this.reservation.customFields,
        doorAccesses: {
          ...this.reservation.customFields?.doorAccesses,
          qrCode: this.qrCode,
          status: 'active',
          generatedAt: Date.now()
        }
      }
    };

    this.dataService.updateReservation(updateData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.reservation = updated;
          this.doorAccessInfo = updated.customFields?.doorAccesses as DoorAccessInfo || null;
        },
        error: (error) => {
          console.error('Error updating QR code:', error);
        }
      });
  }

  generateAccess(): void {
    if (!this.reservation) return;

    this.generating = true;
    this.error = null;

    // Generate a new QR code (in real implementation, this would call an API)
    const newQRCode = this.generateQRCodeData();

    const updateData: Partial<ReservationData> = {
      PK: this.reservation.PK,
      SK: this.reservation.SK,
      customFields: {
        ...this.reservation.customFields,
        doorAccesses: {
          status: 'active',
          generatedAt: Date.now(),
          qrCode: newQRCode,
          pinCodes: {},
          doorInfo: {
            pin_doors: [],
            qr_doors: [],
            total_doors: 0
          }
        }
      }
    };

    this.dataService.updateReservation(updateData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.reservation = updated;
          this.doorAccessInfo = updated.customFields?.doorAccesses as DoorAccessInfo || null;
          this.generating = false;
          this.initializeFeatherIcons();
        },
        error: (error) => {
          this.error = 'Failed to generate door access. Please try again.';
          this.generating = false;
          console.error('Error generating access:', error);
        }
      });
  }

  private generateQRCodeData(): string {
    // Generate a unique QR code based on reservation data
    const timestamp = Date.now();
    const data = {
      reservationCode: this.reservation?.reservationCode,
      guestName: this.guestNameHint,
      timestamp: timestamp,
      type: 'door_access'
    };
    return btoa(JSON.stringify(data));
  }

  // Template helper methods
  getQRCodeData(): string | null {
    return this.qrCode || this.doorAccessInfo?.qrCode || null;
  }

  getQRCodeFilename(): string {
    return `door-access-${this.reservationCode || 'unknown'}`;
  }

  getQRCodeEmptyMessage(): string {
    if (this.doorAccessInfo?.status === 'pending') {
      return 'QR code is being generated...';
    }
    return 'No QR code available. Click "Generate Door Access" to create one.';
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
  }

  formatDateTime(timestamp?: number): string {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  }

  getAccessStatusText(status?: string): string {
    switch (status) {
      case 'active': return 'Active';
      case 'pending': return 'Pending';
      case 'expired': return 'Expired';
      case 'revoked': return 'Revoked';
      default: return 'Not Generated';
    }
  }

  getAccessStatusClass(status?: string): string {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'expired': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'revoked': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  }

  hasPinCodes(): boolean {
    if (!this.doorAccessInfo?.pinCodes || typeof this.doorAccessInfo.pinCodes !== 'object') return false;
    return Object.keys(this.doorAccessInfo.pinCodes).length > 0;
  }

  getPinCodesArray(): Array<{door: string, code: string}> {
    if (!this.doorAccessInfo?.pinCodes || typeof this.doorAccessInfo.pinCodes !== 'object') return [];

    return Object.entries(this.doorAccessInfo.pinCodes).map(([door, code]) => ({
      door,
      code: String(code)
    }));
  }

  hasQRDoors(): boolean {
    return !!(this.doorAccessInfo?.doorInfo?.qr_doors && this.doorAccessInfo.doorInfo.qr_doors.length > 0);
  }

  hasPINDoors(): boolean {
    return !!(this.doorAccessInfo?.doorInfo?.pin_doors && this.doorAccessInfo.doorInfo.pin_doors.length > 0);
  }
}
