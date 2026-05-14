import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, AuthUser } from '../../../services/auth.service';
import { ModelService } from '../../../services/model.service';
import * as feather from 'feather-icons';

interface DashboardStats {
  totalReservations: number;
  activeReservations: number;
  totalRevenue: number;
  totalListings: number;
  activeListings: number;
  pendingCheckIns: number;
}

interface DashboardSection {
  id: string;
  title: string;
  count: number;
  status: string;
  icon: string;
  color: string;
  items: any[];
}

interface ReservationSummary {
  id: string;
  reservationCode: string;
  guestName: string;
  roomName: string;
  checkInDate: Date;
  checkOutDate: Date;
  status: string;
  price: number;
  currency: string;
  nights: number;
  guests: number;
  phoneNumber?: string;
  checkInStatus?: string;
}

interface ListingSummary {
  id: string;
  roomName: string;
  roomAlias: string;
  groupName: string;
  status: string;
  platforms: string[];
  hostName: string;
  lastSync: Date;
  isActive: boolean;
}

interface RecentActivity {
  id: string;
  type: 'booking' | 'payment' | 'message' | 'maintenance';
  title: string;
  description: string;
  timestamp: Date;
  status: 'success' | 'warning' | 'error' | 'info';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  private destroy$ = new Subject<void>();

  currentUser: AuthUser | null = null;
  stats: DashboardStats = {
    totalReservations: 0,
    activeReservations: 0,
    totalRevenue: 0,
    totalListings: 0,
    activeListings: 0,
    pendingCheckIns: 0
  };

  sections: DashboardSection[] = [];
  recentActivities: RecentActivity[] = [];

  // Modal state
  selectedItem: any = null;
  selectedItemType: 'reservation' | 'listing' | null = null;
  showDetailModal = false;

  constructor(
    private authService: AuthService,
    private modelService: ModelService
  ) {}

  ngOnInit() {
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(authState => {
        this.currentUser = authState.user;
        // Reload dashboard data when authentication state changes
        this.loadDashboardData();
      });

    // Initial load
    this.loadDashboardData();
  }

