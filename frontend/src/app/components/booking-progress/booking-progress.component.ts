import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookingService } from '../../services/booking.service';
import { BookingStep } from '../../interfaces/booking.interface';
import { Subject, takeUntil } from 'rxjs';
import * as feather from 'feather-icons';

@Component({
  selector: 'app-booking-progress',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './booking-progress.component.html',
  styleUrl: './booking-progress.component.scss'
})
export class BookingProgressComponent implements OnInit, OnDestroy {
  steps: BookingStep[] = [];
  currentStep = 1;
  private destroy$ = new Subject<void>();

  constructor(private bookingService: BookingService) {}

  ngOnInit(): void {
    this.steps = this.bookingService.getSteps();

    this.bookingService.currentStep$
      .pipe(takeUntil(this.destroy$))
      .subscribe(step => {
        this.currentStep = step;
        this.updateSteps();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    feather.replace();
  }

  private updateSteps(): void {
    this.steps = this.steps.map(step => ({
      ...step,
      active: step.id === this.currentStep,
      completed: step.id < this.currentStep
    }));
  }

  onStepClick(stepId: number): void {
    // Allow navigation to accessible steps
    if (this.bookingService.isStepAccessible(stepId)) {
      this.bookingService.setCurrentStep(stepId);
    }
  }

  isStepClickable(stepId: number): boolean {
    return this.bookingService.isStepAccessible(stepId);
  }
}
