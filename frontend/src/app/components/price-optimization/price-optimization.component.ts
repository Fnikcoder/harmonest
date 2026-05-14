import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import { PriceOptimizationService, PriceOptimizationRequest, PriceOptimizationResult } from '../../services/price-optimization.service';
import { LocationDataService } from '../../services/location-data.service';
import {DatePipe} from '@angular/common';

@Component({
  selector: 'app-price-optimization',
  templateUrl: './price-optimization.component.html',
  imports: [
    ReactiveFormsModule,
    DatePipe
  ],
  styleUrls: ['./price-optimization.component.scss']
})
export class PriceOptimizationComponent implements OnInit {
  @Input() propertyGroupId: string = '';
  @Input() unitModelId: string = '';
  @Input() currentPrice: number = 100;
  @Input() basePrice: number = 100;
  @Output() optimizationComplete = new EventEmitter<PriceOptimizationResult>();

  optimizationForm: FormGroup;
  isOptimizing = false;
  optimizationResult: PriceOptimizationResult | null = null;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private priceOptimizationService: PriceOptimizationService,
    private locationDataService: LocationDataService
  ) {
    this.optimizationForm = this.fb.group({
      city: ['San Diego', Validators.required],
      state: ['CA', Validators.required],
      country: ['US', Validators.required],
      timezone: ['America/Los_Angeles', Validators.required],
      startDate: [this.getDateString(new Date()), Validators.required],
      endDate: [this.getDateString(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)), Validators.required],
      occupancyRate: [0.75, [Validators.required, Validators.min(0), Validators.max(1)]],
      availableUnits: [5, [Validators.required, Validators.min(0)]],
      totalUnits: [10, [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit(): void {
    // Initialize with default values if inputs are provided
    if (this.currentPrice) {
      this.optimizationForm.patchValue({
        currentPrice: this.currentPrice,
        basePrice: this.basePrice
      });
    }
  }

  /**
   * Run price optimization
   */
  runOptimization(): void {
    if (this.optimizationForm.invalid) {
      this.optimizationForm.markAllAsTouched();
      return;
    }

    this.isOptimizing = true;
    this.errorMessage = '';
    this.optimizationResult = null;

    const formValue = this.optimizationForm.value;

    const request: PriceOptimizationRequest = {
      propertyGroupId: this.propertyGroupId || 'property-group-1',
      unitModelId: this.unitModelId || 'unit-model-1',
      location: {
        city: formValue.city,
        state: formValue.state,
        country: formValue.country,
        timezone: formValue.timezone
      },
      dateRange: {
        startDate: formValue.startDate,
        endDate: formValue.endDate
      },
      currentPrice: this.currentPrice,
      basePrice: this.basePrice,
      occupancyRate: formValue.occupancyRate,
      availableUnits: formValue.availableUnits,
      totalUnits: formValue.totalUnits
    };

    this.priceOptimizationService.optimizePrices(request).subscribe({
      next: (result) => {
        this.optimizationResult = result;
        this.optimizationComplete.emit(result);
        this.isOptimizing = false;
      },
      error: (error) => {
        this.errorMessage = 'Failed to optimize prices. Please try again.';
        this.isOptimizing = false;
        console.error('Price optimization error:', error);
      }
    });
  }

  /**
   * Get factor type color for display
   */
  getFactorTypeColor(type: string): string {
    const colorMap: { [key: string]: string } = {
      'weekend': 'bg-blue-100 text-blue-800',
      'holiday': 'bg-red-100 text-red-800',
      'local_event': 'bg-purple-100 text-purple-800',
      'seasonal': 'bg-green-100 text-green-800',
      'demand': 'bg-yellow-100 text-yellow-800',
      'occupancy': 'bg-indigo-100 text-indigo-800',
      'weather': 'bg-gray-100 text-gray-800',
      'competition': 'bg-orange-100 text-orange-800'
    };
    return colorMap[type] || 'bg-gray-100 text-gray-800';
  }

  /**
   * Get impact direction icon
   */
  getImpactIcon(impact: number): string {
    if (impact > 0.05) return 'trending-up';
    if (impact < -0.05) return 'trending-down';
    return 'minus';
  }

  /**
   * Get impact direction color
   */
  getImpactColor(impact: number): string {
    if (impact > 0.05) return 'text-green-600';
    if (impact < -0.05) return 'text-red-600';
    return 'text-gray-600';
  }

  /**
   * Format percentage
   */
  formatPercentage(value: number): string {
    return `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
  }

  /**
   * Format currency
   */
  formatCurrency(value: number): string {
    return `$${value.toFixed(2)}`;
  }

  /**
   * Get date string in YYYY-MM-DD format
   */
  private getDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Calculate days between dates
   */
  getDaysBetween(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get confidence level text
   */
  getConfidenceLevel(confidence: number): string {
    if (confidence >= 0.9) return 'Very High';
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.7) return 'Medium';
    if (confidence >= 0.6) return 'Low';
    return 'Very Low';
  }

  /**
   * Get confidence level color
   */
  getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  }

  /**
   * Export optimization results
   */
  exportResults(): void {
    if (!this.optimizationResult) return;

    const data = {
      optimizationDate: new Date().toISOString(),
      propertyGroupId: this.propertyGroupId,
      unitModelId: this.unitModelId,
      ...this.optimizationResult
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `price-optimization-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Reset form and results
   */
  reset(): void {
    this.optimizationForm.reset();
    this.optimizationResult = null;
    this.errorMessage = '';
    this.ngOnInit(); // Reinitialize with default values
  }

  /**
   * Apply optimized prices (placeholder for actual implementation)
   */
  applyOptimizedPrices(): void {
    if (!this.optimizationResult) return;

    // In real implementation, this would call an API to update the actual prices
    console.log('Applying optimized prices:', this.optimizationResult.optimizedPrices);

    // Show success message or navigate to confirmation page
    alert('Optimized prices have been applied successfully!');
  }

  /**
   * Get summary statistics
   */
  getSummaryStats(): any {
    if (!this.optimizationResult) return null;

    const prices = this.optimizationResult.optimizedPrices;
    const totalDays = prices.length;
    const increaseDays = prices.filter(p => p.priceChange > 0).length;
    const decreaseDays = prices.filter(p => p.priceChange < 0).length;
    const unchangedDays = totalDays - increaseDays - decreaseDays;

    return {
      totalDays,
      increaseDays,
      decreaseDays,
      unchangedDays,
      maxIncrease: Math.max(...prices.map(p => p.priceChangePercent)),
      maxDecrease: Math.min(...prices.map(p => p.priceChangePercent)),
      avgConfidence: prices.reduce((sum, p) => sum + p.confidence, 0) / totalDays
    };
  }
}
