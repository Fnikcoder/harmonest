import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  BookingData,
  BookingStep,
  GuestDetails,
  BookingDateRange,
  BookingGuest,
  RoomSelection,
  AdditionalService,
  PaymentDetails,
  AvailableRoom
} from '../interfaces/booking.interface';

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private currentStepSubject = new BehaviorSubject<number>(1);
  private bookingDataSubject = new BehaviorSubject<Partial<BookingData>>({});

  currentStep$ = this.currentStepSubject.asObservable();
  bookingData$ = this.bookingDataSubject.asObservable();

  private steps: BookingStep[] = [
    { id: 1, title: 'Guest Details', description: '', completed: false, active: true },
    { id: 2, title: 'Room', description: '', completed: false, active: false },
    { id: 3, title: 'Additional', description: '', completed: false, active: false },
    { id: 4, title: 'Review', description: '', completed: false, active: false },
    { id: 5, title: 'Payment', description: '', completed: false, active: false },
    { id: 6, title: 'Confirmation', description: '', completed: false, active: false }
  ];

  private completedSteps: Set<number> = new Set();

  private availableRooms: AvailableRoom[] = [
    {
      id: 'deluxe-001',
      name: 'Deluxe Ocean View',
      type: 'Deluxe',
      description: 'Spacious room with stunning ocean views and modern amenities',
      pricePerNight: 299,
      maxOccupancy: 2,
      features: ['Ocean View', 'King Bed', 'Balcony', 'Mini Bar', 'WiFi'],
      images: ['assets/images/rooms/deluxe-1.jpg'],
      available: true
    },
    {
      id: 'suite-001',
      name: 'Executive Suite',
      type: 'Suite',
      description: 'Luxurious suite with separate living area and premium amenities',
      pricePerNight: 499,
      maxOccupancy: 4,
      features: ['Separate Living Room', 'King Bed', 'Jacuzzi', 'Butler Service', 'WiFi'],
      images: ['assets/images/rooms/suite-1.jpg'],
      available: true
    },
    {
      id: 'standard-001',
      name: 'Standard Room',
      type: 'Standard',
      description: 'Comfortable room with essential amenities',
      pricePerNight: 199,
      maxOccupancy: 2,
      features: ['Queen Bed', 'City View', 'WiFi', 'Air Conditioning'],
      images: ['assets/images/rooms/standard-1.jpg'],
      available: true
    }
  ];

  private additionalServices: AdditionalService[] = [
    { id: 'breakfast', name: 'Breakfast Package', description: 'Daily continental breakfast', price: 25, selected: false },
    { id: 'spa', name: 'Spa Package', description: 'Access to spa facilities', price: 75, selected: false },
    { id: 'airport', name: 'Airport Transfer', description: 'Round-trip airport transportation', price: 50, selected: false },
    { id: 'wifi', name: 'Premium WiFi', description: 'High-speed internet access', price: 15, selected: false },
    { id: 'parking', name: 'Valet Parking', description: 'Daily valet parking service', price: 30, selected: false }
  ];

  constructor() {
    this.initializeBookingData();
  }

  private initializeBookingData(): void {
    const initialData: Partial<BookingData> = {
      guestDetails: {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        specialRequests: ''
      },
      dateRange: {
        start: null,
        end: null
      },
      guests: {
        rooms: 1,
        adults: 1,
        children: 0
      },
      selectedRooms: [],
      additionalServices: [...this.additionalServices],
      subtotal: 0,
      taxes: 0,
      total: 0
    };
    this.bookingDataSubject.next(initialData);
  }

  getSteps(): BookingStep[] {
    return [...this.steps];
  }

  getCurrentStep(): number {
    return this.currentStepSubject.value;
  }

  setCurrentStep(step: number): void {
    if (step >= 1 && step <= this.steps.length) {
      // Mark previous steps as completed when moving forward
      if (step > this.currentStepSubject.value) {
        for (let i = 1; i < step; i++) {
          this.completedSteps.add(i);
        }
      }
      this.currentStepSubject.next(step);
      this.updateStepStatus(step);
    }
  }

  nextStep(): void {
    const currentStep = this.currentStepSubject.value;
    if (currentStep < this.steps.length) {
      // Mark current step as completed
      this.completedSteps.add(currentStep);
      this.setCurrentStep(currentStep + 1);
    }
  }

  previousStep(): void {
    const currentStep = this.currentStepSubject.value;
    if (currentStep > 1) {
      this.setCurrentStep(currentStep - 1);
    }
  }

  private updateStepStatus(currentStep: number): void {
    this.steps.forEach((step, index) => {
      step.active = step.id === currentStep;
      step.completed = this.completedSteps.has(step.id);
    });
  }

  markStepCompleted(stepId: number): void {
    this.completedSteps.add(stepId);
    this.updateStepStatus(this.currentStepSubject.value);
  }

  isStepAccessible(stepId: number): boolean {
    // Step 1 is always accessible
    if (stepId === 1) return true;

    // Other steps are accessible if previous step is completed or if it's a completed step
    return this.completedSteps.has(stepId - 1) || this.completedSteps.has(stepId) || stepId <= this.currentStepSubject.value;
  }

  updateGuestDetails(guestDetails: GuestDetails): void {
    const currentData = this.bookingDataSubject.value;
    this.bookingDataSubject.next({
      ...currentData,
      guestDetails
    });
  }

  updateEmailVerificationStatus(email: string, isVerified: boolean): void {
    const currentData = this.bookingDataSubject.value;
    if (currentData.guestDetails) {
      this.bookingDataSubject.next({
        ...currentData,
        guestDetails: {
          ...currentData.guestDetails,
          emailVerified: isVerified
        }
      });
    }
  }

  updatePaymentResult(paymentResult: any): void {
    const currentData = this.bookingDataSubject.value;
    this.bookingDataSubject.next({
      ...currentData,
      paymentResult
    });
  }

  updateDateRange(dateRange: BookingDateRange): void {
    const currentData = this.bookingDataSubject.value;
    this.bookingDataSubject.next({
      ...currentData,
      dateRange
    });
    this.calculateTotal();
  }

  updateGuests(guests: BookingGuest): void {
    const currentData = this.bookingDataSubject.value;
    this.bookingDataSubject.next({
      ...currentData,
      guests
    });
  }

  updateRoomSelection(rooms: RoomSelection[]): void {
    const currentData = this.bookingDataSubject.value;
    this.bookingDataSubject.next({
      ...currentData,
      selectedRooms: rooms
    });
    this.calculateTotal();
  }

  updateAdditionalServices(services: AdditionalService[]): void {
    const currentData = this.bookingDataSubject.value;
    this.bookingDataSubject.next({
      ...currentData,
      additionalServices: services
    });
    this.calculateTotal();
  }

  updatePaymentDetails(paymentDetails: PaymentDetails): void {
    const currentData = this.bookingDataSubject.value;
    this.bookingDataSubject.next({
      ...currentData,
      paymentDetails
    });
  }

  getAvailableRooms(): AvailableRoom[] {
    return [...this.availableRooms];
  }

  getAdditionalServices(): AdditionalService[] {
    return [...this.additionalServices];
  }

  private calculateTotal(): void {
    const currentData = this.bookingDataSubject.value;
    const { selectedRooms = [], additionalServices = [], dateRange } = currentData;

    if (!dateRange?.start || !dateRange?.end) {
      return;
    }

    const nights = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate room costs
    const roomTotal = selectedRooms.reduce((total, room) => {
      return total + (room.pricePerNight * room.quantity * nights);
    }, 0);

    // Calculate additional services
    const servicesTotal = additionalServices
      .filter(service => service.selected)
      .reduce((total, service) => {
        return total + (service.price * (service.quantity || 1) * nights);
      }, 0);

    const subtotal = roomTotal + servicesTotal;
    const taxes = subtotal * 0.12; // 12% tax
    const total = subtotal + taxes;

    this.bookingDataSubject.next({
      ...currentData,
      subtotal,
      taxes,
      total
    });
  }

  confirmBooking(): Observable<any> {
    // Simulate API call
    return new Observable(observer => {
      setTimeout(() => {
        const bookingId = 'BK' + Date.now();
        const currentData = this.bookingDataSubject.value;

        this.bookingDataSubject.next({
          ...currentData,
          bookingId,
          status: 'confirmed',
          createdAt: new Date()
        });

        observer.next({ success: true, bookingId });
        observer.complete();
      }, 2000);
    });
  }

  resetBooking(): void {
    this.setCurrentStep(1);
    this.initializeBookingData();
  }
}
