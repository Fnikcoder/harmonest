import { Component, OnInit } from '@angular/core';
import { PriceOptimizationResult } from '../services/price-optimization.service';
import {FormsModule} from '@angular/forms';
import {CurrencyPipe} from '@angular/common';
import {PriceOptimizationComponent} from '../components/price-optimization/price-optimization.component';

@Component({
  selector: 'app-price-optimization-example',
  template: `
    <div class="container mx-auto px-4 py-8">
      <!-- Page Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Price Optimization Dashboard
        </h1>
        <p class="text-gray-600 dark:text-gray-400 max-w-2xl">
          Optimize your property pricing using AI-powered algorithms that consider location-based factors,
          market conditions, events, holidays, and demand patterns.
        </p>
      </div>

      <!-- Property Selection -->
      <div class="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Select Property & Unit Model
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Property Group
            </label>
            <select
              [(ngModel)]="selectedPropertyGroup"
              (ngModelChange)="onPropertyGroupChange()"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white">
              <option value="">Select Property Group</option>
              <option *ngFor="let group of propertyGroups" [value]="group.id">
                {{ group.name }} ({{ group.location }})
              </option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Unit Model
            </label>
            <select
              [(ngModel)]="selectedUnitModel"
              (ngModelChange)="onUnitModelChange()"
              [disabled]="!selectedPropertyGroup"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-600">
              <option value="">Select Unit Model</option>
              <option *ngFor="let model of availableUnitModels" [value]="model.id">
                {{ model.name }} - {{ model.currentPrice | currency }}
              </option>
            </select>
        </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Current Status
            </label>
            <div *ngIf="selectedUnitModelData" class="space-y-1">
              <div class="text-sm text-gray-900 dark:text-white">
                <span class="font-medium">Available:</span>
                {{ selectedUnitModelData.availableUnits }}/{{ selectedUnitModelData.totalUnits }}
              </div>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                <span class="font-medium">Occupancy:</span>
                {{ ((selectedUnitModelData.totalUnits - selectedUnitModelData.availableUnits) / selectedUnitModelData.totalUnits * 100).toFixed(0) }}
                %
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Price Optimization Component -->
      <div *ngIf="selectedPropertyGroup && selectedUnitModel">
        <app-price-optimization
          [propertyGroupId]="selectedPropertyGroup"
          [unitModelId]="selectedUnitModel"
          [currentPrice]="selectedUnitModelData?.currentPrice || 100"
          [basePrice]="selectedUnitModelData?.basePrice || 100"
          (optimizationComplete)="onOptimizationComplete($event)">
        </app-price-optimization>
      </div>

      <!-- Quick Stats -->
      <div *ngIf="lastOptimizationResult"
           class="mt-8 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          <i data-feather="bar-chart-2" class="w-5 h-5 inline mr-2"></i>
          Last Optimization Results
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="text-center">
            <div class="text-2xl font-bold text-green-600">
              {{ lastOptimizationResult?.summary.revenueIncreasePercent.toFixed(1) }}%
            </div>
            <div class="text-sm text-gray-600 dark:text-gray-400">Revenue Increase</div>
          </div>

          <div class="text-center">
            <div class="text-2xl font-bold text-blue-600">
              {{ lastOptimizationResult?.summary.averagePrice | currency }}
            </div>
            <div class="text-sm text-gray-600 dark:text-gray-400">Avg. Optimized Price</div>
          </div>

          <div class="text-center">
            <div class="text-2xl font-bold text-purple-600">
              {{ lastOptimizationResult?.optimizedPrices.length }}
            </div>
            <div class="text-sm text-gray-600 dark:text-gray-400">Days Optimized</div>
          </div>

          <div class="text-center">
            <div class="text-2xl font-bold"
                 [class]="(lastOptimizationResult?.summary.riskScore || 0) <= 0.3 ? 'text-green-600' :
                          (lastOptimizationResult?.summary.riskScore || 0) <= 0.6 ? 'text-yellow-600' : 'text-red-600'">
              {{ ((lastOptimizationResult?.summary.riskScore || 0) * 100).toFixed(0) }}%
            </div>
            <div class="text-sm text-gray-600 dark:text-gray-400">Risk Score</div>
          </div>
        </div>
      </div>

      <!-- Help Section -->
      <div class="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-4">
          <i data-feather="help-circle" class="w-5 h-5 inline mr-2"></i>
          How Price Optimization Works
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 class="font-medium text-blue-800 dark:text-blue-200 mb-2">Factors Considered:</h4>
            <ul class="space-y-1 text-sm text-blue-700 dark:text-blue-300">
              <li>• Weekend and weekday patterns</li>
              <li>• National and local holidays</li>
              <li>• Local events and conferences</li>
              <li>• Seasonal demand variations</li>
              <li>• Current occupancy rates</li>
              <li>• Weather forecasts</li>
              <li>• Competitor pricing</li>
            </ul>
          </div>

          <div>
            <h4 class="font-medium text-blue-800 dark:text-blue-200 mb-2">Optimization Benefits:</h4>
            <ul class="space-y-1 text-sm text-blue-700 dark:text-blue-300">
              <li>• Maximize revenue potential</li>
              <li>• Improve occupancy rates</li>
              <li>• Stay competitive in market</li>
              <li>• Reduce manual pricing work</li>
              <li>• Data-driven decisions</li>
              <li>• Risk assessment included</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `,
  imports: [
    FormsModule,
    CurrencyPipe,
    PriceOptimizationComponent
  ],
  styleUrls: ['./price-optimization-example.component.scss']
})
export class PriceOptimizationExampleComponent implements OnInit {
  selectedPropertyGroup = '';
  selectedUnitModel = '';
  selectedUnitModelData: any = null;
  lastOptimizationResult: PriceOptimizationResult | null | undefined = null;

