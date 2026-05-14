import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ModelService } from '../../../services/model.service';
import { UserService, User } from '../../../services/user.service';

interface Guest extends User {
  // Guest-specific fields (extending the base User interface)
  documentType?: 'passport' | 'id_card' | 'drivers_license';
  documentNumber?: string;
  totalBookings: number;
  totalSpent: number;
  lastBookingDate?: Date;
  guestStatus: 'active' | 'blocked' | 'vip'; // Renamed to avoid conflict with Cognito status
  notes?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
}

interface GuestBooking {
  id: string;
  propertyName: string;
  unitName: string;
  checkInDate: Date;
  checkOutDate: Date;
  totalAmount: number;
  status: string;
  rating?: number;
  review?: string;
}

@Component({
  selector: 'app-guest-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Guest Management</h1>
          <p class="text-gray-600 dark:text-gray-400">Manage guest profiles, communications, and experiences</p>
        </div>
        <div class="flex space-x-3">
          <button (click)="showLearning = !showLearning"
                  class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
            <i class="fas fa-graduation-cap mr-2"></i>
            Learning Guide
          </button>
          <button (click)="showCreateModal = true"
                  class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
            <i class="fas fa-plus mr-2"></i>
            Add Guest
          </button>
        </div>
      </div>

      <!-- Learning Section -->
      <div *ngIf="showLearning" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <div class="flex items-start space-x-3">
          <i class="fas fa-lightbulb text-blue-600 dark:text-blue-400 mt-1"></i>
          <div>
            <h3 class="text-lg font-medium text-blue-900 dark:text-blue-100 mb-3">Guest Management Guide</h3>
            <div class="space-y-3 text-sm text-blue-700 dark:text-blue-300">
              <div>
                <h4 class="font-medium mb-1">Guest Lifecycle Management:</h4>
                <ul class="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Pre-arrival:</strong> Collect guest information, preferences, and special requests</li>
                  <li><strong>During stay:</strong> Monitor guest satisfaction and handle any issues promptly</li>
                  <li><strong>Post-departure:</strong> Follow up for reviews and feedback</li>
                  <li><strong>Repeat guests:</strong> Use preferences and history to personalize future stays</li>
                </ul>
              </div>
              <div>
                <h4 class="font-medium mb-1">Best Practices:</h4>
                <ul class="list-disc list-inside space-y-1 ml-4">
                  <li>Maintain detailed guest profiles with preferences and notes</li>
                  <li>Respond to guest inquiries within 2 hours during business hours</li>
                  <li>Track guest satisfaction scores and address concerns proactively</li>
                  <li>Offer personalized experiences for VIP and repeat guests</li>
                  <li>Keep emergency contact information updated and accessible</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Guests</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ guests.length }}</p>
            </div>
            <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <i class="fas fa-users text-blue-600 dark:text-blue-400"></i>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">VIP Guests</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ getGuestsByGuestStatus('vip').length }}</p>
            </div>
            <div class="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center">
              <i class="fas fa-crown text-yellow-600 dark:text-yellow-400"></i>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Repeat Guests</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ getRepeatGuests().length }}</p>
            </div>
            <div class="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
              <i class="fas fa-redo text-green-600 dark:text-green-400"></i>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Avg. Rating</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ getAverageRating() }}</p>
            </div>
            <div class="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
              <i class="fas fa-star text-purple-600 dark:text-purple-400"></i>
            </div>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search</label>
            <input [(ngModel)]="searchTerm"
                   (input)="filterGuests()"
                   type="text"
                   placeholder="Search guests..."
                   class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
            <select [(ngModel)]="selectedStatus"
                    (change)="filterGuests()"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="vip">VIP</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nationality</label>
            <select [(ngModel)]="selectedNationality"
                    (change)="filterGuests()"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
              <option value="">All Countries</option>
              <option *ngFor="let nationality of uniqueNationalities" [value]="nationality">{{ nationality }}</option>
            </select>
          </div>
          <div class="flex items-end">
            <button (click)="clearFilters()"
                    class="w-full px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <!-- Guests Table -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Guest
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contact
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Bookings
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total Spent
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Stay
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              <tr *ngFor="let guest of filteredGuests" class="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                      <span class="text-white text-sm font-medium">
                        {{ guest?.firstName?.[0] || '' }}{{ guest?.lastName?.[0] || '' }}
                      </span>
                    </div>
                    <div class="ml-4">
                      <div class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ guest.firstName }} {{ guest.lastName }}
                      </div>
                      <div class="text-sm text-gray-500 dark:text-gray-400">
                        {{ guest.nationality }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900 dark:text-white">{{ guest.email }}</div>
                  <div class="text-sm text-gray-500 dark:text-gray-400">{{ guest.phone }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full"
                        [ngClass]="getGuestStatusBadgeClass(guest.guestStatus)">
                    {{ guest.guestStatus | titlecase }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ guest.totalBookings }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  €{{ guest.totalSpent | number:'1.2-2' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ guest.lastBookingDate ? (guest.lastBookingDate | date:'short') : 'Never' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div class="flex items-center justify-end space-x-2">
                    <button (click)="viewGuestDetails(guest)"
                            class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                      <i class="fas fa-eye"></i>
                    </button>
                    <button (click)="editGuest(guest)"
                            class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button (click)="toggleGuestStatus(guest)"
                            class="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300">
                      <i [class]="guest.guestStatus === 'blocked' ? 'fas fa-unlock' : 'fas fa-ban'"></i>
                    </button>
                    <button (click)="sendMessage(guest)"
                            class="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300">
                      <i class="fas fa-envelope"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty State -->
        <div *ngIf="filteredGuests.length === 0" class="text-center py-12">
          <i class="fas fa-users text-gray-400 text-4xl mb-4"></i>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No guests found</h3>
          <p class="text-gray-500 dark:text-gray-400">Try adjusting your search or filter criteria.</p>
        </div>
      </div>
    </div>

    <!-- Guest Details Modal -->
    <div *ngIf="showDetailsModal"
         class="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              Guest Details - {{ selectedGuest?.firstName }} {{ selectedGuest?.lastName }}
            </h3>
            <button (click)="closeDetailsModal()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>

        <div class="p-6" *ngIf="selectedGuest">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Guest Information -->
            <div class="lg:col-span-2 space-y-6">
              <!-- Basic Info -->
              <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">Basic Information</h4>
                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span class="text-gray-500 dark:text-gray-400">Name:</span>
                    <p class="font-medium text-gray-900 dark:text-white">{{ selectedGuest.firstName }} {{ selectedGuest.lastName }}</p>
                  </div>
                  <div>
                    <span class="text-gray-500 dark:text-gray-400">Email:</span>
                    <p class="font-medium text-gray-900 dark:text-white">{{ selectedGuest.email }}</p>
                  </div>
                  <div>
                    <span class="text-gray-500 dark:text-gray-400">Phone:</span>
                    <p class="font-medium text-gray-900 dark:text-white">{{ selectedGuest.phone || 'Not provided' }}</p>
                  </div>
                  <div>
                    <span class="text-gray-500 dark:text-gray-400">Nationality:</span>
                    <p class="font-medium text-gray-900 dark:text-white">{{ selectedGuest.nationality || 'Not provided' }}</p>
                  </div>
                  <div>
                    <span class="text-gray-500 dark:text-gray-400">Document:</span>
                    <p class="font-medium text-gray-900 dark:text-white">
                      {{ selectedGuest.documentType | titlecase }} - {{ selectedGuest.documentNumber || 'Not provided' }}
                    </p>
                  </div>
                  <div>
                    <span class="text-gray-500 dark:text-gray-400">Status:</span>
                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full"
                          [ngClass]="getGuestStatusBadgeClass(selectedGuest.guestStatus)">
                      {{ selectedGuest.guestStatus | titlecase }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Booking History -->
              <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">Booking History</h4>
                <div class="space-y-3">
                  <div *ngFor="let booking of guestBookings"
                       class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                    <div class="flex items-center justify-between">
                      <div>
                        <p class="font-medium text-gray-900 dark:text-white">{{ booking.propertyName }} - {{ booking.unitName }}</p>
                        <p class="text-sm text-gray-500 dark:text-gray-400">
                          {{ booking.checkInDate | date:'short' }} - {{ booking.checkOutDate | date:'short' }}
                        </p>
                      </div>
                      <div class="text-right">
                        <p class="font-medium text-gray-900 dark:text-white">€{{ booking.totalAmount }}</p>
                        <div *ngIf="booking.rating" class="flex items-center">
                          <span class="text-yellow-400 mr-1">★</span>
                          <span class="text-sm text-gray-500 dark:text-gray-400">{{ booking.rating }}/5</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Notes -->
              <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">Notes</h4>
                <textarea [(ngModel)]="selectedGuest.notes"
                          rows="4"
                          placeholder="Add notes about this guest..."
                          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-800 dark:text-white"></textarea>
                <button (click)="saveGuestNotes()"
                        class="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">
                  Save Notes
                </button>
              </div>
            </div>

            <!-- Stats & Actions -->
            <div class="space-y-6">
              <!-- Stats -->
              <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">Statistics</h4>
                <div class="space-y-3">
                  <div class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">Total Bookings:</span>
                    <span class="font-medium text-gray-900 dark:text-white">{{ selectedGuest.totalBookings }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">Total Spent:</span>
                    <span class="font-medium text-gray-900 dark:text-white">€{{ selectedGuest.totalSpent | number:'1.2-2' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">Avg. per Booking:</span>
                    <span class="font-medium text-gray-900 dark:text-white">
                      €{{ selectedGuest.totalBookings > 0 ? (selectedGuest.totalSpent / selectedGuest.totalBookings) : 0 | number:'1.2-2' }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">Member Since:</span>
                    <span class="font-medium text-gray-900 dark:text-white">{{ selectedGuest.createdAt | date:'MMM yyyy' }}</span>
                  </div>
                </div>
              </div>

              <!-- Quick Actions -->
              <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 class="text-md font-medium text-gray-900 dark:text-white mb-4">Quick Actions</h4>
                <div class="space-y-2">
                  <button (click)="sendMessage(selectedGuest)"
                          class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors">
                    <i class="fas fa-envelope mr-2"></i>
                    Send Message
                  </button>
                  <button (click)="createBooking(selectedGuest)"
                          class="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors">
                    <i class="fas fa-plus mr-2"></i>
                    Create Booking
                  </button>
                  <button (click)="toggleGuestStatus(selectedGuest)"
                          class="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors">
                    <i [class]="selectedGuest.guestStatus === 'blocked' ? 'fas fa-unlock mr-2' : 'fas fa-ban mr-2'"></i>
                    {{ selectedGuest.guestStatus === 'blocked' ? 'Unblock Guest' : 'Block Guest' }}
                  </button>
                  <button (click)="promoteToVip(selectedGuest)"
                          *ngIf="selectedGuest.guestStatus !== 'vip'"
                          class="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors">
                    <i class="fas fa-crown mr-2"></i>
                    Promote to VIP
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class GuestManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  showLearning = false;
  showCreateModal = false;
  showEditModal = false;
  showDetailsModal = false;

  guests: Guest[] = [];
  filteredGuests: Guest[] = [];
  selectedGuest: Guest | null = null;
  guestBookings: GuestBooking[] = [];

  searchTerm = '';
  selectedStatus = '';
  selectedNationality = '';

  guestForm: FormGroup;

  get uniqueNationalities(): string[] {
    return [...new Set(this.guests.map(g => g.nationality).filter((n): n is string => Boolean(n)))];
  }

  constructor(
    private modelService: ModelService,
    private userService: UserService,
    private fb: FormBuilder
  ) {
    this.guestForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      nationality: [''],
      documentType: [''],
      documentNumber: [''],
      status: ['active', Validators.required]
    });
  }

  ngOnInit() {
    this.loadGuests();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadGuests() {
    try {
      console.log('Loading guests from AWS Cognito User Pool...');

      // Load guest users from User Service
      this.userService.getGuests()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (users) => {
            console.log('Raw guest users from Cognito:', users);

            // Map to Guest interface
            this.guests = users.map(user => ({
              ...user,
              // Ensure currency is set with default if not present
              currency: user.currency || 'EUR',
              // Guest-specific fields with proper defaults
              documentType: undefined, // Would need to be stored in custom attributes
              documentNumber: undefined, // Would need to be stored in custom attributes
              totalBookings: 0, // This would be calculated from bookings
              totalSpent: 0, // This would be calculated from bookings
              lastBookingDate: undefined, // This would be calculated from bookings
              guestStatus: 'active' as const, // Default guest status
              notes: '', // Would need to be stored separately
              emergencyContact: undefined // Would need to be stored in custom attributes
            } as Guest));

            console.log('Filtered guests:', this.guests);
            this.filterGuests();
          },
          error: (error) => {
            console.error('Error loading guests from Cognito:', error);
            // Fallback to mock data for demonstration
            this.guests = this.generateMockGuests();
            this.filterGuests();
          }
        });
    } catch (error) {
      console.error('Error loading guests:', error);
      // Mock data for demonstration
      this.guests = this.generateMockGuests();
      this.filterGuests();
    }
  }

  filterGuests() {
    this.filteredGuests = this.guests.filter(guest => {
      const matchesSearch = !this.searchTerm ||
        guest.firstName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        guest.lastName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        guest.email.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesStatus = !this.selectedStatus || guest.guestStatus === this.selectedStatus;
      const matchesNationality = !this.selectedNationality || guest.nationality === this.selectedNationality;

      return matchesSearch && matchesStatus && matchesNationality;
    });
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedStatus = '';
    this.selectedNationality = '';
    this.filterGuests();
  }

  getGuestsByGuestStatus(status: string): Guest[] {
    return this.guests.filter(guest => guest.guestStatus === status);
  }

  getRepeatGuests(): Guest[] {
    return this.guests.filter(guest => guest.totalBookings > 1);
  }

  getAverageRating(): string {
    // This would be calculated from actual booking ratings
    return '4.7';
  }

  async viewGuestDetails(guest: Guest) {
    this.selectedGuest = guest;
    this.showDetailsModal = true;

    try {
      // Load guest's booking history
      this.guestBookings = await this.modelService.getGuestBookings(guest.userId);
    } catch (error) {
      console.error('Error loading guest bookings:', error);
      // Mock booking data
      this.guestBookings = this.generateMockBookings(guest.userId);
    }
  }

  closeDetailsModal() {
    this.showDetailsModal = false;
    this.selectedGuest = null;
    this.guestBookings = [];
  }

  editGuest(guest: Guest) {
    // Implementation for editing guest
    console.log('Edit guest:', guest);
  }

  async toggleGuestStatus(guest: Guest) {
    try {
      const newStatus = guest.guestStatus === 'blocked' ? 'active' : 'blocked';

      // For now, just update locally since guest status is not stored in Cognito
      // In a real implementation, you might store this in a separate database or custom attributes
      guest.guestStatus = newStatus;

      console.log(`Guest ${guest.email} status changed to ${newStatus}`);

      // TODO: Implement guest status storage
      // This could be stored in:
      // 1. DynamoDB separate table for guest metadata
      // 2. Cognito custom attributes
      // 3. External database

    } catch (error) {
      console.error('Error updating guest status:', error);
    }
  }

  sendMessage(guest: Guest) {
    // Implementation for sending message
    console.log('Send message to guest:', guest);
  }

  createBooking(guest: Guest) {
    // Implementation for creating booking
    console.log('Create booking for guest:', guest);
  }

  async promoteToVip(guest: Guest) {
    try {
      // For now, just update locally since guest status is not stored in Cognito
      guest.guestStatus = 'vip';

      console.log(`Guest ${guest.email} promoted to VIP status`);

      // TODO: Implement VIP status storage (same as toggleGuestStatus)

    } catch (error) {
      console.error('Error promoting guest to VIP:', error);
    }
  }

  async saveGuestNotes() {
    if (this.selectedGuest) {
      try {
        // For now, just update locally since notes are not stored in Cognito
        console.log(`Saving notes for guest ${this.selectedGuest.email}:`, this.selectedGuest.notes);

        // TODO: Implement notes storage
        // This could be stored in:
        // 1. DynamoDB separate table for guest metadata
        // 2. External database
        // 3. File storage system

      } catch (error) {
        console.error('Error saving guest notes:', error);
      }
    }
  }

  getGuestStatusBadgeClass(status: string): string {
    const classes = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      vip: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
      blocked: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    };
    return classes[status as keyof typeof classes] || classes.active;
  }

  private generateMockGuests(): Guest[] {
    return [
      {
        userId: '1',
        email: 'john.doe@example.com',
        emailVerified: true,
        phone: '+49 123 456 7890',
        phoneVerified: true,
        firstName: 'John',
        lastName: 'Doe',
        role: 'guest',
        status: 'CONFIRMED',
        enabled: true,
        createdAt: new Date('2023-06-15'),
        lastModified: new Date('2024-01-15'),
        currency: 'EUR',
        nationality: 'Germany',
        documentType: 'passport',
        documentNumber: 'DE123456789',
        totalBookings: 3,
        totalSpent: 1250.00,
        lastBookingDate: new Date('2024-01-15'),
        guestStatus: 'vip',
        notes: 'Prefers quiet rooms, vegetarian meals'
      },
      {
        userId: '2',
        email: 'sarah.smith@example.com',
        emailVerified: true,
        phone: '+44 987 654 3210',
        phoneVerified: false,
        firstName: 'Sarah',
        lastName: 'Smith',
        role: 'guest',
        status: 'CONFIRMED',
        enabled: true,
        createdAt: new Date('2024-02-18'),
        lastModified: new Date('2024-02-20'),
        currency: 'GBP',
        nationality: 'United Kingdom',
        documentType: 'passport',
        documentNumber: 'UK987654321',
        totalBookings: 1,
        totalSpent: 450.00,
        lastBookingDate: new Date('2024-02-20'),
        guestStatus: 'active'
      }
    ];
  }

  private generateMockBookings(guestId: string): GuestBooking[] {
    return [
      {
        id: '1',
        propertyName: 'Downtown Berlin Apartments',
        unitName: 'Apartment 2B',
        checkInDate: new Date('2024-01-15'),
        checkOutDate: new Date('2024-01-18'),
        totalAmount: 450.00,
        status: 'completed',
        rating: 5,
        review: 'Excellent stay, very clean and comfortable!'
      },
      {
        id: '2',
        propertyName: 'City Center Suites',
        unitName: 'Suite 5A',
        checkInDate: new Date('2023-11-10'),
        checkOutDate: new Date('2023-11-14'),
        totalAmount: 800.00,
        status: 'completed',
        rating: 4
      }
    ];
  }
}
