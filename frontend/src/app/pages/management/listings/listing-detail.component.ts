import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ManagementDataService, ListingData, DoorData } from '../shared/management-data.service';
import * as feather from 'feather-icons';

@Component({
  selector: 'app-listing-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
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
            <button (click)="openDoorAssignment()"
                    class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              <i data-feather="key" class="size-4 mr-2"></i>
              Manage Doors
            </button>
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
          <p class="text-gray-600 dark:text-gray-400">Loading listing details...</p>
        </div>
      </div>

      <!-- Error State -->
      <div *ngIf="error && !loading" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
        <div class="flex items-center">
          <i data-feather="alert-circle" class="size-5 text-red-600 dark:text-red-400 mr-2"></i>
          <p class="text-red-800 dark:text-red-200">{{error}}</p>
        </div>
      </div>

      <!-- Listing Details -->
      <div *ngIf="listing && !loading" class="space-y-6">
        <!-- Basic Information Card -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <i data-feather="home" class="size-5 mr-2 text-blue-600 dark:text-blue-400"></i>
            Listing Information
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Room ID</label>
              <p class="text-lg font-mono text-gray-900 dark:text-white">{{listing.roomId}}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Room Name</label>
              <p class="text-lg text-gray-900 dark:text-white">{{listing.roomName}}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Room Alias</label>
              <p class="text-lg text-gray-900 dark:text-white">{{listing.roomAlias}}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Group Name</label>
              <p class="text-lg text-gray-900 dark:text-white">{{listing.groupName || 'N/A'}}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
              <p class="text-lg text-gray-900 dark:text-white">{{listing.type}}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <span class="inline-flex px-2 py-1 text-sm font-medium rounded-full"
                    [class]="getStatusClass(listing.status)">
                {{getStatusText(listing.status)}}
              </span>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Airbnb Listing ID</label>
              <p class="text-lg text-gray-900 dark:text-white">{{listing.airbnbListingId || 'N/A'}}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Booking Hotel Code</label>
              <p class="text-lg text-gray-900 dark:text-white">{{listing.bookingHotelCode || 'N/A'}}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency</label>
              <p class="text-lg text-gray-900 dark:text-white">{{listing.currency}}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Created</label>
              <p class="text-lg text-gray-900 dark:text-white">{{formatDate(listing.createdAt)}}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Updated</label>
              <p class="text-lg text-gray-900 dark:text-white">{{formatDate(listing.updatedAt)}}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assigned Doors</label>
              <p class="text-lg text-gray-900 dark:text-white">{{ getAssignedDoorsDisplay() }}</p>
            </div>
          </div>
        </div>

        <!-- Custom Fields Card -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <i data-feather="edit-3" class="size-5 mr-2 text-green-600 dark:text-green-400"></i>
            Custom Fields
            <span class="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">(Editable)</span>
          </h2>

          <form [formGroup]="customFieldsForm" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label for="address" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Address
                </label>
                <textarea id="address"
                         formControlName="address"
                         rows="3"
                         class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                         placeholder="Property address..."></textarea>
              </div>

              <div>
                <label for="responsiblePerson" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Responsible Person
                </label>
                <input type="text"
                       id="responsiblePerson"
                       formControlName="responsiblePerson"
                       class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                       placeholder="Responsible person name...">
              </div>

              <div class="md:col-span-2">
                <label for="info4guest" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Information for Guest
                </label>
                <textarea id="info4guest"
                         formControlName="info4guest"
                         rows="4"
                         class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                         placeholder="Special instructions or information for guests..."></textarea>
              </div>
            </div>

            <!-- Save Button -->
            <div class="flex justify-end pt-4">
              <button type="button"
                      (click)="saveChanges()"
                      [disabled]="!hasChanges || saving"
                      class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
                <i data-feather="save" class="size-4 mr-2"></i>
                {{saving ? 'Saving...' : 'Save Custom Fields'}}
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

    <!-- Door Assignment Modal -->
    <div *ngIf="showDoorAssignment" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Assign Doors to Listing</h3>
            <button (click)="closeDoorAssignment()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <i data-feather="x" class="size-6"></i>
            </button>
          </div>

          <div class="mb-4">
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Select doors to assign to <strong>{{listing?.roomName}}</strong>
            </p>

            <div class="space-y-2 max-h-60 overflow-y-auto">
              <div *ngFor="let door of availableDoors"
                   class="flex items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                <input type="checkbox"
                       [id]="'door-' + door.id"
                       [checked]="isSelectedDoor(door.id)"
                       (change)="toggleDoorSelection(door.id, $event)"
                       class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                <label [for]="'door-' + door.id" class="ml-3 flex-1 cursor-pointer">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-sm font-medium text-gray-900 dark:text-white">{{door.name}}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">{{door.location}} • {{door.type}}</p>
                    </div>
                    <span class="inline-flex px-2 py-1 text-xs font-medium rounded-full"
                          [class]="door.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'">
                      {{door.isActive ? 'Active' : 'Inactive'}}
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div class="flex justify-end space-x-3">
            <button (click)="closeDoorAssignment()"
                    class="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors">
              Cancel
            </button>
            <button (click)="saveDoorAssignment()"
                    [disabled]="assigningDoors"
                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
              <i data-feather="save" class="size-4 mr-2"></i>
              {{assigningDoors ? 'Saving...' : 'Save Assignment'}}
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ListingDetailComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  listing: ListingData | null = null;
  customFieldsForm: FormGroup;
  loading = false;
  saving = false;
  error: string | null = null;
  successMessage: string | null = null;
  hasChanges = false;

  // Door assignment properties
  showDoorAssignment = false;
  availableDoors: DoorData[] = [];
  selectedDoorIds: string[] = [];
  assigningDoors = false;

  private listingId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dataService: ManagementDataService,
    private fb: FormBuilder
  ) {
    this.customFieldsForm = this.fb.group({
      address: [''],
      responsiblePerson: [''],
      info4guest: ['']
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
    this.listingId = this.route.snapshot.paramMap.get('id');
    if (this.listingId) {
      this.loadListing();
    } else {
      this.error = 'No listing ID provided';
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

  private loadListing(): void {
    if (!this.listingId) return;

    this.loading = true;
    this.error = null;

    this.dataService.getListings()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (listings) => {
          const foundListing = listings.find(l => l.roomId === this.listingId);
          this.listing = foundListing || null;
          if (this.listing) {
            this.populateCustomFields();
          } else {
            this.error = 'Listing not found';
          }
          this.loading = false;
        },
        error: (error) => {
          this.error = 'Failed to load listing details';
          this.loading = false;
          console.error('Error loading listing:', error);
        }
      });
  }

  private populateCustomFields(): void {
    if (!this.listing || !this.listing.customFields) return;

    this.customFieldsForm.patchValue({
      address: this.listing.customFields.address || '',
      responsiblePerson: this.listing.customFields.responsiblePerson || '',
      info4guest: this.listing.customFields.info4guest || ''
    });

    this.customFieldsForm.markAsPristine();
  }

  saveChanges(): void {
    if (!this.listing || !this.hasChanges) return;

    this.saving = true;
    this.error = null;
    this.successMessage = null;

    const updatedCustomFields = this.customFieldsForm.value;

    const updateData: Partial<ListingData> = {
      PK: this.listing.PK,
      SK: this.listing.SK,
      customFields: {
        ...this.listing.customFields,
        ...updatedCustomFields
      }
    };

    this.dataService.updateListing(updateData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.listing = updated;
          this.customFieldsForm.markAsPristine();
          this.hasChanges = false;
          this.successMessage = 'Custom fields updated successfully!';
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
          console.error('Error saving listing:', error);
        }
      });
  }

  goBack(): void {
    // Use browser's back functionality for smart navigation
    window.history.back();
  }

  formatDate(timestamp?: number): string {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleDateString();
  }

  getStatusText(status?: string): string {
    switch (status) {
      case 'active': return 'Active';
      case 'inactive': return 'Inactive';
      case 'pending': return 'Pending';
      default: return status || 'Unknown';
    }
  }

  getStatusClass(status?: string): string {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'inactive': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  }

  private clearMessages(): void {
    this.error = null;
    this.successMessage = null;
  }

  // Door Assignment Methods
  openDoorAssignment(): void {
    this.showDoorAssignment = true;
    this.loadAvailableDoors();
    this.initializeSelectedDoors();
    setTimeout(() => {
      feather.replace();
    }, 100);
  }

  closeDoorAssignment(): void {
    this.showDoorAssignment = false;
  }

  private loadAvailableDoors(): void {
    this.dataService.getAvailableDoorsForListing(this.listingId || undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (doors) => {
          this.availableDoors = doors;
        },
        error: (error) => {
          console.error('Error loading doors:', error);
          this.error = 'Failed to load available doors';
        }
      });
  }

  private initializeSelectedDoors(): void {
    this.selectedDoorIds = [...(this.listing?.assignedDoors || [])];
  }

  isSelectedDoor(doorId: string): boolean {
    return this.selectedDoorIds.includes(doorId);
  }

  toggleDoorSelection(doorId: string, event: any): void {
    if (event.target.checked) {
      if (!this.selectedDoorIds.includes(doorId)) {
        this.selectedDoorIds.push(doorId);
      }
    } else {
      this.selectedDoorIds = this.selectedDoorIds.filter(id => id !== doorId);
    }
  }

  saveDoorAssignment(): void {
    if (!this.listing) return;

    this.assigningDoors = true;
    this.error = null;

    this.dataService.assignDoorsToListing(this.listing.roomId, this.selectedDoorIds)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedListing) => {
          this.listing = updatedListing;
          this.assigningDoors = false;
          this.showDoorAssignment = false;
          this.successMessage = 'Door assignment updated successfully!';
          this.initializeFeatherIcons();

          // Clear success message after 3 seconds
          setTimeout(() => {
            this.successMessage = null;
          }, 3000);
        },
        error: (error) => {
          this.error = 'Failed to update door assignment. Please try again.';
          this.assigningDoors = false;
          console.error('Error updating door assignment:', error);
        }
      });
  }

  getAssignedDoorsDisplay(): string {
    if (!this.listing?.customFields?.doors || !Array.isArray(this.listing.customFields.doors)) {
      return 'No doors assigned';
    }

    const doorNames = this.listing.customFields.doors
      .filter(door => door && door.name)
      .map(door => door.name);

    return doorNames.length > 0 ? doorNames.join(', ') : 'No doors assigned';
  }
}
