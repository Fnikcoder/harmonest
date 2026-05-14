import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ModelService } from '../../../services/model.service';
import * as feather from 'feather-icons';

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'booking' | 'maintenance' | 'blocked' | 'available';
  propertyId: string;
  unitId: string;
  guestName?: string;
  status: string;
}

@Component({
  selector: 'app-calendar-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar-management.component.html'



})
export class CalendarManagementComponent implements OnInit, OnDestroy, AfterViewInit {
  private destroy$ = new Subject<void>();

  showLearning = false;
  showBlockModal = false;

  properties: any[] = [];
  units: any[] = [];
  events: CalendarEvent[] = [];
  filteredEvents: CalendarEvent[] = [];

  selectedProperty = '';
  selectedUnit = '';
  selectedEventType = '';
  calendarView = 'month';

  currentDate = new Date();
  daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  calendarDays: any[] = [];

  blockForm = {
    propertyId: '',
    startDate: '',
    endDate: '',
    reason: 'maintenance'
  };

  get filteredUnits() {
    if (!this.selectedProperty) return this.units;
    return this.units.filter(unit => unit.propertyGroupId === this.selectedProperty);
  }

  constructor(private modelService: ModelService) {}

  ngOnInit() {
    this.loadData();
    this.generateCalendarDays();
  }

  ngAfterViewInit() {
    feather.replace();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadData() {
    try {
      this.properties = await this.modelService.getPropertyGroups();
      this.units = await this.modelService.getIndividualUnits();
      const bookings = await this.modelService.getBookings();

      // Convert bookings to calendar events
      this.events = bookings.map(booking => ({
        id: booking.bookingId,
        title: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName} - ${booking.stay.assignedUnits[0]?.unitName || 'Unit'}`,
        start: new Date(booking.stay.checkIn),
        end: new Date(booking.stay.checkOut),
        type: 'booking' as const,
        propertyId: booking.propertyGroupId,
        unitId: booking.stay.assignedUnits[0]?.unitId || '',
        guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
        status: booking.status
      }));

      this.filterEvents();
    } catch (error) {
      console.error('Error loading calendar data:', error);
    }
  }

  filterEvents() {
    this.filteredEvents = this.events.filter(event => {
      const matchesProperty = !this.selectedProperty || event.propertyId === this.selectedProperty;
      const matchesUnit = !this.selectedUnit || event.unitId === this.selectedUnit;
      const matchesType = !this.selectedEventType || event.type === this.selectedEventType;

      return matchesProperty && matchesUnit && matchesType;
    });
  }

  generateCalendarDays() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    this.calendarDays = [];
    const today = new Date();

    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      this.calendarDays.push({
        date: date,
        isCurrentMonth: date.getMonth() === month,
        isToday: date.toDateString() === today.toDateString()
      });
    }
  }

  getEventsForDay(date: Date): CalendarEvent[] {
    return this.filteredEvents.filter(event => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      return date >= eventStart && date <= eventEnd;
    });
  }

  getEventClass(type: string): string {
    const classes = {
      booking: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      maintenance: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      blocked: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      available: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    };
    return classes[type as keyof typeof classes] || classes.available;
  }

  getCurrentPeriodTitle(): string {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long' };
    return this.currentDate.toLocaleDateString('en-US', options);
  }

  previousPeriod() {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.generateCalendarDays();
  }

  nextPeriod() {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.generateCalendarDays();
  }

  goToToday() {
    this.currentDate = new Date();
    this.generateCalendarDays();
  }

  changeView() {
    this.generateCalendarDays();
  }

  blockDate(date: Date) {
    this.blockForm.startDate = date.toISOString().split('T')[0];
    this.blockForm.endDate = date.toISOString().split('T')[0];
    this.showBlockModal = true;
  }

  blockDates() {
    // Implementation for blocking dates
    console.log('Blocking dates:', this.blockForm);
    this.showBlockModal = false;
  }

  viewEvent(event: CalendarEvent) {
    // Implementation for viewing event details
    console.log('Viewing event:', event);
  }

  getEventCount(type: string): number {
    return this.filteredEvents.filter(event => event.type === type).length;
  }

  getOccupancyRate(): number {
    const totalDays = this.calendarDays.length;
    const bookedDays = this.filteredEvents.filter(event => event.type === 'booking').length;
    return totalDays > 0 ? Math.round((bookedDays / totalDays) * 100) : 0;
  }
}
