// booking-form.component.ts
import { Component, HostListener, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CustomDatepickerComponent } from '../custom-datepicker/custom-datepicker.component';
import { DatePipe, NgIf } from '@angular/common';
import feather from 'feather-icons';

@Component({
  selector: 'app-form-single-listing',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DatePipe,
    NgIf,
    CustomDatepickerComponent
  ],
  templateUrl: './form-single-listing.component.html',
  styleUrl: './form-single-listing.component.scss'
})
export class FormSingleListingComponent {
  @Input() initialDateRange: { start: Date | null; end: Date | null } = { start: null, end: null };
  @Input() initialGuests: { rooms: number; adults: number; children: number } = { rooms: 1, adults: 1, children: 0 };
  @Output() submitBooking = new EventEmitter<any>();

  form: FormGroup;
  guests = { rooms: 1, adults: 1, children: 0 };
  showGuestDropdown = false;
  showDatepicker = false;

  constructor(private fb: FormBuilder, private router: Router) {
    this.form = this.fb.group({
      dateRange: this.fb.group({
        start: [null],
        end: [null]
      })
    });
  }

  get dateRangeGroup(): FormGroup {
    return this.form.get('dateRange') as FormGroup;
  }

  ngOnInit(): void {
    this.dateRangeGroup.patchValue({
      start: this.initialDateRange.start,
      end: this.initialDateRange.end
    });
    this.guests = { ...this.initialGuests };
  }

  ngAfterViewInit(): void {
    feather.replace();
  }

  ngAfterViewChecked(): void {
    feather.replace();
  }

  adjustGuests(type: 'rooms' | 'adults' | 'children', change: number): void {
    const newValue = this.guests[type] + change;
    if (newValue < 0) return;
    this.guests[type] = newValue;
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.guest-selector')) {
      this.showGuestDropdown = false;
    }
  }

  openDatepicker(): void {
    this.showDatepicker = true;
  }

  closeDatepicker(): void {
    this.showDatepicker = false;
  }

  onDateRangeSelected(dateRange: { start: Date | null; end: Date | null }): void {
    this.form.get('dateRange')?.patchValue({
      start: dateRange.start,
      end: dateRange.end
    });
  }

  onSearch(): void {
    if (this.form.valid) {
      const bookingData = {
        dateRange: this.form.value.dateRange,
        guests: this.guests
      };

      // Navigate to booking page with query parameters
      this.router.navigate(['/booking'], {
        queryParams: {
          start: this.form.value.dateRange.start?.toISOString(),
          end: this.form.value.dateRange.end?.toISOString(),
          rooms: this.guests.rooms,
          adults: this.guests.adults,
          children: this.guests.children
        }
      });

      // Still emit the event for backward compatibility
      this.submitBooking.emit(bookingData);
    } else {
      console.warn('Form is invalid');
    }
  }
}