  // Mock data for demonstration
  propertyGroups = [
    {
      id: 'group-001',
      name: 'Sunset Apartments',
      location: 'San Diego, CA'
    },
    {
      id: 'group-002',
      name: 'Downtown Suites',
      location: 'New York, NY'
    },
    {
      id: 'group-003',
      name: 'Beach Resort',
      location: 'Miami, FL'
    }
  ];

  unitModels = {
    'group-001': [
      {
        id: 'model-001',
        name: '1 Room 1 Bed City Side',
        currentPrice: 150,
        basePrice: 120,
        availableUnits: 2,
        totalUnits: 6
      },
      {
        id: 'model-002',
        name: '1 Room 1 Bed Mountain Side',
        currentPrice: 180,
        basePrice: 150,
        availableUnits: 3,
        totalUnits: 4
      },
      {
        id: 'model-003',
        name: '2 Rooms 4 Beds',
        currentPrice: 280,
        basePrice: 250,
        availableUnits: 3,
        totalUnits: 3
      }
    ],
    'group-002': [
      {
        id: 'model-004',
        name: 'Studio Manhattan View',
        currentPrice: 200,
        basePrice: 180,
        availableUnits: 1,
        totalUnits: 8
      },
      {
        id: 'model-005',
        name: '1 Bedroom Central Park',
        currentPrice: 350,
        basePrice: 300,
        availableUnits: 2,
        totalUnits: 5
      }
    ],
    'group-003': [
      {
        id: 'model-006',
        name: 'Ocean View Suite',
        currentPrice: 250,
        basePrice: 220,
        availableUnits: 4,
        totalUnits: 10
      }
    ]
  };

  availableUnitModels: any[] = [];

  constructor() { }

  ngOnInit(): void {
    // Initialize with first property group if available
    if (this.propertyGroups.length > 0) {
      // Don't auto-select, let user choose
    }
  }

  onPropertyGroupChange(): void {
    this.selectedUnitModel = '';
    this.selectedUnitModelData = null;
    this.availableUnitModels = this.unitModels[this.selectedPropertyGroup as keyof typeof this.unitModels] || [];
  }

  onUnitModelChange(): void {
    if (this.selectedUnitModel) {
      this.selectedUnitModelData = this.availableUnitModels.find(model => model.id === this.selectedUnitModel);
    } else {
      this.selectedUnitModelData = null;
    }
  }

  onOptimizationComplete(result: PriceOptimizationResult): void {
    this.lastOptimizationResult = result;

    // Show success notification
    this.showNotification('Price optimization completed successfully!', 'success');

    // Log results for debugging
    console.log('Optimization completed:', result);
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info'): void {
    // In a real application, you would use a toast/notification service
    console.log(`${type.toUpperCase()}: ${message}`);
  }
}
