import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { BookingService } from '../../services/booking.service';
import { Subject, takeUntil } from 'rxjs';
import * as feather from 'feather-icons';

// Components
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { SwitcherComponent } from '../../components/switcher/switcher.component';
import { BookingProgressComponent } from '../../components/booking-progress/booking-progress.component';
import { BookingSummaryComponent } from '../../components/booking-summary/booking-summary.component';
import { BookingStepOneComponent } from '../../components/booking-step-one/booking-step-one.component';
import { BookingStepTwoComponent } from '../../components/booking-step-two/booking-step-two.component';
import { BookingStepThreeComponent } from '../../components/booking-step-three/booking-step-three.component';
import { BookingStepFourComponent } from '../../components/booking-step-four/booking-step-four.component';
import { BookingStepFiveComponent } from '../../components/booking-step-five/booking-step-five.component';
import { BookingStepSixComponent } from '../../components/booking-step-six/booking-step-six.component';

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    FooterComponent,
    SwitcherComponent,
    BookingProgressComponent,
    BookingSummaryComponent,
    BookingStepOneComponent,
    BookingStepTwoComponent,
    BookingStepThreeComponent,
    BookingStepFourComponent,
    BookingStepFiveComponent,
    BookingStepSixComponent
  ],
  templateUrl: './booking.component.html',
  styleUrl: './booking.component.scss'
})
export class BookingComponent implements OnInit, OnDestroy, AfterViewInit {
  currentStep = 1;
  private destroy$ = new Subject<void>();

  constructor(
    public bookingService: BookingService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Initialize booking data from query parameters
    this.route.queryParams.subscribe(params => {
      if (params['start'] && params['end']) {
        const dateRange = {
          start: new Date(params['start']),
          end: new Date(params['end'])
        };
        this.bookingService.updateDateRange(dateRange);
      }

      if (params['rooms'] || params['adults'] || params['children']) {
        const guests = {
          rooms: parseInt(params['rooms'] || '1', 10),
          adults: parseInt(params['adults'] || '1', 10),
          children: parseInt(params['children'] || '0', 10)
        };
        this.bookingService.updateGuests(guests);
      }
    });

    this.bookingService.currentStep$
      .pipe(takeUntil(this.destroy$))
      .subscribe(step => {
        this.currentStep = step;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    feather.replace();
  }
}
