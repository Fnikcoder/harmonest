import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, CellValueChangedEvent, RowClickedEvent } from 'ag-grid-community';
import { Subject, takeUntil } from 'rxjs';
import { GridService, ColumnConfig } from '../shared/grid.service';
import { ManagementDataService, ReservationData } from '../shared/management-data.service';
import { GridToolbarComponent } from '../shared/grid-toolbar.component';
import { StatusCellRendererComponent } from '../shared/status-cell-renderer.component';
import { ActionCellRendererComponent, ActionButton } from '../shared/action-cell-renderer.component';
import { BookingSourceCellRendererComponent } from '../shared/booking-source-cell-renderer.component';
import * as feather from 'feather-icons';

@Component({
  selector: 'app-reservations-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridAngular,
    GridToolbarComponent,
    StatusCellRendererComponent,
    ActionCellRendererComponent,
    BookingSourceCellRendererComponent
  ],
  template: `
    <div class="p-6">
      <!-- Content starts directly without header -->

      <!-- Filters and Controls -->
      <div class="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div class="flex flex-wrap items-center gap-4">
          <div class="flex items-center space-x-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Status:</label>
            <select [(ngModel)]="statusFilter" (change)="applyFilters()"
                    class="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">All</option>
              <option value="1">Confirmed</option>
              <option value="0">Cancelled</option>
            </select>
          </div>

          <div class="flex items-center space-x-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Check-in Status:</label>
            <select [(ngModel)]="checkinFilter" (change)="applyFilters()"
                    class="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
            </select>
          </div>

          <div class="flex items-center space-x-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Date Range:</label>
            <input type="date" [(ngModel)]="dateFrom" (change)="applyFilters()"
                   class="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            <span class="text-gray-500">to</span>
            <input type="date" [(ngModel)]="dateTo" (change)="applyFilters()"
                   class="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          </div>

          <div class="flex items-center space-x-2">
            <button (click)="showColumnSelector = !showColumnSelector"
                    class="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <i data-feather="columns" class="size-4 mr-1"></i>Columns
            </button>
          </div>

          <div class="flex items-center space-x-3">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">View:</span>
            <div class="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1 shadow-inner">
              <button
                (click)="setViewMode('table')"
                [class]="viewMode === 'table' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'"
                class="flex items-center px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200">
                <i data-feather="list" class="size-4 mr-2"></i>
                Table
              </button>
              <button
                (click)="setViewMode('calendar')"
                [class]="viewMode === 'calendar' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'"
                class="flex items-center px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200">
                <i data-feather="calendar" class="size-4 mr-2"></i>
                Calendar
              </button>
            </div>
          </div>

          <div class="flex items-center space-x-2">
            <span class="text-sm text-gray-600 dark:text-gray-400">
              Total: {{totalRecords}} | Selected: {{selectedRecords}}
            </span>
          </div>
        </div>

        <!-- Column Selector -->
        <div *ngIf="showColumnSelector" class="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Select Columns to Display</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            <label *ngFor="let col of availableColumns" class="flex items-center space-x-2 text-sm">
              <input type="checkbox"
                     [checked]="!col.hide"
                     (change)="toggleColumn(col, $event)"
                     class="rounded border-gray-300 dark:border-gray-600">
              <span class="text-gray-700 dark:text-gray-300">{{col.headerName}}</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Table View - Timeline/Gantt Chart -->
      <div *ngIf="viewMode === 'table'" class="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <!-- Timeline Header -->
        <div class="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
              <div class="bg-white/20 backdrop-blur-sm rounded-lg p-2">
                <i data-feather="calendar" class="h-6 w-6 text-white"></i>
              </div>
              <div>
                <h2 class="text-xl font-bold text-white">{{ getCurrentPeriodTitle() }}</h2>
                <p class="text-sm text-white/80">Timeline View - {{ getUniqueListings().length }} Listings</p>
              </div>
            </div>
            <div class="flex items-center space-x-2">
              <button (click)="previousPeriod()"
                      class="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                <i data-feather="chevron-left" class="h-5 w-5 text-white"></i>
              </button>
              <button (click)="goToToday()"
                      class="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium text-white transition-colors">
                Today
              </button>
              <button (click)="nextPeriod()"
                      class="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                <i data-feather="chevron-right" class="h-5 w-5 text-white"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Timeline Grid Container - Displays entire month with horizontal scrolling -->
        <div class="overflow-x-auto overflow-y-auto" style="max-height: 700px;">
          <!-- Sticky Header Row with Days -->
          <div class="sticky top-0 z-20 bg-gray-50 dark:bg-gray-900 border-b-2 border-gray-300 dark:border-gray-600">
            <div class="flex" style="min-width: fit-content;">
              <!-- Listing Name Column (Sticky Left) -->
              <div class="sticky left-0 z-30 bg-gray-100 dark:bg-gray-800 border-r-2 border-gray-300 dark:border-gray-600"
                   style="min-width: 200px; width: 200px;">
                <div class="px-4 py-3 font-semibold text-sm text-gray-700 dark:text-gray-300">
                  Listing
                </div>
              </div>

              <!-- Days Columns - All days of the month displayed -->
              <div class="flex">
                <div *ngFor="let day of getTimelineDays()"
                     [ngClass]="{
                       'border-r border-gray-200 dark:border-gray-700 text-center': true,
                       'bg-blue-50 dark:bg-blue-900/20': isToday(day)
                     }"
                     style="min-width: 80px; width: 80px;">
                  <div class="px-2 py-1">
                    <div class="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {{ day | date: 'EEE' }}
                    </div>
                    <div class="text-sm font-bold"
                         [ngClass]="{
                           'text-blue-600 dark:text-blue-400': isToday(day),
                           'text-gray-900 dark:text-white': !isToday(day)
                         }">
                      {{ day | date: 'd' }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Listing Rows -->
          <div *ngFor="let listing of getUniqueListings(); let listingIndex = index"
               class="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <div class="flex relative" [style.min-height]="getListingRowHeight(listing.roomId)" style="min-width: fit-content;">
              <!-- Listing Name (Sticky Left) -->
              <div class="sticky left-0 z-10 bg-white dark:bg-gray-800 border-r-2 border-gray-300 dark:border-gray-600"
                   style="min-width: 200px; width: 200px;">
                <div class="px-4 py-4">
                  <div class="font-semibold text-sm text-gray-900 dark:text-white">
                    {{ listing.roomAlias }}
                  </div>
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {{ listing.roomName }}
                  </div>
                </div>
              </div>

              <!-- Timeline Days Grid - All days of the month -->
              <div class="flex relative">
                <!-- Day Cells (Background Grid) -->
                <div *ngFor="let day of getTimelineDays()"
                     [ngClass]="{
                       'border-r border-gray-200 dark:border-gray-700': true,
                       'bg-blue-50/30 dark:bg-blue-900/10': isToday(day)
                     }"
                     style="min-width: 80px; width: 80px;">
                </div>

                <!-- Reservation Bars (Absolute Positioned) -->
                <div class="absolute inset-0" style="pointer-events: none;">
                  <div *ngFor="let resBar of getTimelineReservationsForListing(listing.roomId)"
                       (click)="onReservationClick($event, resBar.reservation)"
                       class="absolute cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-xl hover:z-10 p-2 shadow-md rounded-md border-l-4"
                       [class]="getReservationBarClasses(resBar.reservation)"
                       [style.left]="resBar.left"
                       [style.top]="resBar.top"
                       [style.width]="resBar.width"
                       [style.height]="'60px'"
                       [style.z-index]="10"
                       [style.pointer-events]="'auto'">
                    <div class="flex items-center h-full" style="pointer-events: none;">
                      <div class="flex-1 min-w-0">
                        <p class="text-xs font-semibold truncate text-gray-900 dark:text-white">
                          {{ resBar.reservation.guestName }} {{ resBar.reservation.guestSurname }}
                        </p>
                        <p class="text-xs opacity-75 truncate">
                          {{ resBar.reservation.nights }}n • {{ resBar.reservation.price }} {{ resBar.reservation.currency }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div *ngIf="getUniqueListings().length === 0"
               class="text-center py-12 text-gray-500 dark:text-gray-400">
            <i data-feather="inbox" class="h-12 w-12 mx-auto mb-3 opacity-50"></i>
            <p>No listings found</p>
          </div>
        </div>

        <!-- Legend -->
        <div class="bg-gray-50 dark:bg-gray-900 px-6 py-3 border-t border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-center space-x-6 text-xs">
            <div class="flex items-center space-x-2">
              <div class="w-3 h-3 rounded-full bg-green-500"></div>
              <span class="text-gray-600 dark:text-gray-400">Confirmed</span>
            </div>
            <div class="flex items-center space-x-2">
              <div class="w-3 h-3 rounded-full bg-blue-500"></div>
              <span class="text-gray-600 dark:text-gray-400">Checked In</span>
            </div>
            <div class="flex items-center space-x-2">
              <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span class="text-gray-600 dark:text-gray-400">Pending</span>
            </div>
            <div class="flex items-center space-x-2">
              <div class="w-3 h-3 rounded-full bg-red-500"></div>
              <span class="text-gray-600 dark:text-gray-400">Cancelled</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Calendar View -->
      <div *ngIf="viewMode === 'calendar'" class="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <!-- Calendar Header -->
        <div class="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
              <div class="p-2 bg-white/20 rounded-lg">
                <i data-feather="calendar" class="size-6 text-white"></i>
              </div>
              <div>
                <h3 class="text-2xl font-bold text-white">{{getCurrentPeriodTitle()}}</h3>
                <p class="text-blue-100 text-sm">{{getTotalReservationsForMonth()}} reservations this month</p>
              </div>
            </div>
            <div class="flex items-center bg-white/10 rounded-xl p-1">
              <button (click)="previousPeriod()"
                      class="p-3 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200">
                <i data-feather="chevron-left" class="size-5"></i>
              </button>
              <button (click)="goToToday()"
                      class="px-6 py-2 mx-2 bg-white text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-all duration-200 shadow-sm">
                Today
              </button>
              <button (click)="nextPeriod()"
                      class="p-3 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200">
                <i data-feather="chevron-right" class="size-5"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Calendar Grid -->
        <div class="p-6">
          <!-- Days of Week Header -->
          <div class="grid grid-cols-7 gap-2 mb-4">
            <div *ngFor="let day of daysOfWeek"
                 class="py-4 text-center text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              {{ day }}
            </div>
          </div>

          <!-- Calendar Grid - Week by Week -->
          <div class="space-y-3">
            <div *ngFor="let week of calendarWeeks; let weekIndex = index" class="relative" style="min-height: 180px;">
              <!-- Week container with grid for day cells -->
              <div class="grid grid-cols-7 gap-2">
                <!-- Day cells for this week -->
                <div *ngFor="let day of week; let dayIndex = index"
                     class="h-[180px] p-3 rounded-xl border-2 transition-all duration-200"
                     [class]="getCalendarDayClasses(day)">

                  <div class="flex items-center justify-between mb-3">
                    <span class="text-sm font-bold"
                          [class]="getDateClasses(day)">
                      {{ day.date.getDate() }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Absolute positioned reservation bars -->
              <div class="absolute inset-0" style="padding: 0; pointer-events: none;">
                <!-- Calculate and render each reservation bar -->
                <div *ngFor="let resBar of getReservationBarsForWeek(weekIndex)"
                     (click)="onReservationClick($event, resBar.reservation)"
                     class="absolute cursor-pointer transition-all duration-200 hover:scale-[1.01] hover:shadow-xl p-2.5 shadow-md rounded-lg border-l-4"
                     style="pointer-events: auto;"
                     [class]="getReservationBarClasses(resBar.reservation)"
                     [style.left]="resBar.left"
                     [style.top]="resBar.top"
                     [style.width]="resBar.width"
                     [style.z-index]="20">
                  <div class="flex items-center space-x-2">
                    <div class="w-2 h-2 rounded-full flex-shrink-0"
                         [class]="getReservationStatusDot(resBar.reservation)"></div>
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-semibold truncate">
                        {{ resBar.reservation.guestName }} {{ resBar.reservation.guestSurname }}
                      </p>
                      <p class="text-xs opacity-75 truncate">
                        {{ resBar.reservation.roomAlias }} • {{ resBar.reservation.nights }}n
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Calendar Legend -->
        <div class="px-6 pb-6">
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
            <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Legend</h4>
            <div class="flex flex-wrap gap-4">
              <div class="flex items-center space-x-2">
                <div class="w-3 h-3 bg-green-500 rounded-full"></div>
                <span class="text-xs text-gray-600 dark:text-gray-400">Confirmed</span>
              </div>
              <div class="flex items-center space-x-2">
                <div class="w-3 h-3 bg-red-500 rounded-full"></div>
                <span class="text-xs text-gray-600 dark:text-gray-400">Cancelled</span>
              </div>
              <div class="flex items-center space-x-2">
                <div class="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span class="text-xs text-gray-600 dark:text-gray-400">Pending Check-in</span>
              </div>
              <div class="flex items-center space-x-2">
                <div class="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span class="text-xs text-gray-600 dark:text-gray-400">Checked In</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading Overlay -->
      <div *ngIf="loading" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 flex items-center space-x-3">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span class="text-gray-900 dark:text-white">Loading reservations...</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Modern AG Grid styling is handled by the global SCSS file */
    :host ::ng-deep .ag-theme-quartz {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* Custom cell styling for reservations */
    :host ::ng-deep .guest-cell {
      font-weight: 500;
      color: #374151;
    }

    :host ::ng-deep .dark .guest-cell {
      color: #f9fafb;
    }

    :host ::ng-deep .amount-cell {
      font-weight: 600;
      text-align: right;
      color: #059669;
    }

    :host ::ng-deep .dark .amount-cell {
      color: #10b981;
    }

    :host ::ng-deep .date-cell {
      color: #6b7280;
      font-size: 0.875rem;
    }

    :host ::ng-deep .dark .date-cell {
      color: #9ca3af;
    }

    /* Action button hover effects */
    :host ::ng-deep .action-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
    }

    /* Truncated email styling */
    :host ::ng-deep .truncated-email {
      cursor: help;
      color: #374151;
    }

    :host ::ng-deep .dark .truncated-email {
      color: #f9fafb;
    }

    /* Row status coloring */
    :host ::ng-deep .ag-row.status-confirmed {
      background-color: #f0fdf4 !important;
      border-left: 4px solid #22c55e;
    }

    :host ::ng-deep .ag-row.status-confirmed:hover {
      background-color: #ecfdf5 !important;
    }

    :host ::ng-deep .ag-row.status-cancelled {
      background-color: #fef2f2 !important;
      border-left: 4px solid #ef4444;
    }

    :host ::ng-deep .ag-row.status-cancelled:hover {
      background-color: #fef1f1 !important;
    }

    /* Dark mode row status coloring */
    :host ::ng-deep .dark .ag-row.status-confirmed {
      background-color: #064e3b !important;
      border-left: 4px solid #10b981;
    }

    :host ::ng-deep .dark .ag-row.status-confirmed:hover {
      background-color: #065f46 !important;
    }

    :host ::ng-deep .dark .ag-row.status-cancelled {
      background-color: #7f1d1d !important;
      border-left: 4px solid #f87171;
    }

    :host ::ng-deep .dark .ag-row.status-cancelled:hover {
      background-color: #991b1b !important;
    }
  `]
})
export class ReservationsManagementComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('agGrid') agGrid!: AgGridAngular;

  private destroy$ = new Subject<void>();
  gridApi!: GridApi;

  // Grid data
  rowData: ReservationData[] = [];
  columnDefs: ColDef[] = [];
  gridOptions: any;
  loading = false;

  // View mode
  viewMode: 'table' | 'calendar' = 'table';

  // Filters
  statusFilter = '';
  checkinFilter = '';
  dateFrom = '';
  dateTo = '';
  showColumnSelector = false;

  // Stats
  totalRecords = 0;
  selectedRecords = 0;

  // Calendar properties
  currentDate = new Date();
  daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  calendarDays: any[] = [];
  calendarWeeks: any[][] = [];

  // Status options for filter
  statusOptions = [
    { value: '1', label: 'Confirmed' },
    { value: '0', label: 'Cancelled' }
  ];

  // Column configuration
  availableColumns: ColumnConfig[] = [];

  constructor(
    private gridService: GridService,
    private dataService: ManagementDataService,
    private router: Router
  ) {
    this.gridOptions = this.gridService.createDefaultGridOptions();
    this.gridOptions.getRowClass = this.getRowClass.bind(this);

    // Initialize column configuration
    this.availableColumns = [
      { field: 'reservationCode', headerName: 'Reservation Code', width: 150, pinned: 'left' },
      {
        field: 'bookingSource',
        headerName: 'Source',
        width: 100,
        cellRenderer: BookingSourceCellRendererComponent,
        sortable: true,
        filter: true
      },
      { field: 'roomAlias', headerName: 'Room Alias', width: 120 },
      { field: 'checkInDate', headerName: 'Check-in', width: 120 },
      { field: 'checkOutDate', headerName: 'Check-out', width: 120 },
      { field: 'guestName', headerName: 'Guest Name', width: 150, editable: true },
      { field: 'guestSurname', headerName: 'Guest Surname', width: 150, editable: true },
      { field: 'email', headerName: 'Email', width: 280, minWidth: 200, flex: 2, editable: true },
      { field: 'phoneNumber', headerName: 'Phone', width: 200, editable: true },
      //{ field: 'roomName', headerName: 'Room', width: 180 },

      //{ field: 'nights', headerName: 'Nights', width: 80 },
      { field: 'numOfAdults', headerName: 'Adults', width: 80 },
      { field: 'numOfKids', headerName: 'Kids', width: 80 },
      { field: 'price', headerName: 'Price', width: 100 },
      { field: 'checkinStatus', headerName: 'Check-in', width: 130 },
      { field: 'doorAccessStatus', headerName: 'Door Access', width: 120 },
      { field: 'addedDate', headerName: 'Added', width: 120 },
      { field: 'updatedAt', headerName: 'Updated', width: 120 }
    ];

    // Add formatters after service is available
    this.availableColumns.find(col => col.field === 'checkInDate')!.valueFormatter = this.gridService.createDateFormatter();
    this.availableColumns.find(col => col.field === 'checkOutDate')!.valueFormatter = this.gridService.createDateFormatter();
    this.availableColumns.find(col => col.field === 'price')!.valueFormatter = this.gridService.createCurrencyFormatter('EUR');
    this.availableColumns.find(col => col.field === 'addedDate')!.valueFormatter = this.gridService.createDateFormatter();
    this.availableColumns.find(col => col.field === 'updatedAt')!.valueFormatter = this.gridService.createDateFormatter();

    this.columnDefs = this.gridService.createColumnDefs(this.availableColumns);

    // Remove actions column - users can click on rows to view details

    // Remove status column from display
    this.columnDefs = this.columnDefs.filter(col => col.field !== 'status');

    // Update email column to truncate long emails
    const emailColumn = this.columnDefs.find(col => col.field === 'email');
    if (emailColumn) {
      emailColumn.cellRenderer = (params: any) => {
        if (!params.value || params.value === '') return '<span class="text-gray-400">No email</span>';
        const email = params.value;
        if (email.length > 28) {
          // Split email at @ symbol for better truncation
          if (email) {
            // Show first part of local + ... + domain
            const truncatedLocal = email.length > 15 ? email.substring(0, 15) + '...' : email;
            return `<span title="${email}" class="truncated-email">${truncatedLocal}</span>`;
          }
          // Fallback to simple truncation
          return `<span title="${email}" class="truncated-email">${email.substring(0, 25)}...</span>`;
        }
        return email;
      };
    }

    // Update phone column to handle empty values
    const phoneColumn = this.columnDefs.find(col => col.field === 'phoneNumber');
    if (phoneColumn) {
      phoneColumn.cellRenderer = (params: any) => {
        if (!params.value || params.value === '') return '<span class="text-gray-400">No phone</span>';
        return params.value;
      };
    }
  }

  ngOnInit(): void {
    this.loadData();
    this.initializeFeatherIcons();
    this.setupWindowFunctions();
    this.generateCalendarDays();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    this.initializeFeatherIcons();
  }

  private initializeFeatherIcons(): void {
    setTimeout(() => {
      feather.replace();
    }, 100);
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;

    // Restore grid state
    this.gridService.restoreGridState('reservations-grid', this.gridApi);
  }

  loadData(): void {
    this.loading = true;
    const { monthStart, monthEnd } = this.getCurrentMonthRange();

    this.dataService.getReservations(monthStart, monthEnd)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (reservations) => {
          // Debug: Check the first few reservations to see email/phone data
          if (reservations.length > 0) {

          }
          this.rowData = reservations;
          this.totalRecords = reservations.length;
          this.loading = false;
          this.applyFilters();
        },
        error: (error) => {
          console.error('Error loading reservations:', error);
          this.loading = false;
        }
      });
  }

  refreshData(): void {
    this.loadData();
  }

  applyFilters(): void {
    if (!this.gridApi) return;

    const filterModel: any = {};

    if (this.statusFilter) {
      filterModel.status = {
        type: 'equals',
        filter: parseInt(this.statusFilter)
      };
    }

    if (this.checkinFilter) {
      filterModel.checkinStatus = {
        type: 'equals',
        filter: this.checkinFilter
      };
    }

    if (this.dateFrom || this.dateTo) {
      const fromDate = this.dateFrom ? new Date(this.dateFrom).getTime() : 0;
      const toDate = this.dateTo ? new Date(this.dateTo).getTime() : Date.now() + 365 * 24 * 60 * 60 * 1000;

      filterModel.checkInDate = {
        type: 'inRange',
        filter: fromDate,
        filterTo: toDate
      };
    }

    this.gridApi.setFilterModel(filterModel);
  }

  onCellValueChanged(event: CellValueChangedEvent): void {
    const updatedReservation: Partial<ReservationData> = {
      PK: event.data.PK,
      SK: event.data.SK,
      [event.colDef.field!]: event.newValue
    };

    this.dataService.updateReservation(updatedReservation)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          // Update the row data
          event.node.setData(updated);
        },
        error: (error) => {
          console.error('Error updating reservation:', error);
          // Revert the change
          event.node.setDataValue(event.colDef.field!, event.oldValue);
        }
      });
  }

  onSelectionChanged(): void {
    if (this.gridApi) {
      this.selectedRecords = this.gridApi.getSelectedRows().length;
    }
  }

  toggleColumn(column: ColumnConfig, event: any): void {
    column.hide = !event.target.checked;
    this.columnDefs = this.gridService.createColumnDefs(this.availableColumns);

    if (this.gridApi) {
      this.gridApi.setColumnsVisible([column.field], !column.hide);
    }
  }

  exportData(): void {
    if (this.gridApi) {
      this.gridService.exportToCsv(this.gridApi, 'reservations-export');
    }
  }



  private getRowClass(params: any): string {
    if (params.data.status === 1) {
      return 'status-confirmed';
    } else if (params.data.status === 0) {
      return 'status-cancelled';
    }
    return '';
  }

  onRowClicked(event: RowClickedEvent): void {
    // Check if the click was on the actions column by checking the event target
    const target = event.event?.target as HTMLElement;
    if (target && target.closest('button')) {
      return; // Don't navigate if clicking on a button (actions)
    }

    // Navigate to reservation detail page
    const reservationId = event.data.reservationId;
    if (reservationId) {
      this.router.navigate(['/management/reservations', reservationId]);
    }
  }

  onCellClicked(event: any): void {
    // No action buttons to handle - this method can be removed or kept for future use
  }

  // View mode methods
  setViewMode(mode: 'table' | 'calendar'): void {
    this.viewMode = mode;
    if (mode === 'calendar') {
      this.generateCalendarDays();
    }
    setTimeout(() => feather.replace(), 100);
  }

  // Calendar methods
  generateCalendarDays(): void {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    this.calendarDays = [];
    this.calendarWeeks = [];
    const today = new Date();

    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      this.calendarDays.push({
        date: date,
        isCurrentMonth: date.getMonth() === month,
        isToday: date.toDateString() === today.toDateString()
      });
    }

    // Organize days into weeks
    for (let i = 0; i < 6; i++) {
      this.calendarWeeks.push(this.calendarDays.slice(i * 7, (i + 1) * 7));
    }
  }

  getCurrentPeriodTitle(): string {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long' };
    return this.currentDate.toLocaleDateString('en-US', options);
  }

  previousPeriod(): void {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.generateCalendarDays();
    this.loadData();
  }

  nextPeriod(): void {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.generateCalendarDays();
    this.loadData();
  }

  goToToday(): void {
    this.currentDate = new Date();
    this.generateCalendarDays();
    this.loadData();
  }

  private getCurrentMonthRange(): { monthStart: number; monthEnd: number } {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const monthStart = new Date(year, month, 1, 0, 0, 0, 0).getTime();
    const monthEnd = new Date(year, month + 1, 1, 0, 0, 0, 0).getTime();

    return { monthStart, monthEnd };
  }

  getReservationsForDay(date: Date): ReservationData[] {
    return this.rowData.filter(reservation => {
      const checkInDate = new Date(reservation.checkInDate);
      const checkOutDate = new Date(reservation.checkOutDate);

      // Check if the date falls within the reservation period
      return date >= checkInDate && date < checkOutDate;
    });
  }

  /**
   * Handle reservation click with event propagation control
   */
  onReservationClick(event: MouseEvent, reservation: ReservationData): void {
    // Stop all event propagation to prevent row selection or other parent handlers
    event.stopImmediatePropagation();
    event.preventDefault();

    console.log('Reservation clicked:', reservation.reservationId);

    // Open reservation in a new tab
    this.viewReservation(reservation);
  }

  viewReservation(reservation: ReservationData): void {
    // Open reservation in a new tab
    const url = this.router.serializeUrl(
      this.router.createUrlTree(['/management/reservations', reservation.reservationId])
    );
    window.open(url, '_blank');
  }

  // Modern calendar styling methods
  getCalendarDayClasses(day: any): string {
    const baseClasses = 'bg-white dark:bg-gray-800';
    const currentMonthClasses = day.isCurrentMonth
      ? 'border-gray-200 dark:border-gray-600'
      : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50';
    const todayClasses = day.isToday
      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg'
      : '';

    return `${baseClasses} ${currentMonthClasses} ${todayClasses}`;
  }

  getDateClasses(day: any): string {
    if (day.isToday) {
      return 'text-blue-600 dark:text-blue-400';
    }
    if (!day.isCurrentMonth) {
      return 'text-gray-400 dark:text-gray-500';
    }
    return 'text-gray-900 dark:text-white';
  }

  getReservationCardClasses(reservation: ReservationData): string {
    const baseClasses = 'shadow-sm border';

    if (reservation.status === 1) {
      // Confirmed reservation
      if (reservation.checkinStatus === 'completed') {
        return `${baseClasses} bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300`;
      } else {
        return `${baseClasses} bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300`;
      }
    } else {
      // Cancelled reservation
      return `${baseClasses} bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300`;
    }
  }

  getReservationStatusDot(reservation: ReservationData): string {
    if (reservation.status === 1) {
      // Confirmed reservation
      if (reservation.checkinStatus === 'completed') {
        return 'bg-blue-500';
      } else if (reservation.checkinStatus === 'pending' || reservation.checkinStatus === 'in_progress') {
        return 'bg-yellow-500';
      } else {
        return 'bg-green-500';
      }
    } else {
      // Cancelled reservation
      return 'bg-red-500';
    }
  }

  getTotalReservationsForMonth(): number {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    return this.rowData.filter(reservation => {
      const checkInDate = new Date(reservation.checkInDate);
      return checkInDate.getFullYear() === year && checkInDate.getMonth() === month;
    }).length;
  }

  getReservationsStartingOnDay(date: Date): ReservationData[] {
    const dateStr = date.toDateString();
    return this.rowData.filter(reservation => {
      const checkInDate = new Date(reservation.checkInDate);
      return checkInDate.toDateString() === dateStr;
    });
  }

  getReservationBarsForWeek(weekIndex: number): any[] {
    const week = this.calendarWeeks[weekIndex];
    if (!week) return [];

    const bars: any[] = [];
    const gapSize = 8; // gap-2 = 0.5rem = 8px
    const cellWidth = `(100% - ${6 * gapSize}px) / 7`; // Width of one cell
    const topPadding = 40; // Space for date header (pt-10 = 40px)
    const verticalSpacing = 8; // Space between reservation bars

    // Track vertical position for each day to stack reservations
    const dayVerticalOffsets: number[] = [0, 0, 0, 0, 0, 0, 0];

    // Process each day in the week
    week.forEach((day, dayIndex) => {
      const reservations = this.getReservationsStartingOnDay(day.date);

      reservations.forEach(reservation => {
        const checkInDate = new Date(reservation.checkInDate);
        const checkOutDate = new Date(reservation.checkOutDate);

        // Normalize dates
        checkInDate.setHours(0, 0, 0, 0);
        checkOutDate.setHours(0, 0, 0, 0);

        // Calculate total nights
        const totalNights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

        // Calculate span within this week
        const daysRemainingInWeek = 7 - dayIndex;
        const span = Math.min(totalNights, daysRemainingInWeek);

        // Calculate left position
        // left = dayIndex * (cellWidth + gap)
        const leftCalc = `calc(${dayIndex} * (${cellWidth} + ${gapSize}px))`;

        // Calculate width
        // width = span * cellWidth + (span - 1) * gap
        const widthCalc = `calc(${span} * ${cellWidth} + ${(span - 1) * gapSize}px)`;

        // Calculate top position (stacking reservations vertically)
        const topPosition = topPadding + dayVerticalOffsets[dayIndex];

        // Update vertical offset for this day and all spanned days
        const barHeight = 52; // Approximate height of reservation bar
        for (let i = 0; i < span; i++) {
          if (dayIndex + i < 7) {
            dayVerticalOffsets[dayIndex + i] = Math.max(
              dayVerticalOffsets[dayIndex + i],
              topPosition - topPadding + barHeight + verticalSpacing
            );
          }
        }

        bars.push({
          reservation: reservation,
          left: leftCalc,
          top: `${topPosition}px`,
          width: widthCalc,
          span: span
        });
      });
    });

    return bars;
  }

  getReservationBarClasses(reservation: ReservationData): string {
    const baseClasses = 'rounded-lg border-l-4';

    if (reservation.status === 1) {
      // Confirmed reservation
      if (reservation.checkinStatus === 'completed') {
        return `${baseClasses} bg-blue-100 border-blue-500 text-blue-900 dark:bg-blue-900/40 dark:border-blue-400 dark:text-blue-100`;
      } else {
        return `${baseClasses} bg-green-100 border-green-500 text-green-900 dark:bg-green-900/40 dark:border-green-400 dark:text-green-100`;
      }
    } else {
      // Cancelled reservation
      return `${baseClasses} bg-red-100 border-red-500 text-red-900 dark:bg-red-900/40 dark:border-red-400 dark:text-red-100`;
    }
  }

  // Toolbar event handlers
  onSearchChange(searchText: string): void {
    if (this.gridApi) {
      this.gridService.applyQuickFilter(this.gridApi, searchText);
    }
  }

  onStatusFilterChange(status: string): void {
    this.statusFilter = status;
    this.applyFilters();
  }

  onResetFilters(): void {
    this.statusFilter = '';
    this.checkinFilter = '';
    if (this.gridApi) {
      this.gridService.resetGridFilters(this.gridApi);
    }
  }

  onColumnVisibilityChange(event: { column: any; visible: boolean }): void {
    // Column visibility is handled by the toolbar component
    // This is just for any additional logic if needed
  }

  private setupWindowFunctions(): void {
    // Set up global functions for grid actions
    (window as any).viewReservation = (reservationId: string) => {
      // Open reservation in a new tab
      const url = this.router.serializeUrl(
        this.router.createUrlTree(['/management/reservations', reservationId])
      );
      window.open(url, '_blank');
    };
  }

  // ============================================
  // TIMELINE VIEW METHODS
  // ============================================

  /**
   * Get unique listings from all reservations
   */
  getUniqueListings(): { roomId: string; roomName: string; roomAlias: string }[] {
    const listingsMap = new Map<string, { roomId: string; roomName: string; roomAlias: string }>();

    this.rowData.forEach(reservation => {
      // Make sure we have the required fields
      if (reservation.roomId && reservation.roomName && reservation.roomAlias) {
        if (!listingsMap.has(reservation.roomId)) {
          listingsMap.set(reservation.roomId, {
            roomId: reservation.roomId,
            roomName: reservation.roomName,
            roomAlias: reservation.roomAlias
          });
        }
      }
    });

    const listings = Array.from(listingsMap.values()).sort((a, b) => {
      const aliasA = a.roomAlias || '';
      const aliasB = b.roomAlias || '';
      return aliasA.localeCompare(aliasB);
    });

    return listings;
  }

  /**
   * Get array of days for the timeline (current month)
   */
  getTimelineDays(): Date[] {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Date[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  }

  /**
   * Check if a date is today
   */
  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  /**
   * Get reservation bars for a specific listing in timeline view
   */
  getTimelineReservationsForListing(roomId: string): any[] {
    const reservations = this.rowData.filter(r => r.roomId === roomId);
    const bars: any[] = [];
    const timelineDays = this.getTimelineDays();
    const dayWidth = 80; // 80px per day
    const verticalSpacing = 8;

    // Track vertical positions for stacking
    const occupiedSlots: { start: number; end: number; top: number }[] = [];

    reservations.forEach(reservation => {
      const checkInDate = new Date(reservation.checkInDate);
      const checkOutDate = new Date(reservation.checkOutDate);

      // Normalize dates
      checkInDate.setHours(0, 0, 0, 0);
      checkOutDate.setHours(0, 0, 0, 0);

      // Find the start day index in the timeline
      const startDayIndex = timelineDays.findIndex(day => {
        const d = new Date(day);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === checkInDate.getTime();
      });

      if (startDayIndex === -1) return; // Reservation not in current month

      // Calculate number of days to span
      const totalNights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysInMonth = timelineDays.length;
      const daysToSpan = Math.min(totalNights, daysInMonth - startDayIndex);

      // Calculate left position
      const left = `${startDayIndex * dayWidth}px`;

      // Calculate width
      const width = `${daysToSpan * dayWidth}px`;

      // Find vertical position (stack if overlapping)
      let topPosition = 10; // Default top padding

      for (const slot of occupiedSlots) {
        // Check if this reservation overlaps with existing slot
        const endDayIndex = startDayIndex + daysToSpan - 1;
        if (!(endDayIndex < slot.start || startDayIndex > slot.end)) {
          // Overlaps, need to stack
          topPosition = Math.max(topPosition, slot.top + 60 + verticalSpacing);
        }
      }

      // Record this slot
      occupiedSlots.push({
        start: startDayIndex,
        end: startDayIndex + daysToSpan - 1,
        top: topPosition
      });

      bars.push({
        reservation: reservation,
        left: left,
        top: `${topPosition}px`,
        width: width
      });
    });

    return bars;
  }

  /**
   * Calculate the required height for a listing row based on stacked reservations
   */
  getListingRowHeight(roomId: string): string {
    const bars = this.getTimelineReservationsForListing(roomId);

    if (bars.length === 0) {
      return '80px'; // Default minimum height
    }

    // Find the maximum top position
    let maxTop = 0;
    bars.forEach(bar => {
      const topValue = parseInt(bar.top.replace('px', ''));
      maxTop = Math.max(maxTop, topValue);
    });

    // Calculate total height: max top position + bar height (60px) + bottom padding (20px)
    const totalHeight = maxTop + 60 + 20;

    // Ensure minimum height of 80px
    return `${Math.max(totalHeight, 80)}px`;
  }


}
