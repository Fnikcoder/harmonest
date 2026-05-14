import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, CellValueChangedEvent } from 'ag-grid-community';
import { Subject, takeUntil } from 'rxjs';
import { GridService, ColumnConfig } from '../shared/grid.service';
import { ManagementDataService, DoorData } from '../shared/management-data.service';
import { ActionCellRendererComponent, ActionButton } from '../shared/action-cell-renderer.component';
import * as feather from 'feather-icons';

@Component({
  selector: 'app-doors-management',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular, ActionCellRendererComponent],
  template: `
    <div class="p-6">
      <!-- Header with Add Door button -->
      <div class="mb-6 flex justify-between items-center">
        <div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Smart Doors Management</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">Manage smart locks, QR readers, and door access systems</p>
        </div>
        <button (click)="showAddDoorModal = true"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <i data-feather="plus" class="size-4 mr-2"></i>Add Door
        </button>
      </div>

      <!-- Filters and Controls -->
      <div class="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div class="flex flex-wrap items-center gap-4">
          <div class="flex items-center space-x-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Type:</label>
            <select [(ngModel)]="typeFilter" (change)="applyFilters()"
                    class="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">All</option>
              <option value="qr">QR Code</option>
              <option value="pin">PIN Code</option>
              <option value="smart_lock">Smart Lock</option>
              <option value="manual">Manual</option>
            </select>
          </div>

          <div class="flex items-center space-x-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Status:</label>
            <select [(ngModel)]="statusFilter" (change)="applyFilters()"
                    class="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          <div class="flex items-center space-x-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Property:</label>
            <select [(ngModel)]="propertyFilter" (change)="applyFilters()"
                    class="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">All</option>
              <option value="Building A">Building A</option>
              <option value="Building B">Building B</option>
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
          (cellClicked)="onCellClicked($event)">
        </ag-grid-angular>
      </div>

      <!-- Add Door Modal -->
      <div *ngIf="showAddDoorModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add New Door</h3>

          <form (ngSubmit)="addDoor()" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
              <input type="text" [(ngModel)]="newDoor.name" name="name" required
                     class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type *</label>
              <select [(ngModel)]="newDoor.type" name="type" required
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="qrlock">QR Lock</option>
                <option value="ttlock">TT Lock</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reader ID *</label>
              <input type="text" [(ngModel)]="newDoor.readerId" name="readerId" required
                     class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Property</label>
              <input type="text" [(ngModel)]="newDoor.property" name="property"
                     class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
              <input type="text" [(ngModel)]="newDoor.location" name="location"
                     class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Floor</label>
                <input type="text" [(ngModel)]="newDoor.floor" name="floor"
                       class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Building</label>
                <input type="text" [(ngModel)]="newDoor.building" name="building"
                       class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Battery %</label>
              <input type="number" [(ngModel)]="newDoor.batteryLevel" name="batteryLevel" min="0" max="100"
                     class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea [(ngModel)]="newDoor.description" name="description" rows="3"
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"></textarea>
            </div>

            <div class="flex items-center space-x-2">
              <input type="checkbox" [(ngModel)]="newDoor.isActive" name="isActive" id="isActive"
                     class="rounded border-gray-300 dark:border-gray-600">
              <label for="isActive" class="text-sm text-gray-700 dark:text-gray-300">Active</label>
            </div>

            <div class="flex justify-end space-x-3 pt-4">
              <button type="button" (click)="cancelAddDoor()"
                      class="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                Cancel
              </button>
              <button type="submit"
                      class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                Add Door
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Edit Door Modal -->
      <div *ngIf="showEditDoorModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Edit Door</h3>

          <form (ngSubmit)="updateDoor()" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
              <input type="text" [(ngModel)]="editDoor.name" name="editName" required
                     class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type *</label>
              <select [(ngModel)]="editDoor.type" name="editType" required
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="qrlock">QR Lock</option>
                <option value="ttlock">TT Lock</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reader ID *</label>
              <input type="text" [(ngModel)]="editDoor.readerId" name="editReaderId" required
                     class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Property</label>
              <input type="text" [(ngModel)]="editDoor.property" name="editProperty"
                     class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
              <input type="text" [(ngModel)]="editDoor.location" name="editLocation"
                     class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Floor</label>
                <input type="text" [(ngModel)]="editDoor.floor" name="editFloor"
                       class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Building</label>
                <input type="text" [(ngModel)]="editDoor.building" name="editBuilding"
                       class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Battery %</label>
              <input type="number" [(ngModel)]="editDoor.batteryLevel" name="editBatteryLevel" min="0" max="100"
                     class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea [(ngModel)]="editDoor.description" name="editDescription" rows="3"
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"></textarea>
            </div>

            <div class="flex items-center space-x-2">
              <input type="checkbox" [(ngModel)]="editDoor.isActive" name="editIsActive" id="editIsActive"
                     class="rounded border-gray-300 dark:border-gray-600">
              <label for="editIsActive" class="text-sm text-gray-700 dark:text-gray-300">Active</label>
            </div>

            <div class="flex justify-end space-x-3 pt-4">
              <button type="button" (click)="cancelEditDoor()"
                      class="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                Cancel
              </button>
              <button type="submit"
                      class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                Update Door
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Loading Overlay -->
      <div *ngIf="loading" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 flex items-center space-x-3">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span class="text-gray-900 dark:text-white">Loading doors...</span>
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

    :host ::ng-deep .door-active {
      background-color: #dcfce7 !important;
    }

    :host ::ng-deep .door-inactive {
      background-color: #fef2f2 !important;
    }
  `]
})
export class DoorsManagementComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('agGrid') agGrid!: AgGridAngular;

  private destroy$ = new Subject<void>();
  private gridApi!: GridApi;

  // Grid data
  rowData: DoorData[] = [];
  columnDefs: ColDef[] = [];
  gridOptions: any;
  loading = false;

  // Filters
  typeFilter = '';
  statusFilter = '';
  propertyFilter = '';
  showColumnSelector = false;

  // Add door modal
  showAddDoorModal = false;
  newDoor: Omit<DoorData, 'id' | 'PK' | 'SK' | 'createdAt' | 'updatedAt'> = {
    name: '',
    type: 'qrlock',
    readerId: '',
    property: '',
    location: '',
    floor: '',
    building: '',
    batteryLevel: undefined,
    description: '',
    isActive: true
  };

  // Edit door modal
  showEditDoorModal = false;
  editDoor: Partial<DoorData> = {};

  // Stats
  totalRecords = 0;
  selectedRecords = 0;

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
      { field: 'name', headerName: 'Door Name', width: 180, editable: true, pinned: 'left' },
      { field: 'type', headerName: 'Type', width: 120, editable: true, cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ['qrlock', 'ttlock'] } },
      { field: 'readerId', headerName: 'Reader ID', width: 150, editable: true },
      { field: 'property', headerName: 'Property', width: 150, editable: true },
      { field: 'location', headerName: 'Location', width: 150, editable: true },
      { field: 'floor', headerName: 'Floor', width: 100, editable: true },
      { field: 'building', headerName: 'Building', width: 100, editable: true },
      { field: 'isActive', headerName: 'Active', width: 100, editable: true, cellEditor: 'agCheckboxCellEditor' },
      { field: 'batteryLevel', headerName: 'Battery %', width: 120, editable: true },
      { field: 'lastActivity', headerName: 'Last Activity', width: 150 },
      { field: 'description', headerName: 'Description', width: 200, editable: true },
      { field: 'createdAt', headerName: 'Created', width: 120 },
      { field: 'updatedAt', headerName: 'Updated', width: 120 }
    ];

    // Add formatters after service is available
    this.availableColumns.find(col => col.field === 'isActive')!.valueFormatter = this.gridService.createBooleanFormatter();
    this.availableColumns.find(col => col.field === 'lastActivity')!.valueFormatter = this.gridService.createDateFormatter();
    this.availableColumns.find(col => col.field === 'createdAt')!.valueFormatter = this.gridService.createDateFormatter();
    this.availableColumns.find(col => col.field === 'updatedAt')!.valueFormatter = this.gridService.createDateFormatter();

    this.columnDefs = this.gridService.createColumnDefs(this.availableColumns);

    // Add modern actions column with Angular component
    this.columnDefs.push({
      headerName: 'Actions',
      field: 'actions',
      cellRenderer: ActionCellRendererComponent,
      cellRendererParams: {
        buttons: [
          {
            action: 'edit',
            icon: 'edit-2',
            title: 'Edit Door',
            class: 'edit-btn'
          },
          {
            action: 'delete',
            icon: 'trash-2',
            title: 'Delete Door',
            class: 'delete-btn'
          }
        ] as ActionButton[],
        onActionClick: (action: string, id: string, data: any) => {
          this.handleAction(action, id, data);
        }
      },
      width: 120,
      sortable: false,
      filter: false,
      pinned: 'right',
      cellClass: 'action-cell'
    });
  }

  ngOnInit(): void {
    this.loadData();
    this.initializeFeatherIcons();

    // Set up global functions for action buttons
    (window as any).editDoor = (doorId: string) => {
      const door = this.rowData.find(d => d.id === doorId);
      if (door) {
        this.openEditDoor(door);
      }
    };

    (window as any).deleteDoor = (doorId: string) => {
      if (confirm('Are you sure you want to delete this door?')) {
        this.deleteDoor(doorId);
      }
    };
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    // Clean up global functions
    delete (window as any).editDoor;
    delete (window as any).deleteDoor;
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
    this.gridService.restoreGridState('doors-grid', this.gridApi);
  }

  loadData(): void {
    this.loading = true;
    this.dataService.getDoors()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (doors) => {
          this.rowData = doors;
          this.totalRecords = doors.length;
          this.loading = false;
          this.applyFilters();
        },
        error: (error) => {
          console.error('❌ [DoorsManagement] Error loading doors:', error);
          this.loading = false;
          // Show user-friendly error message
          alert('Failed to load doors. Please check your connection and try again.');
        }
      });
  }

  refreshData(): void {
    this.loadData();
  }

  applyFilters(): void {
    if (!this.gridApi) return;

    const filterModel: any = {};

    if (this.typeFilter) {
      filterModel.type = {
        type: 'equals',
        filter: this.typeFilter
      };
    }

    if (this.statusFilter) {
      filterModel.isActive = {
        type: 'equals',
        filter: this.statusFilter === 'true'
      };
    }

    if (this.propertyFilter) {
      filterModel.propertyName = {
        type: 'equals',
        filter: this.propertyFilter
      };
    }

    this.gridApi.setFilterModel(filterModel);
  }

  onCellValueChanged(event: CellValueChangedEvent): void {
    const updatedDoor: Partial<DoorData> = {
      id: event.data.id,
      [event.colDef.field!]: event.newValue
    };

    this.dataService.updateDoor(updatedDoor)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          console.log('Door updated successfully:', updated);
          // Update the row data
          event.node.setData(updated);
        },
        error: (error) => {
          console.error('Error updating door:', error);
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
    const target = event.event.target;
    if (target.closest('.action-btn')) {
      const button = target.closest('.action-btn');
      const action = button.getAttribute('data-action');
      const id = button.getAttribute('data-id');

      this.handleAction(action, id, event.data);

      // Re-initialize feather icons after DOM update
      setTimeout(() => {
        feather.replace();
      }, 100);
    }
  }

  private handleAction(action: string, id: string, rowData: any): void {
    switch (action) {
      case 'edit':
        this.handleEditAction(id, rowData);
        break;
      case 'delete':
        this.handleDeleteAction(id, rowData);
        break;
    }
  }

  private handleEditAction(id: string, rowData: any): void {
    console.log('Editing door:', id, rowData);
    // Use the existing openEditDoor method
    this.openEditDoor(rowData);
  }

  private handleDeleteAction(id: string, rowData: any): void {
    if (confirm('Are you sure you want to delete this door?')) {
      console.log('Deleting door:', id, rowData);
      // Use the existing deleteDoor method
      this.deleteDoor(id);
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
      this.gridService.exportToCsv(this.gridApi, 'doors-export');
    }
  }

  addDoor(): void {
    if (!this.newDoor.name || !this.newDoor.readerId) {
      return;
    }

    this.dataService.addDoor(this.newDoor as Omit<DoorData, 'id' | 'createdAt' | 'updatedAt'>)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (door) => {
          console.log('Door added successfully:', door);
          this.loadData();
          this.cancelAddDoor();
        },
        error: (error) => {
          console.error('Error adding door:', error);
        }
      });
  }

  cancelAddDoor(): void {
    this.showAddDoorModal = false;
    this.newDoor = {
      name: '',
      type: 'qrlock',
      readerId: '',
      property: '',
      location: '',
      floor: '',
      building: '',
      batteryLevel: undefined,
      description: '',
      isActive: true
    };
  }

  openEditDoor(door: DoorData): void {
    this.editDoor = { ...door };
    this.showEditDoorModal = true;
  }

  updateDoor(): void {
    if (!this.editDoor.name || !this.editDoor.type || !this.editDoor.readerId) {
      console.error('Name, Type, and Reader ID are required');
      return;
    }

    this.dataService.updateDoor(this.editDoor).subscribe({
      next: (updatedDoor) => {
        console.log('Door updated successfully:', updatedDoor);
        this.loadData();
        this.cancelEditDoor();
      },
      error: (error) => {
        console.error('Error updating door:', error);
      }
    });
  }

  cancelEditDoor(): void {
    this.showEditDoorModal = false;
    this.editDoor = {};
  }

  deleteDoor(doorId: string): void {
    this.dataService.deleteDoor(doorId).subscribe({
      next: (success) => {
        if (success) {
          console.log('Door deleted successfully:', doorId);
          this.loadData();
        }
      },
      error: (error) => {
        console.error('Error deleting door:', error);
      }
    });
  }

  private getRowClass(params: any): string {
    if (params.data.isActive) {
      return 'door-active';
    } else {
      return 'door-inactive';
    }
  }




}