  ngAfterViewInit() {
    feather.replace();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async loadDashboardData() {
    try {
      // Check if user has DynamoDB access first
      const userInfo = await this.modelService.getCurrentUserInfo();

      if (!userInfo?.isAuthenticated) {
        console.log('User not authenticated, showing default dashboard');
        this.showDefaultDashboard();
        return;
      }

      if (!userInfo.hasDBAccess) {
        console.log(`User role '${userInfo.role}' does not have DynamoDB access, showing limited dashboard`);
        this.showLimitedDashboard(userInfo.role);
        return;
      }

      // Load data from DynamoDB
      const [reservations, listings] = await Promise.all([
        this.loadReservations(),
        this.loadListings()
      ]);

      // Calculate stats
      this.stats = {
        totalReservations: reservations.length,
        activeReservations: reservations.filter(r => r.status === 'confirmed' || r.status === 'checked_in').length,
        totalRevenue: reservations.reduce((sum, r) => sum + (r.price || 0), 0),
        totalListings: listings.length,
        activeListings: listings.filter(l => l.status === 'active').length,
        pendingCheckIns: reservations.filter(r => r.status === 'confirmed' && this.isCheckInPending(r)).length
      };

      // Create sections data
      this.sections = [
        {
          id: 'reservations',
          title: 'Reservations',
          count: this.stats.totalReservations,
          status: `${this.stats.activeReservations} active`,
          icon: 'calendar',
          color: 'blue',
          items: reservations.slice(0, 5) // Show latest 5
        },
        {
          id: 'listings',
          title: 'Listings',
          count: this.stats.totalListings,
          status: `${this.stats.activeListings} active`,
          icon: 'home',
          color: 'green',
          items: listings.slice(0, 5) // Show latest 5
        }
      ];

      this.generateRecentActivities(reservations);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.showErrorDashboard();
    }
  }

  private async loadReservations(): Promise<ReservationSummary[]> {
    try {
      const bookings = await this.modelService.getBookings();
      return bookings.map(booking => this.mapToReservationSummary(booking));
    } catch (error) {
      console.error('Error loading reservations:', error);
      return [];
    }
  }

  private mapToReservationSummary(booking: any): ReservationSummary {
    return {
      id: booking.reservationId?.S || booking.reservationId || '',
      reservationCode: booking.reservationCode?.S || booking.reservationCode || '',
      guestName: `${booking.guestName?.S || booking.guestName || ''} ${booking.guestSurname?.S || booking.guestSurname || ''}`.trim(),
      roomName: booking.roomName?.S || booking.roomName || '',
      checkInDate: new Date(parseInt(booking.checkInDate?.N || booking.checkInDate) || Date.now()),
      checkOutDate: new Date(parseInt(booking.checkOutDate?.N || booking.checkOutDate) || Date.now()),
      status: this.getReservationStatus(booking),
      price: parseInt(booking.price?.N || booking.price) || 0,
      currency: booking.currency?.S || booking.currency || 'EUR',
      nights: parseInt(booking.nights?.N || booking.nights) || 1,
      guests: (parseInt(booking.numOfAdults?.N || booking.numOfAdults) || 0) +
              (parseInt(booking.numOfKids?.N || booking.numOfKids) || 0) +
              (parseInt(booking.numOfInfants?.N || booking.numOfInfants) || 0),
      phoneNumber: booking.phoneNumber?.S || booking.phoneNumber,
      checkInStatus: booking.customFields?.M?.checkin?.M?.status?.S || 'pending'
    };
  }

  private getReservationStatus(booking: any): string {
    const status = booking.status?.N || booking.status;
    const checkInStatus = booking.customFields?.M?.checkin?.M?.status?.S;

    if (status === '1' || status === 1) {
      if (checkInStatus === 'completed') return 'checked_in';
      return 'confirmed';
    }
    return 'pending';
  }

  private async loadListings(): Promise<ListingSummary[]> {
    try {
      const listings = await this.modelService.getPropertyGroups();
      return listings.map(listing => this.mapToListingSummary(listing));
    } catch (error) {
      console.error('Error loading listings:', error);
      return [];
    }
  }

  private mapToListingSummary(listing: any): ListingSummary {
    const platforms = [];

    // Check for different platform connections
    if (listing.channelSummary?.M?.airbnb?.M?.status?.S === 'connected') {
      platforms.push('Airbnb');
    }
    if (listing.channelSummary?.M?.booking?.M?.hotel?.M?.active?.BOOL) {
      platforms.push('Booking.com');
    }
    if (listing.channelSummary?.M?.vrbo?.M?.hasListings?.BOOL) {
      platforms.push('VRBO');
    }

    return {
      id: listing.roomId?.S || listing.roomId || '',
      roomName: listing.roomName?.S || listing.roomName || '',
      roomAlias: listing.roomAlias?.S || listing.roomAlias || '',
      groupName: listing.group?.M?.groupName?.S || 'No Group',
      status: listing.deleted?.BOOL === false ? 'active' : 'inactive',
      platforms: platforms,
      hostName: listing.primaryHost?.M?.firstName?.S || 'Unknown Host',
      lastSync: new Date(parseInt(listing.lastGuestySync?.N || listing.sourceUpdatedAt?.N) || Date.now()),
      isActive: listing.deleted?.BOOL === false
    };
  }



  private isCheckInPending(reservation: any): boolean {
    if (!reservation.checkInDate) return false;
    const checkInDate = new Date(reservation.checkInDate);
    const today = new Date();
    const diffTime = checkInDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 1 && diffDays >= 0; // Check-in is today or tomorrow
  }

  private showDefaultDashboard() {
    this.stats = {
      totalReservations: 0,
      activeReservations: 0,
      totalRevenue: 0,
      totalListings: 0,
      activeListings: 0,
      pendingCheckIns: 0
    };
    this.sections = [];
    this.recentActivities = [{
      id: 'welcome-1',
      type: 'message',
      title: 'Welcome to Harmonest',
      description: 'Please sign in to view your dashboard data',
      timestamp: new Date(),
      status: 'info'
    }];
  }

  private showLimitedDashboard(role: string) {
    this.stats = {
      totalReservations: 0,
      activeReservations: 0,
      totalRevenue: 0,
      totalListings: 0,
      activeListings: 0,
      pendingCheckIns: 0
    };
    this.sections = [];
    this.recentActivities = [{
      id: 'access-warning-1',
      type: 'message',
      title: 'Limited Access',
      description: `Your role '${role}' has limited dashboard access. Contact an administrator for more permissions.`,
      timestamp: new Date(),
      status: 'warning'
    }];
  }

  private showErrorDashboard() {
    this.stats = {
      totalReservations: 0,
      activeReservations: 0,
      totalRevenue: 0,
      totalListings: 0,
      activeListings: 0,
      pendingCheckIns: 0
    };
    this.sections = [];
    this.recentActivities = [{
      id: 'error-1',
      type: 'maintenance',
      title: 'Error Loading Data',
      description: 'There was an error loading dashboard data. Please try again later.',
      timestamp: new Date(),
      status: 'error'
    }];
  }

  /**
   * Refresh AWS credentials and reload dashboard
   */
  async refreshCredentials() {
    try {
      console.log('🔄 [Dashboard] Refreshing AWS credentials...');
      await this.modelService.refreshAWSCredentials();
      console.log('✅ [Dashboard] Credentials refreshed, reloading dashboard...');
      await this.loadDashboardData();
    } catch (error) {
      console.error('❌ [Dashboard] Failed to refresh credentials:', error);
      alert('Failed to refresh credentials. Please try signing out and back in.');
    }
  }



  /**
   * Open detail modal for an item
   */
  openDetailModal(item: any, type: 'reservation' | 'listing') {
    this.selectedItem = item;
    this.selectedItemType = type;
    this.showDetailModal = true;
  }

  /**
   * Close detail modal
   */
  closeDetailModal() {
    this.selectedItem = null;
    this.selectedItemType = null;
    this.showDetailModal = false;
  }

  /**
   * Get formatted date string
   */
  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Get formatted date and time string
   */
  formatDateTime(date: Date): string {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Get icon for activity type
   */
  getActivityIcon(type: string): string {
    switch (type) {
      case 'booking':
        return 'calendar';
      case 'payment':
        return 'credit-card';
      case 'message':
        return 'message-circle';
      case 'maintenance':
        return 'tool';
      default:
        return 'activity';
    }
  }

  private calculateOccupancyRate(bookings: any[], totalUnits: number): number {
    if (totalUnits === 0) return 0;
    const occupiedUnits = bookings.filter(b =>
      b.status === 'confirmed' || b.status === 'checked_in'
    ).length;
    return Math.round((occupiedUnits / totalUnits) * 100);
  }

  private generateRecentActivities(bookings: any[]) {
    this.recentActivities = [
      {
        id: '1',
        type: 'booking',
        title: 'New Booking Received',
        description: 'Apartment 2B booked for next week',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: 'success'
      },
      {
        id: '2',
        type: 'payment',
        title: 'Payment Processed',
        description: 'Payment of €450 received for booking #1234',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
        status: 'success'
      },
      {
        id: '3',
        type: 'message',
        title: 'Guest Message',
        description: 'Guest inquiry about early check-in',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
        status: 'info'
      },
      {
        id: '4',
        type: 'maintenance',
        title: 'Maintenance Request',
        description: 'AC unit needs repair in Unit 3A',
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
        status: 'warning'
      }
    ];
  }


}
