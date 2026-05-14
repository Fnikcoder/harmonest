import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookingService } from '../../services/booking.service';
import { BookingData } from '../../interfaces/booking.interface';
import { Subject, takeUntil } from 'rxjs';
import { Router } from '@angular/router';
import * as feather from 'feather-icons';

@Component({
  selector: 'app-booking-step-six',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './booking-step-six.component.html',
  styleUrl: './booking-step-six.component.scss'
})
export class BookingStepSixComponent implements OnInit, OnDestroy, AfterViewInit {
  bookingData: Partial<BookingData> = {};
  confirmationNumber = '';
  estimatedArrival = '';
  private destroy$ = new Subject<void>();

  constructor(
    private bookingService: BookingService,
    private router: Router
  ) {
    // Generate confirmation number
    this.confirmationNumber = this.generateConfirmationNumber();
    this.estimatedArrival = this.calculateArrivalTime();
  }

  ngOnInit(): void {
    this.bookingService.bookingData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.bookingData = data;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      feather.replace();
    }, 100);
  }

  ngAfterViewChecked(): void {
    feather.replace();
  }

  private generateConfirmationNumber(): string {
    const prefix = 'HRM';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  private calculateArrivalTime(): string {
    if (this.bookingData.dateRange?.start) {
      const checkInDate = new Date(this.bookingData.dateRange.start);
      checkInDate.setHours(15, 0, 0, 0); // 3:00 PM check-in
      return checkInDate.toLocaleString();
    }
    return '';
  }

  get nights(): number {
    if (!this.bookingData.dateRange?.start || !this.bookingData.dateRange?.end) {
      return 0;
    }
    return Math.ceil(
      (this.bookingData.dateRange.end.getTime() - this.bookingData.dateRange.start.getTime()) / 
      (1000 * 60 * 60 * 24)
    );
  }

  get totalGuests(): number {
    if (!this.bookingData.guests) return 0;
    return (this.bookingData.guests.adults || 0) + (this.bookingData.guests.children || 0);
  }

  onStartNewBooking(): void {
    this.bookingService.resetBooking();
    this.router.navigate(['/']);
  }

  onViewBookingDetails(): void {
    // Navigate to booking details page (if exists)
    console.log('View booking details:', this.confirmationNumber);
  }

  onDownloadConfirmation(): void {
    // Generate and download PDF confirmation
    console.log('Download confirmation for:', this.confirmationNumber);
  }

  onShareBooking(): void {
    // Share booking details
    if (navigator.share) {
      navigator.share({
        title: 'Hotel Booking Confirmation',
        text: `Booking confirmed! Confirmation number: ${this.confirmationNumber}`,
        url: window.location.href
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(`Booking confirmed! Confirmation number: ${this.confirmationNumber}`);
    }
  }

  onContactSupport(): void {
    // Open support contact
    window.open('mailto:support@harmonest.com?subject=Booking Support - ' + this.confirmationNumber);
  }
}
