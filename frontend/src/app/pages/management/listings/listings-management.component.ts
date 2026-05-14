import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, CellValueChangedEvent, RowClickedEvent } from 'ag-grid-community';
import { Subject, takeUntil } from 'rxjs';
import { GridService, ColumnConfig } from '../shared/grid.service';
import { ManagementDataService, ListingData, DoorData } from '../shared/management-data.service';
import * as feather from 'feather-icons';

@Component({
  selector: 'app-listings-management',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular],
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
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div class="flex items-center space-x-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Channel:</label>
            <select [(ngModel)]="channelFilter" (change)="applyFilters()"
                    class="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">All</option>
              <option value="airbnb">Airbnb</option>
              <option value="booking">Booking.com</option>
              <option value="vrbo">VRBO</option>
            </select>
          </div>

          <div class="flex items-center space-x-2">
            <button (click)="showColumnSelector = !showColumnSelector"
                    class="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <i data-feather="columns" class="size-4 mr-1"></i>Columns
            </button>
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

      <!-- Grid -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <ag-grid-angular
          #agGrid
          class="ag-theme-quartz dark:ag-theme-quartz"
          style="height: 600px; width: 100%;"
          [rowData]="rowData"
          [columnDefs]="columnDefs"
          [gridOptions]="gridOptions"
          [loading]="loading"
          (gridReady)="onGridReady($event)"
          (cellValueChanged)="onCellValueChanged($event)"
          (selectionChanged)="onSelectionChanged()"
          (rowClicked)="onRowClicked($event)"
          (cellClicked)="onCellClicked($event)">
        </ag-grid-angular>
      </div>

      <!-- Loading Overlay -->
      <div *ngIf="loading" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 flex items-center space-x-3">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span class="text-gray-900 dark:text-white">Loading listings...</span>
        </div>
      </div>

      <!-- Door Assignment Modal -->
      <div *ngIf="showDoorAssignmentModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
          <div class="p-6 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Assign Doors to {{ selectedListing?.roomName }}
              </h3>
              <button (click)="closeDoorAssignment()"
                      class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <i data-feather="x" class="w-6 h-6"></i>
              </button>
            </div>
          </div>

          <div class="p-6 overflow-y-auto max-h-96">
            <div class="space-y-3" *ngIf="availableDoors.length > 0">
              <div *ngFor="let door of availableDoors"
                   class="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                <div class="flex items-center space-x-3">
                  <input type="checkbox"
                         [checked]="selectedDoorIds.includes(door.id)"
                         (change)="toggleDoorSelection(door.id)"
                         class="rounded border-gray-300 dark:border-gray-600">
                  <div>
                    <div class="font-medium text-gray-900 dark:text-white">{{ door.name }}</div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">
                      {{ door.type | titlecase }} • {{ door.location }} • {{ door.property }}
                    </div>
                  </div>
                </div>
                <div class="flex items-center space-x-2">
                  <span [class]="door.isActive ? 'text-green-600' : 'text-red-600'"
                        class="text-sm font-medium">
                    {{ door.isActive ? 'Active' : 'Inactive' }}
                  </span>
                  <i [attr.data-feather]="door.type === 'qrlock' ? 'smartphone' : door.type === 'ttlock' ? 'lock' : 'key'"
                     class="w-4 h-4 text-gray-400"></i>
                </div>
              </div>
            </div>

            <!-- No doors message -->
            <div *ngIf="availableDoors.length === 0" class="text-center py-8">
              <i data-feather="door-open" class="w-12 h-12 text-gray-400 mx-auto mb-4"></i>
              <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No Doors Available</h3>
              <p class="text-gray-500 dark:text-gray-400 mb-4">
                There are no doors in the system yet. Add some doors first to assign them to listings.
              </p>
              <button (click)="goToDoorsManagement()"
                      class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <i data-feather="plus" class="w-4 h-4 mr-2"></i>Add Doors
              </button>
            </div>
          </div>

          <div class="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
            <button (click)="closeDoorAssignment()"
                    class="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
              Cancel
            </button>
            <button (click)="saveDoorAssignment()"
                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Save Assignment
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host ::ng-deep .ag-theme-alpine {
      --ag-header-background-color: #f8fafc;
      --ag-header-foreground-color: #374151;
      --ag-border-color: #e5e7eb;
    }

    :host ::ng-deep .ag-theme-alpine-dark {
      --ag-header-background-color: #374151;
      --ag-header-foreground-color: #f9fafb;
      --ag-border-color: #4b5563;
    }

    :host ::ng-deep .ag-row-selected {
      background-color: #dbeafe !important;
    }

    :host ::ng-deep .dark .ag-row-selected {
      background-color: #1e3a8a !important;
    }
  `]
})
export class ListingsManagementComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('agGrid') agGrid!: AgGridAngular;

  private destroy$ = new Subject<void>();
  private gridApi!: GridApi;

  // Grid data
  rowData: ListingData[] = [];
  columnDefs: ColDef[] = [];
  gridOptions: any;
  loading = false;

  // Filters
  statusFilter = '';
  channelFilter = '';
  showColumnSelector = false;

  // Stats
  totalRecords = 0;
  selectedRecords = 0;

  // Door assignment
  showDoorAssignmentModal = false;
  selectedListing: ListingData | null = null;
  availableDoors: DoorData[] = [];
  selectedDoorIds: string[] = [];

  // Column configuration
  availableColumns: ColumnConfig[] = [];

  constructor(
    private gridService: GridService,
    private dataService: ManagementDataService,
    private router: Router
  ) {
    this.gridOptions = this.gridService.createDefaultGridOptions();

    // Initialize column configuration
    this.availableColumns = [
      { field: 'roomAlias', headerName: 'Alias', width: 120, editable: true },
      //{ field: 'roomName', headerName: 'Room Name', width: 200, editable: true },
      { field: 'groupName', headerName: 'Group', width: 150 },
      { field: 'status', headerName: 'Status', width: 100 },
      { field: 'customFields.doors', headerName: 'Assigned Doors', width: 200 },
      //{ field: 'airbnbListingId', headerName: 'Airbnb ID', width: 150 },
      //{ field: 'bookingHotelCode', headerName: 'Booking Code', width: 150 },
      //{ field: 'currency', headerName: 'Currency', width: 100 },
      { field: 'updatedAt', headerName: 'Last Updated', width: 150 },
      //{ field: 'type', headerName: 'Type', width: 100 }
      //{ field: 'deleted', headerName: 'Deleted', width: 100 }
    ];

    // Add formatters after service is available
    this.availableColumns.find(col => col.field === 'updatedAt')!.valueFormatter = this.gridService.createDateFormatter();
    //this.availableColumns.find(col => col.field === 'deleted')!.valueFormatter = this.gridService.createBooleanFormatter();

    this.columnDefs = this.gridService.createColumnDefs(this.availableColumns);

    // Add custom value getter for assigned doors to show doors from customFields
    const assignedDoorsColumn = this.columnDefs.find(col => col.field === 'customFields.doors');
    if (assignedDoorsColumn) {
      assignedDoorsColumn.valueGetter = (params: any) => {
        const listing = params.data;
        // Get door names from customFields.doors
        if (listing.customFields?.doors && Array.isArray(listing.customFields.doors)) {
          return listing.customFields.doors.map((door: any) => door.name).join(', ');
        }
        return '';
      };
    }

    // Remove actions column - users can click on rows to view details
  }

  ngOnInit(): void {
    this.loadData();
    this.loadDoors();
    this.initializeFeatherIcons();
    this.setupWindowFunctions();
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
    this.gridService.restoreGridState('listings-grid', this.gridApi);
  }

  loadData(): void {
    this.loading = true;
    this.dataService.getListings()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (listings) => {
          this.rowData = listings;
          this.totalRecords = listings.length;
          this.loading = false;
          this.applyFilters();
        },
        error: (error) => {
          console.error('❌ [ListingsManagement] Error loading listings:', error);
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
        filter: this.statusFilter
      };
    }

    if (this.channelFilter) {
      // Apply channel filter based on the selected channel
      if (this.channelFilter === 'airbnb') {
        filterModel.airbnbListingId = {
          type: 'notBlank'
        };
      } else if (this.channelFilter === 'booking') {
        filterModel.bookingHotelCode = {
          type: 'notBlank'
        };
      }
    }

    this.gridApi.setFilterModel(filterModel);
  }

  onCellValueChanged(event: CellValueChangedEvent): void {
    const updatedListing: Partial<ListingData> = {
      PK: event.data.PK,
      SK: event.data.SK,
      [event.colDef.field!]: event.newValue
    };

    this.dataService.updateListing(updatedListing)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          console.log('Listing updated successfully:', updated);
          // Update the row data
          event.node.setData(updated);
        },
        error: (error) => {
          console.error('Error updating listing:', error);
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

  onCellClicked(event: any): void {
    // No action buttons to handle - this method can be removed or kept for future use
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
      this.gridService.exportToCsv(this.gridApi, 'listings-export');
    }
  }

  loadDoors(): void {
    this.dataService.getAvailableDoorsForListing()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (doors) => {
          this.availableDoors = doors;
        },
        error: (error) => {
          console.error('❌ [ListingsManagement] Error loading doors:', error);
          this.availableDoors = [];
        }
      });
  }

  openDoorAssignment(listing: ListingData): void {
    // Get assigned door IDs from customFields.doors or fallback to assignedDoors
    const assignedDoorIds = listing.customFields?.doors?.map((door: any) => door.id) || listing.assignedDoors || [];

    console.log('Opening door assignment for listing:', listing.roomName, {
      currentAssignedDoors: assignedDoorIds,
      customFieldsDoors: listing.customFields?.doors,
      fallbackAssignedDoors: listing.assignedDoors,
      availableDoors: this.availableDoors.length
    });

    this.selectedListing = listing;
    this.selectedDoorIds = assignedDoorIds;
    this.showDoorAssignmentModal = true;

    // Refresh doors list when opening modal
    this.loadDoors();

    // Refresh icons after modal opens
    setTimeout(() => {
      feather.replace();
    }, 100);
  }

  closeDoorAssignment(): void {
    this.showDoorAssignmentModal = false;
    this.selectedListing = null;
    this.selectedDoorIds = [];
  }

  toggleDoorSelection(doorId: string): void {
    const index = this.selectedDoorIds.indexOf(doorId);
    if (index === -1) {
      this.selectedDoorIds.push(doorId);
    } else {
      this.selectedDoorIds.splice(index, 1);
    }
  }

  saveDoorAssignment(): void {
    if (!this.selectedListing) {
      console.error('No listing selected for door assignment');
      return;
    }

    console.log('🔄 [ListingsManagement] Saving door assignment:', {
      listingId: this.selectedListing.roomId,
      listingPK: this.selectedListing.PK,
      listingSK: this.selectedListing.SK,
      selectedDoorIds: this.selectedDoorIds,
      availableDoors: this.availableDoors.length,
      selectedListing: this.selectedListing
    });

    this.dataService.assignDoorsToListing(this.selectedListing.roomId, this.selectedDoorIds)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedListing) => {
          console.log('✅ [ListingsManagement] Door assignment completed:', {
            roomId: updatedListing.roomId,
            customFieldsDoors: updatedListing.customFields?.doors,
            updatedListing
          });

          // Wait a moment before refreshing to ensure DynamoDB consistency
          setTimeout(() => {
            console.log('🔄 [ListingsManagement] Refreshing listings data...');
            this.loadData(); // Refresh the grid
          }, 1000);

          this.closeDoorAssignment();
        },
        error: (error) => {
          console.error('❌ [ListingsManagement] Error updating door assignment:', error);
          alert('Failed to update door assignment. Please try again.');
        }
      });
  }



  goToDoorsManagement(): void {
    this.router.navigate(['/management/doors']);
  }

  private setupWindowFunctions(): void {
    // Set up global functions for grid actions
    (window as any).viewListing = (listingId: string) => {
      this.router.navigate(['/management/listings', listingId]);
    };

    (window as any).manageDoors = (listingId: string) => {
      const listing = this.rowData.find(l => l.roomId === listingId);
      if (listing) {
        this.openDoorAssignment(listing);
      }
    };

    (window as any).deleteListing = (listingId: string) => {
      console.log('Delete listing:', listingId);
      // TODO: Implement delete functionality
    };
  }

  onRowClicked(event: RowClickedEvent): void {
    // Check if the click was on a button by checking the event target
    const target = event.event?.target as HTMLElement;
    if (target && target.closest('button')) {
      return; // Don't navigate if clicking on a button (actions)
    }

    // Navigate to listing detail page
    const listingId = event.data.roomId;
    if (listingId) {
      this.router.navigate(['/management/listings', listingId]);
    }
  }


}
