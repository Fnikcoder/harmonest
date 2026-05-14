import {Component, HostListener} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {DatePipe, NgClass, NgForOf, NgIf} from '@angular/common';
import feather from 'feather-icons';
import { Router } from '@angular/router';
import { CustomDatepickerComponent } from '../custom-datepicker/custom-datepicker.component';


@Component({
  selector: 'app-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DatePipe,
    NgForOf,
    NgIf,
    NgClass,
    CustomDatepickerComponent
  ],
  templateUrl: './form.component.html',
  styleUrl: './form.component.scss'
})
export class FormComponent {
  form: FormGroup;
  locations: string[] = [
    'München Gladbach',
    'Düsseldorf',
    'Hamburg',
    'Berlin',
    'Stuttgart'
  ];
  guests = {
    rooms: 1,
    adults: 1,
    children: 0
  };

  constructor(private fb: FormBuilder, private router: Router) {
    this.form = this.fb.group({
      location: [""],
      dateRange: this.fb.group({
        start: [null],
        end: [null]
      })
    });
  }

  get dateRangeGroup(): FormGroup {
    return this.form.get('dateRange') as FormGroup;
  }
  ngAfterViewInit(): void {
    feather.replace();
  }
  showGuestDropdown = false;
  showDatepicker = false;

  adjustGuests(type: 'rooms' | 'adults' | 'children', change: number) {
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
  ngAfterViewChecked(): void {
    feather.replace();
  }


  onSearch() {
    if (this.form.valid) {
      const dateRange = this.form.value.dateRange;
      const startDate = dateRange.start;
      const endDate = dateRange.end;
      const guests = this.guests;
      const location = this.form.value.location || 'Not selected';
      this.router.navigate(['/search'], {
        queryParams: {
          location: location,
          start: startDate?.toISOString(),
          end: endDate?.toISOString(),
          rooms: guests.rooms,
          adults: guests.adults,
          children: guests.children
        }
      }).then(r => null);

    } else {
      console.warn('Form is invalid');
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

  get isFormReady(): boolean {
    const { location, dateRange } = this.form.value;
    return !!location && !!dateRange.start && !!dateRange.end;
  }

}
