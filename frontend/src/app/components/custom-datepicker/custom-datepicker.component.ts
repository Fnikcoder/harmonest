import { Component, Input, Output, EventEmitter, OnInit, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as feather from 'feather-icons';

interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface CalendarDay {
  date: Date | null;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isSelected: boolean;
  isInRange: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  isDisabled: boolean;
  isEmpty: boolean;
}

@Component({
  selector: 'app-custom-datepicker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './custom-datepicker.component.html',
  styleUrl: './custom-datepicker.component.scss'
})
export class CustomDatepickerComponent implements OnInit, AfterViewInit {
  @Input() selectedRange: DateRange = { start: null, end: null };
  @Input() isOpen = false;
  @Output() dateRangeSelected = new EventEmitter<DateRange>();
  @Output() closeCalendar = new EventEmitter<void>();

  currentDate = new Date();
  firstMonth: Date;
  secondMonth: Date;
  firstMonthDays: CalendarDay[] = [];
  secondMonthDays: CalendarDay[] = [];
  isMobile = false;

  monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  private tempStart: Date | null = null;
  private tempEnd: Date | null = null;

  constructor() {
    const today = new Date();
    this.firstMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    this.secondMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    this.checkScreenSize();
  }

  ngOnInit(): void {
    this.generateCalendarDays();
    this.updateSelectedDates();
  }

  ngAfterViewInit(): void {
    feather.replace();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any): void {
    this.checkScreenSize();
  }

  private checkScreenSize(): void {
    this.isMobile = window.innerWidth < 768;
  }

  generateCalendarDays(): void {
    this.firstMonthDays = this.generateMonthDays(this.firstMonth);
    this.secondMonthDays = this.generateMonthDays(this.secondMonth);
  }

  private generateMonthDays(monthDate: Date): CalendarDay[] {
    const days: CalendarDay[] = [];
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

    // Get first day of month and how many days in month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Get first day of week (0 = Sunday)
    const startingDayOfWeek = firstDay.getDay();

    // Add empty slots for previous month days (don't show actual dates)
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(this.createEmptyDay());
    }

    // Add current month's days only
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push(this.createCalendarDay(date, true));
    }

    // Add empty slots for next month days to complete the grid (42 days = 6 weeks)
    const remainingDays = 42 - days.length;
    for (let i = 0; i < remainingDays; i++) {
      days.push(this.createEmptyDay());
    }

    return days;
  }

  private createCalendarDay(date: Date, isCurrentMonth: boolean): CalendarDay {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayDate = new Date(date);
    dayDate.setHours(0, 0, 0, 0);

    return {
      date: dayDate,
      isCurrentMonth,
      isToday: dayDate.getTime() === today.getTime(),
      isPast: dayDate < today,
      isSelected: this.isDateSelected(dayDate),
      isInRange: this.isDateInRange(dayDate),
      isRangeStart: this.isRangeStart(dayDate),
      isRangeEnd: this.isRangeEnd(dayDate),
      isDisabled: dayDate < today || !isCurrentMonth,
      isEmpty: false
    };
  }

  private createEmptyDay(): CalendarDay {
    return {
      date: null,
      isCurrentMonth: false,
      isToday: false,
      isPast: false,
      isSelected: false,
      isInRange: false,
      isRangeStart: false,
      isRangeEnd: false,
      isDisabled: true,
      isEmpty: true
    };
  }

  private isDateSelected(date: Date): boolean {
    if (!this.selectedRange.start && !this.selectedRange.end) return false;

    const dateTime = date.getTime();
    const startTime = this.selectedRange.start?.getTime();
    const endTime = this.selectedRange.end?.getTime();

    return dateTime === startTime || dateTime === endTime;
  }

  private isDateInRange(date: Date): boolean {
    if (!this.selectedRange.start || !this.selectedRange.end) return false;

    const dateTime = date.getTime();
    const startTime = this.selectedRange.start.getTime();
    const endTime = this.selectedRange.end.getTime();

    return dateTime > startTime && dateTime < endTime;
  }

  private isRangeStart(date: Date): boolean {
    return this.selectedRange.start?.getTime() === date.getTime();
  }

  private isRangeEnd(date: Date): boolean {
    return this.selectedRange.end?.getTime() === date.getTime();
  }

  onDayClick(day: CalendarDay): void {
    if (day.isDisabled || day.isEmpty || !day.date) return;

    const clickedDate = new Date(day.date);

    // If no start date or both dates are set, start new selection
    if (!this.tempStart || (this.tempStart && this.tempEnd)) {
      this.tempStart = clickedDate;
      this.tempEnd = null;
      this.selectedRange = { start: clickedDate, end: null };
    }
    // If start date is set but no end date
    else if (this.tempStart && !this.tempEnd) {
      // If clicked date is before start, make it the new start
      if (clickedDate < this.tempStart) {
        this.tempEnd = this.tempStart;
        this.tempStart = clickedDate;
      } else {
        this.tempEnd = clickedDate;
      }

      this.selectedRange = { start: this.tempStart, end: this.tempEnd };

      // Emit the completed range
      this.dateRangeSelected.emit(this.selectedRange);
    }

    this.updateSelectedDates();
  }

  private updateSelectedDates(): void {
    this.firstMonthDays = this.firstMonthDays.map(day => ({
      ...day,
      isSelected: day.date ? this.isDateSelected(day.date) : false,
      isInRange: day.date ? this.isDateInRange(day.date) : false,
      isRangeStart: day.date ? this.isRangeStart(day.date) : false,
      isRangeEnd: day.date ? this.isRangeEnd(day.date) : false
    }));

    this.secondMonthDays = this.secondMonthDays.map(day => ({
      ...day,
      isSelected: day.date ? this.isDateSelected(day.date) : false,
      isInRange: day.date ? this.isDateInRange(day.date) : false,
      isRangeStart: day.date ? this.isRangeStart(day.date) : false,
      isRangeEnd: day.date ? this.isRangeEnd(day.date) : false
    }));
  }

  previousMonth(): void {
    this.firstMonth = new Date(this.firstMonth.getFullYear(), this.firstMonth.getMonth() - 1, 1);
    this.secondMonth = new Date(this.secondMonth.getFullYear(), this.secondMonth.getMonth() - 1, 1);
    this.generateCalendarDays();
    this.updateSelectedDates();
  }

  nextMonth(): void {
    this.firstMonth = new Date(this.firstMonth.getFullYear(), this.firstMonth.getMonth() + 1, 1);
    this.secondMonth = new Date(this.secondMonth.getFullYear(), this.secondMonth.getMonth() + 1, 1);
    this.generateCalendarDays();
    this.updateSelectedDates();
  }

  clearSelection(): void {
    this.selectedRange = { start: null, end: null };
    this.tempStart = null;
    this.tempEnd = null;
    this.updateSelectedDates();
    this.dateRangeSelected.emit(this.selectedRange);
  }

  close(): void {
    this.closeCalendar.emit();
  }

  getMonthYear(date: Date): string {
    return `${this.monthNames[date.getMonth()]} ${date.getFullYear()}`;
  }
}
