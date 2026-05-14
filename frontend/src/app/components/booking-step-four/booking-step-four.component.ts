import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookingService } from '../../services/booking.service';
import { BookingData } from '../../interfaces/booking.interface';
import { Subject, takeUntil } from 'rxjs';
import * as feather from 'feather-icons';

@Component({
  selector: 'app-booking-step-four',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './booking-step-four.component.html',
  styleUrl: './booking-step-four.component.scss'
})
export class BookingStepFourComponent implements OnInit, OnDestroy, AfterViewInit {
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

  get totalGuests(): number {
    if (!this.bookingData.guests) return 0;
    return (this.bookingData.guests.adults || 0) + (this.bookingData.guests.children || 0);
  }

  get selectedServicesCount(): number {
    if (!this.bookingData.additionalServices) return 0;
    return this.bookingData.additionalServices.filter(service => service.selected).length;
  }

  get selectedServices() {
    if (!this.bookingData.additionalServices) return [];
    return this.bookingData.additionalServices.filter(service => service.selected);
  }

  getRoomTotal(room: any): number {
    if (!room || !room.pricePerNight || !room.quantity) return 0;
    return room.pricePerNight * room.quantity * this.nights;
  }

  getServiceTotal(service: any): number {
    if (!service || !service.price) return 0;
    return service.price * (service.quantity || 1) * this.nights;
  }

  getAccommodationTotal(): number {
    if (!this.bookingData.selectedRooms) return 0;
    return this.bookingData.selectedRooms.reduce((total, room) => {
      return total + this.getRoomTotal(room);
    }, 0);
  }

  getServicesTotal(): number {
    return this.selectedServices.reduce((total, service) => {
      return total + this.getServiceTotal(service);
    }, 0);
  }

  onNext(): void {
    // Mark step 4 as completed before moving to payment
    this.bookingService.markStepCompleted(4);
    this.bookingService.nextStep();
  }

  onPrevious(): void {
    this.bookingService.previousStep();
  }

  editStep(stepNumber: number): void {
    this.bookingService.setCurrentStep(stepNumber);
  }
}
