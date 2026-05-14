import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { ModelService } from '../../../services/model.service';
import * as feather from 'feather-icons';

interface PropertyPerformance {
  name: string;
  location: string;
  revenue: number;
  revenueChange: number;
  occupancy: number;
  adr: number;
  rating: number;
}

interface BookingSource {
  name: string;
  percentage: number;
  bookings: number;
  icon: string;
  colorClass: string;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analytics.component.html'
})
export class AnalyticsComponent implements OnInit, OnDestroy, AfterViewInit {
  private destroy$ = new Subject<void>();

  showLearning = false;
  selectedPeriod = '30d';

  timePeriods = [
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: '90 Days', value: '90d' },
    { label: '1 Year', value: '1y' }
  ];

  metrics = {
    totalRevenue: 0,
    revenueChange: 0,
    occupancyRate: 0,
    occupancyChange: 0,
    averageDailyRate: 0,
    adrChange: 0,
    guestSatisfaction: 0,
    satisfactionChange: 0
  };

  bookingSources: BookingSource[] = [];
  propertyPerformance: PropertyPerformance[] = [];

  constructor(
    private modelService: ModelService
  ) {}

  ngOnInit() {
    this.loadAnalytics();
  }

  ngAfterViewInit() {
    feather.replace();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadAnalytics() {
    // Mock data based on selected period
    this.metrics = {
      totalRevenue: 45250,
      revenueChange: 12.5,
      occupancyRate: 78,
      occupancyChange: 5.2,
      averageDailyRate: 125,
      adrChange: 8.1,
      guestSatisfaction: 4.6,
      satisfactionChange: 0.3
    };

    this.bookingSources = [
      {
        name: 'Direct Bookings',
        percentage: 45,
        bookings: 127,
        icon: 'globe',
        colorClass: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
      },
      {
        name: 'Booking.com',
        percentage: 35,
        bookings: 98,
        icon: 'external-link',
        colorClass: 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400'
      },
      {
        name: 'Airbnb',
        percentage: 20,
        bookings: 56,
        icon: 'home',
        colorClass: 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'
      }
    ];

    this.propertyPerformance = [
      {
        name: 'Sunset Villa',
        location: 'Santorini, Greece',
        revenue: 18500,
        revenueChange: 15.2,
        occupancy: 85,
        adr: 180,
        rating: 4.8
      },
      {
        name: 'Ocean View Apartment',
        location: 'Barcelona, Spain',
        revenue: 14200,
        revenueChange: 8.7,
        occupancy: 72,
        adr: 95,
        rating: 4.5
      },
      {
        name: 'Mountain Cabin',
        location: 'Swiss Alps, Switzerland',
        revenue: 12550,
        revenueChange: -3.1,
        occupancy: 68,
        adr: 220,
        rating: 4.7
      },
      {
        name: 'City Loft',
        location: 'Amsterdam, Netherlands',
        revenue: 9800,
        revenueChange: 22.4,
        occupancy: 79,
        adr: 110,
        rating: 4.3
      }
    ];
  }

  exportReport() {
    console.log('Export analytics report');
    // Implement export functionality
  }

  generateCustomReport() {
    console.log('Generate custom report');
    // Implement custom report generation
  }

  scheduleReport() {
    console.log('Schedule report');
    // Implement report scheduling
  }

  compareProperties() {
    console.log('Compare properties');
    // Implement property comparison
  }

  viewForecast() {
    console.log('View forecast');
    // Implement forecast viewing
  }
}
