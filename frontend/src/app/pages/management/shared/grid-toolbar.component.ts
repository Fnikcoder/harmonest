import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GridApi } from 'ag-grid-community';
import { GridService } from './grid.service';

@Component({
  selector: 'app-grid-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">

        <!-- Left side - Search and filters -->
        <div class="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
          <!-- Quick Search -->
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i data-feather="search" class="h-4 w-4 text-gray-400"></i>
            </div>
            <input
              type="text"
              [(ngModel)]="searchText"
              (ngModelChange)="onSearchChange($event)"
              placeholder="Search..."
              class="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     text-sm"
            />
          </div>

          <!-- Status Filter -->
          <select
            *ngIf="showStatusFilter"
            [(ngModel)]="statusFilter"
            (ngModelChange)="onStatusFilterChange($event)"
            class="block w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600
                   rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   text-sm"
          >
            <option value="">All Status</option>
            <option *ngFor="let status of statusOptions" [value]="status.value">
              {{ status.label }}
            </option>
          </select>

          <!-- Custom Filters Slot -->
          <ng-content select="[slot=filters]"></ng-content>
        </div>

        <!-- Right side - Actions -->
        <div class="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">

          <!-- Grid Stats -->
          <div class="text-sm text-gray-600 dark:text-gray-400">
            <span class="font-medium">{{ totalRecords }}</span> total
            <span *ngIf="selectedRecords > 0" class="ml-2">
              • <span class="font-medium text-blue-600">{{ selectedRecords }}</span> selected
            </span>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center space-x-2">

            <!-- Refresh Button -->
            <button
              (click)="onRefresh()"
              class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600
                     rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300
                     bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     transition-colors duration-200"
              title="Refresh Data"
            >
              <i data-feather="refresh-cw" class="h-4 w-4"></i>
            </button>

            <!-- Column Selector -->
            <button
              (click)="toggleColumnSelector()"
              class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600
                     rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300
                     bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     transition-colors duration-200"
              title="Manage Columns"
            >
              <i data-feather="columns" class="h-4 w-4"></i>
            </button>

            <!-- Export Button -->
            <button
              (click)="onExport()"
              class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600
                     rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300
                     bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     transition-colors duration-200"
              title="Export to CSV"
            >
              <i data-feather="download" class="h-4 w-4"></i>
            </button>

            <!-- Reset Filters -->
            <button
              (click)="onResetFilters()"
              class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600
                     rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300
                     bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     transition-colors duration-200"
              title="Reset All Filters"
            >
              <i data-feather="x" class="h-4 w-4"></i>
            </button>

            <!-- Custom Actions Slot -->
            <ng-content select="[slot=actions]"></ng-content>
          </div>
        </div>
      </div>

      <!-- Column Selector Panel -->
      <div *ngIf="showColumnSelector"
           class="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium text-gray-900 dark:text-white">Manage Columns</h3>
          <button
            (click)="toggleColumnSelector()"
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <i data-feather="x" class="h-4 w-4"></i>
          </button>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <label *ngFor="let column of availableColumns"
                 class="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              [checked]="!column.hide"
              (change)="onColumnVisibilityChange(column, $event)"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span class="text-gray-700 dark:text-gray-300">{{ column.headerName }}</span>
          </label>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Custom scrollbar for column selector */
    .column-selector::-webkit-scrollbar {
      width: 4px;
    }

    .column-selector::-webkit-scrollbar-track {
      background: transparent;
    }

    .column-selector::-webkit-scrollbar-thumb {
      background: #d1d5db;
      border-radius: 2px;
    }

    .dark .column-selector::-webkit-scrollbar-thumb {
      background: #6b7280;
    }
  `]
})
export class GridToolbarComponent implements OnInit {
  @Input() gridApi?: GridApi;
  @Input() totalRecords = 0;
  @Input() selectedRecords = 0;
  @Input() showStatusFilter = true;
  @Input() statusOptions: { value: string; label: string }[] = [];
  @Input() availableColumns: any[] = [];
  @Input() exportFilename?: string;

  @Output() searchChange = new EventEmitter<string>();
  @Output() statusFilterChange = new EventEmitter<string>();
  @Output() refresh = new EventEmitter<void>();
  @Output() export = new EventEmitter<void>();
  @Output() resetFilters = new EventEmitter<void>();
  @Output() columnVisibilityChange = new EventEmitter<{ column: any; visible: boolean }>();

  searchText = '';
  statusFilter = '';
  showColumnSelector = false;

  constructor(private gridService: GridService) {}

  ngOnInit(): void {
    // Initialize feather icons
    setTimeout(() => {
      if (typeof feather !== 'undefined') {
        feather.replace();
      }
    }, 100);
  }

  onSearchChange(searchText: string): void {
    this.searchChange.emit(searchText);
    if (this.gridApi) {
      this.gridService.applyQuickFilter(this.gridApi, searchText);
    }
  }

  onStatusFilterChange(status: string): void {
    this.statusFilterChange.emit(status);
  }

  onRefresh(): void {
    this.refresh.emit();
  }

  onExport(): void {
    if (this.gridApi) {
      this.gridService.exportToCSV(this.gridApi, this.exportFilename);
    }
    this.export.emit();
  }

  onResetFilters(): void {
    this.searchText = '';
    this.statusFilter = '';
    if (this.gridApi) {
      this.gridService.resetGridFilters(this.gridApi);
    }
    this.resetFilters.emit();
  }

  toggleColumnSelector(): void {
    this.showColumnSelector = !this.showColumnSelector;

    // Re-initialize feather icons when panel opens/closes
    setTimeout(() => {
      if (typeof feather !== 'undefined') {
        feather.replace();
      }
    }, 100);
  }

  onColumnVisibilityChange(column: any, event: any): void {
    const visible = event.target.checked;
    column.hide = !visible;

    if (this.gridApi) {
      this.gridApi.setColumnsVisible([column.field], visible);
    }

    this.columnVisibilityChange.emit({ column, visible });
  }
}

// Declare feather for TypeScript
declare var feather: any;
