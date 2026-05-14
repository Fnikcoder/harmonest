import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookingService } from '../../services/booking.service';
import { AvailableRoom, RoomSelection, BookingData } from '../../interfaces/booking.interface';
import { Subject, takeUntil } from 'rxjs';
import * as feather from 'feather-icons';

@Component({
  selector: 'app-booking-step-two',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './booking-step-two.component.html',
  styleUrl: './booking-step-two.component.scss'
})
export class BookingStepTwoComponent implements OnInit, OnDestroy, AfterViewInit {
  availableRooms: AvailableRoom[] = [];
  selectedRooms: RoomSelection[] = [];
  bookingData: Partial<BookingData> = {};
  private destroy$ = new Subject<void>();

  constructor(private bookingService: BookingService) {}

  ngOnInit(): void {
    this.availableRooms = this.bookingService.getAvailableRooms();

    this.bookingService.bookingData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.bookingData = data;
        if (data.selectedRooms) {
          this.selectedRooms = [...data.selectedRooms];
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

  get totalRoomsNeeded(): number {
    return this.bookingData.guests?.rooms || 1;
  }

  get totalRoomsSelected(): number {
    return this.selectedRooms.reduce((total, room) => total + room.quantity, 0);
  }

  isRoomSelected(roomId: string): boolean {
    return this.selectedRooms.some(room => room.roomId === roomId);
  }

  getRoomQuantity(roomId: string): number {
    const room = this.selectedRooms.find(room => room.roomId === roomId);
    return room ? room.quantity : 0;
  }

  selectRoom(room: AvailableRoom): void {
    const existingRoomIndex = this.selectedRooms.findIndex(r => r.roomId === room.id);

    if (existingRoomIndex >= 0) {
      // Room already selected, increase quantity if possible
      if (this.totalRoomsSelected < this.totalRoomsNeeded) {
        this.selectedRooms[existingRoomIndex].quantity++;
      }
    } else {
      // New room selection
      if (this.totalRoomsSelected < this.totalRoomsNeeded) {
        const roomSelection: RoomSelection = {
          roomId: room.id,
          roomName: room.name,
          roomType: room.type,
          pricePerNight: room.pricePerNight,
          quantity: 1,
          features: room.features,
          maxOccupancy: room.maxOccupancy
        };
        this.selectedRooms.push(roomSelection);
      }
    }

    this.updateBookingData();
  }

  removeRoom(roomId: string): void {
    const roomIndex = this.selectedRooms.findIndex(room => room.roomId === roomId);
    if (roomIndex >= 0) {
      if (this.selectedRooms[roomIndex].quantity > 1) {
        this.selectedRooms[roomIndex].quantity--;
      } else {
        this.selectedRooms.splice(roomIndex, 1);
      }
    }
    this.updateBookingData();
  }

  adjustRoomQuantity(roomId: string, change: number): void {
    const roomIndex = this.selectedRooms.findIndex(room => room.roomId === roomId);
    if (roomIndex >= 0) {
      const newQuantity = this.selectedRooms[roomIndex].quantity + change;

      if (newQuantity <= 0) {
        this.selectedRooms.splice(roomIndex, 1);
      } else if (change > 0 && this.totalRoomsSelected < this.totalRoomsNeeded) {
        this.selectedRooms[roomIndex].quantity = newQuantity;
      } else if (change < 0) {
        this.selectedRooms[roomIndex].quantity = newQuantity;
      }
    }
    this.updateBookingData();
  }

  private updateBookingData(): void {
    this.bookingService.updateRoomSelection(this.selectedRooms);
  }

  onNext(): void {
    if (this.canProceed()) {
      // Mark step 2 as completed before moving to next step
      this.bookingService.markStepCompleted(2);
      this.bookingService.nextStep();
    }
  }

  onPrevious(): void {
    this.bookingService.previousStep();
  }

  canProceed(): boolean {
    return this.totalRoomsSelected === this.totalRoomsNeeded &&
           this.selectedRooms.length > 0 &&
           this.hasAdequateCapacity();
  }

  hasAdequateCapacity(): boolean {
    const totalCapacity = this.selectedRooms.reduce((total, room) => {
      return total + (room.maxOccupancy * room.quantity);
    }, 0);
    const totalGuests = (this.bookingData.guests?.adults || 0) + (this.bookingData.guests?.children || 0);
    return totalCapacity >= totalGuests;
  }

  getRoomCapacityStatus(room: AvailableRoom): string {
    const totalGuests = (this.bookingData.guests?.adults || 0) + (this.bookingData.guests?.children || 0);
    const guestsPerRoom = Math.ceil(totalGuests / this.totalRoomsNeeded);

    if (room.maxOccupancy >= guestsPerRoom) {
      return 'suitable';
    } else if (room.maxOccupancy >= totalGuests) {
      return 'adequate';
    } else {
      return 'insufficient';
    }
  }

  getCapacityMessage(): string {
    if (!this.hasAdequateCapacity()) {
      const totalCapacity = this.selectedRooms.reduce((total, room) => {
        return total + (room.maxOccupancy * room.quantity);
      }, 0);
      const totalGuests = (this.bookingData.guests?.adults || 0) + (this.bookingData.guests?.children || 0);
      return `Selected rooms can accommodate ${totalCapacity} guests, but you have ${totalGuests} guests. Please select additional rooms or rooms with higher capacity.`;
    }
    return '';
  }

  getRoomTotal(room: RoomSelection): number {
    return room.pricePerNight * room.quantity * this.nights;
  }

  getTotalCost(): number {
    return this.selectedRooms.reduce((total, room) => {
      return total + this.getRoomTotal(room);
    }, 0);
  }
}
