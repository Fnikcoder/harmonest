import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { NavbarComponent } from '../../../../components/navbar/navbar.component';
import { TabAccountComponent } from '../../../../components/tab-account/tab-account.component';
import { FooterComponent } from '../../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../../components/switcher/switcher.component';

import { AuthService } from '../../../../services/auth.service';
import { UserService, User } from '../../../../services/user.service';
import { ModelService } from '../../../../services/model.service';
import { BookingModel } from '../../../../interfaces/booking.interface';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NavbarComponent,
    TabAccountComponent,
    FooterComponent,
    SwitcherComponent
  ],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss'
})
export class UserProfileComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  currentUser: User | null = null;
  userBookings: BookingModel[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private authService: AuthService,
    private userService: UserService,
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
            this.loadUserProfile(authState.user.userId);
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

  private async loadUserProfile(userId: string) {
    try {
      // Get user profile from Cognito
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser?.email) {
        this.loading = false;
        this.error = 'No authenticated user found';
        return;
      }

      this.userService.getUserByEmail(currentUser.email)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (user: User | null) => {
            this.currentUser = user;
            if (user) {
              this.loadUserBookings(user.userId);
            } else {
              this.loading = false;
            }
          },
          error: (error: any) => {
            console.error('Error loading user profile:', error);
            this.loading = false;
            this.error = 'Failed to load user profile';
          }
        });
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
      this.loading = false;
      this.error = 'Failed to load user data';
    }
  }

  private loadUserBookings(userId: string) {
    // Use ModelService to get bookings from DynamoDB using userId
    this.modelService.getBookingsByUser(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (bookings: BookingModel[]) => {
          this.userBookings = bookings;
          this.loading = false;
          console.log(`Loaded ${bookings.length} bookings for user ${userId}`);
        },
        error: (error: any) => {
          console.error('Error loading user bookings:', error);
          this.userBookings = [];
          this.loading = false;
        }
      });
  }

  getUserFullName(): string {
    if (!this.currentUser) return 'User';
    return `${this.currentUser.firstName} ${this.currentUser.lastName}`.trim() || 'User';
  }

  getUserInitials(): string {
    if (!this.currentUser) return 'U';
    const firstName = this.currentUser.firstName || '';
    const lastName = this.currentUser.lastName || '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'U';
  }

  formatBookingDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  getBookingStatus(booking: BookingModel): string {
    const now = new Date();
    const checkIn = new Date(booking.stay.checkIn);
    const checkOut = new Date(booking.stay.checkOut);

    if (now < checkIn) return 'Upcoming';
    if (now >= checkIn && now <= checkOut) return 'Active';
    return 'Completed';
  }

  protected readonly String = String;
}
