import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';

import { NavbarComponent } from '../../../../components/navbar/navbar.component';
import { FooterComponent } from '../../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../../components/switcher/switcher.component';

import { AuthService } from '../../../../services/auth.service';
import { ModelService } from '../../../../services/model.service';
import { User } from '../../../../interfaces/user.interface';
import { BookingModel } from '../../../../interfaces/booking.interface';
import { Payment } from '../../../../interfaces/payment.interface';

@Component({
  selector: 'app-user-invoice',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NavbarComponent,
    FooterComponent,
    SwitcherComponent
  ],
  templateUrl: './user-invoice.component.html',
  styleUrl: './user-invoice.component.scss'
})
export class UserInvoiceComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  currentUser: User | null = null;
  userBookings: BookingModel[] = [];
  userPayments: Payment[] = [];
  selectedBooking: BookingModel | null = null;
  selectedPayment: Payment | null = null;
  loading = true;
  error: string | null = null;
  isModal: boolean = false;

  constructor(
    private authService: AuthService,
    private modelService: ModelService
  ) {}

  ngOnInit() {
    this.loadUserData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadUserData() {
    this.loading = true;
    this.error = null;

    // Get current authenticated user
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (authState) => {
          if (authState.isAuthenticated && authState.user) {
            this.loadUserProfile(authState.user.email, authState.user.userId);
          } else {
            this.loading = false;
            this.error = 'User not authenticated';
          }
        },
        error: (error) => {
          console.error('Error getting auth state:', error);
          this.loading = false;
          this.error = 'Failed to load user data';
        }
      });
  }

  private loadUserProfile(email: string, userId: string) {
    // ========== DYNAMODB USER PROFILE LOADING - DISABLED ==========
    // The following code was used to load user profile from DynamoDB.
    // Since we're now using only AWS Cognito for user management, this is disabled.
    // User profile data should now come from AWS Cognito User Pool attributes.

    console.log('DynamoDB user profile loading is disabled. User data should come from Cognito.');

    // For now, load only bookings and payments (which are still in DynamoDB)
    forkJoin({
      bookings: this.modelService.getBookingsByUser(userId),
      payments: this.modelService.getPaymentsByUser(userId)
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ bookings, payments }) => {
          // Set user data to null since we're not loading from DynamoDB
          this.currentUser = null;
          this.userBookings = bookings;
          this.userPayments = payments;

          // Set the first booking and its payment as selected by default
          if (bookings.length > 0) {
            this.selectedBooking = bookings[0];
            this.selectedPayment = payments.find(p => p.bookingId === bookings[0].bookingId) || null;
          }

          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading user data:', error);
          this.loading = false;
          this.error = 'Failed to load user data';
        }
      });

    // Previous DynamoDB code (commented out):
    // forkJoin({
    //   user: this.modelService.getUserByEmail(email),
    //   bookings: this.modelService.getBookingsByUser(userId),
    //   payments: this.modelService.getPaymentsByUser(userId)
    // }).pipe(takeUntil(this.destroy$))
    //   .subscribe({
    //     next: ({ user, bookings, payments }) => {
    //       this.currentUser = user;
    //       this.userBookings = bookings;
    //       this.userPayments = payments;
    //       // ... rest of the logic
    //     }
    //   });
  }

  openModal() {
    this.isModal = !this.isModal;
  }

  selectBooking(booking: BookingModel) {
    this.selectedBooking = booking;
    this.selectedPayment = this.userPayments.find(p => p.bookingId === booking.bookingId) || null;
  }

  getUserFullName(): string {
    if (!this.currentUser?.profile) return 'User';
    return `${this.currentUser.profile.firstName} ${this.currentUser.profile.lastName}`.trim() || 'User';
  }

  getFormattedAddress(): string {
    if (!this.currentUser?.address) return 'No address provided';

    const addr = this.currentUser.address;
    let formatted = '';

    if (addr.street) formatted += addr.street;
    if (addr.city) formatted += (formatted ? ', ' : '') + addr.city;
    if (addr.state) formatted += (formatted ? ', ' : '') + addr.state;
    if (addr.country) formatted += (formatted ? ', ' : '') + addr.country;
    if (addr.zipCode) formatted += (formatted ? ' ' : '') + addr.zipCode;

    return formatted || 'No address provided';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  getPaymentStatusClass(status: string): string {
    switch (status) {
      case 'succeeded':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  }

  printInvoice() {
    window.print();
  }

  downloadInvoice() {
    // TODO: Implement PDF download functionality
    console.log('Download invoice for booking:', this.selectedBooking?.bookingId);
  }
}
