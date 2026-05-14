import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookingService } from '../../services/booking.service';
import { AdditionalService, BookingData } from '../../interfaces/booking.interface';
import { Subject, takeUntil } from 'rxjs';
import * as feather from 'feather-icons';

@Component({
  selector: 'app-booking-step-three',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './booking-step-three.component.html',
  styleUrl: './booking-step-three.component.scss'
})
export class BookingStepThreeComponent implements OnInit, OnDestroy, AfterViewInit {
  additionalServices: AdditionalService[] = [];
  bookingData: Partial<BookingData> = {};
  private destroy$ = new Subject<void>();

  constructor(private bookingService: BookingService) {}

  ngOnInit(): void {
    this.additionalServices = this.bookingService.getAdditionalServices();

    this.bookingService.bookingData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.bookingData = data;
        if (data.additionalServices) {
          this.additionalServices = [...data.additionalServices];
        }
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

  get nights(): number {
    if (!this.bookingData.dateRange?.start || !this.bookingData.dateRange?.end) {
      return 0;
    }
    return Math.ceil(
      (this.bookingData.dateRange.end.getTime() - this.bookingData.dateRange.start.getTime()) /
      (1000 * 60 * 60 * 24)
    );
  }

  toggleService(serviceId: string): void {
    const service = this.additionalServices.find(s => s.id === serviceId);
    if (service) {
      service.selected = !service.selected;
      if (service.selected && !service.quantity) {
        service.quantity = 1;
      }
      this.updateBookingData();
    }
  }

  adjustServiceQuantity(serviceId: string, change: number): void {
    const service = this.additionalServices.find(s => s.id === serviceId);
    if (service && service.selected) {
      const newQuantity = (service.quantity || 1) + change;
      if (newQuantity > 0) {
        service.quantity = newQuantity;
        this.updateBookingData();
      }
    }
  }

  private updateBookingData(): void {
    this.bookingService.updateAdditionalServices(this.additionalServices);
  }

  onNext(): void {
    // Mark step 3 as completed before moving to next step
    this.bookingService.markStepCompleted(3);
    this.bookingService.nextStep();
  }

  onPrevious(): void {
    this.bookingService.previousStep();
  }

  getSelectedServicesCount(): number {
    return this.additionalServices.filter(service => service.selected).length;
  }

  getSelectedServicesTotal(): number {
    return this.additionalServices
      .filter(service => service.selected)
      .reduce((total, service) => {
        return total + (service.price * (service.quantity || 1) * this.nights);
      }, 0);
  }
}
