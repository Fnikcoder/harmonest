import { Component, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomDatepickerComponent } from '../../components/custom-datepicker/custom-datepicker.component';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { SwitcherComponent } from '../../components/switcher/switcher.component';
import * as feather from 'feather-icons';

@Component({
  selector: 'app-datepicker-demo',
  standalone: true,
  imports: [
    CommonModule,
    CustomDatepickerComponent,
    NavbarComponent,
    FooterComponent,
    SwitcherComponent
  ],
  templateUrl: './datepicker-demo.component.html',
  styleUrl: './datepicker-demo.component.scss'
})
export class DatepickerDemoComponent implements AfterViewInit {
  showDatepicker = false;
  selectedRange: { start: Date | null; end: Date | null } = { start: null, end: null };

  ngAfterViewInit(): void {
    feather.replace();
  }

  openDatepicker(): void {
    this.showDatepicker = true;
  }

  closeDatepicker(): void {
    this.showDatepicker = false;
  }

  onDateRangeSelected(dateRange: { start: Date | null; end: Date | null }): void {
    this.selectedRange = dateRange;
    console.log('Selected date range:', dateRange);
  }

  clearSelection(): void {
    this.selectedRange = { start: null, end: null };
  }
}
