import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookingService } from '../../services/booking.service';
import { BookingData } from '../../interfaces/booking.interface';
import { Subject, takeUntil } from 'rxjs';
import * as feather from 'feather-icons';

@Component({
  selector: 'app-booking-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './booking-summary.component.html',
  styleUrl: './booking-summary.component.scss'
})
export class BookingSummaryComponent implements OnInit, OnDestroy {
  bookingData: Partial<BookingData> = {};
  private destroy$ = new Subject<void>();

  constructor(private bookingService: BookingService) {}

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
    feather.replace();
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
    return this.bookingData.guests.adults + this.bookingData.guests.children;
  }

  get selectedServicesCount(): number {
    if (!this.bookingData.additionalServices) return 0;
    return this.bookingData.additionalServices.filter(service => service.selected).length;
  }
}
