import { Injectable } from '@angular/core';
import { ColDef, GridOptions, GridApi } from 'ag-grid-community';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ColumnConfig {
  field: string;
  headerName: string;
  width?: number;
  editable?: boolean;
  cellEditor?: string;
  cellEditorParams?: any;
  cellRenderer?: any;
  valueFormatter?: (params: any) => string;
  valueSetter?: (params: any) => boolean;
  hide?: boolean;
  pinned?: 'left' | 'right' | null;
  sortable?: boolean;
  filter?: boolean | string;
  resizable?: boolean;
  flex?: number;
  minWidth?: number;
}

export interface GridState {
  columnState: any[];
  sortModel: any[];
  filterModel: any;
}

@Injectable({
  providedIn: 'root'
})
export class GridService {
  private gridStates = new Map<string, GridState>();
  private columnConfigs = new Map<string, ColumnConfig[]>();

  constructor() {}

  /**
   * Create default grid options with modern professional settings
   */
  createDefaultGridOptions(): GridOptions {
    return {
      defaultColDef: {
        sortable: true,
        filter: true,
        resizable: true,
        editable: false,
        flex: 1,
        minWidth: 140,
        cellStyle: {
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '20px',
          paddingRight: '20px'
        },
        headerClass: 'modern-header',
        cellClass: 'modern-cell'
      },
      // Modern grid features
      enableRangeSelection: false, // Disabled - requires enterprise CellSelectionModule
      enableCellTextSelection: true,
      suppressRowClickSelection: false,
      rowSelection: 'multiple',
      animateRows: true,
      rowHeight: 52,
      headerHeight: 60,

      // Modern pagination
      pagination: true,
      paginationPageSize: 25,
      paginationPageSizeSelector: [10, 25, 50, 100],
      paginationAutoPageSize: false,

      // Enhanced UX
      suppressCellFocus: false,
      enableBrowserTooltips: true,
      suppressRowHoverHighlight: false,
      suppressColumnVirtualisation: false,
      suppressRowVirtualisation: false,

      // Loading and empty states
      loadingOverlayComponent: 'agLoadingOverlay',
      noRowsOverlayComponent: 'agNoRowsOverlay',
      overlayLoadingTemplate: `
        <div class="flex items-center justify-center p-8">
          <div class="flex items-center space-x-3">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span class="text-gray-600 font-medium">Loading data...</span>
          </div>
        </div>
      `,
      overlayNoRowsTemplate: `
        <div class="flex flex-col items-center justify-center p-8 text-gray-500">
          <i data-feather="inbox" class="w-12 h-12 mb-4 text-gray-400"></i>
          <span class="text-lg font-medium mb-2">No data available</span>
          <span class="text-sm">Try adjusting your filters or add new records</span>
        </div>
      `,

      // Modern callbacks
      onGridReady: (params) => {
        this.onGridReady(params);
      },
      onFirstDataRendered: (params) => {
        this.onFirstDataRendered(params);
      },
      onColumnResized: (params) => {
        // Grid state saving will be handled by individual components
      },
      onColumnMoved: (params) => {
        // Grid state saving will be handled by individual components
      },
      onSortChanged: (params) => {
        // Grid state saving will be handled by individual components
      },
      onFilterChanged: (params) => {
        // Grid state saving will be handled by individual components
      }
    };
  }

  /**
   * Enhanced grid ready callback
   */
  private onGridReady(params: any): void {
    // Auto-size columns on ready
    params.api.sizeColumnsToFit();

    // Grid state restoration will be handled by individual components

    // Set up responsive column sizing
    this.setupResponsiveColumns(params.api);
  }

  /**
   * Enhanced first data rendered callback
   */
  private onFirstDataRendered(params: any): void {
    // Auto-size columns when data is first loaded
    params.api.sizeColumnsToFit();

    // Auto-size specific columns to content
    const columnsToAutoSize = ['status', 'actions'];
    params.api.autoSizeColumns(columnsToAutoSize, false);
  }

  /**
   * Setup responsive column behavior
   */
  private setupResponsiveColumns(gridApi: GridApi): void {
    const updateColumnVisibility = () => {
      // Hide less important columns on smaller screens
      if (window.innerWidth < 768) {
        gridApi.setColumnsVisible(['description', 'createdAt'], false);
      } else if (window.innerWidth < 1024) {
        gridApi.setColumnsVisible(['description'], false);
        gridApi.setColumnsVisible(['createdAt'], true);
      } else {
        gridApi.setColumnsVisible(['description', 'createdAt'], true);
      }
    };

    // Initial setup
    updateColumnVisibility();

    // Listen for window resize
    window.addEventListener('resize', updateColumnVisibility);
  }

  /**
   * Create modern column definitions from configuration
   */
  createColumnDefs(configs: ColumnConfig[]): ColDef[] {
    return configs.map(config => ({
      field: config.field,
      headerName: config.headerName,
      width: config.width,
      editable: config.editable || false,
      cellEditor: config.cellEditor,
      cellEditorParams: config.cellEditorParams,
      valueFormatter: config.valueFormatter,
      valueSetter: config.valueSetter,
      hide: config.hide || false,
      pinned: config.pinned,
      sortable: config.sortable !== false,
      filter: config.filter !== false,
      resizable: config.resizable !== false,
      cellClass: this.getCellClass(config.field),
      headerClass: 'modern-header-cell',
      cellRenderer: this.getCellRenderer(config.field)
    }));
  }

  /**
   * Get appropriate cell class based on field type
   */
  private getCellClass(field: string): string {
    const classes = ['modern-cell'];

    if (field === 'status') {
      classes.push('status-cell');
    } else if (field === 'actions') {
      classes.push('action-cell');
    } else if (field.includes('date') || field.includes('Date')) {
      classes.push('date-cell');
    } else if (field.includes('price') || field.includes('amount')) {
      classes.push('currency-cell');
    }

    return classes.join(' ');
  }

  /**
   * Get appropriate cell renderer based on field type
   */
  private getCellRenderer(field: string): any {
    switch (field) {
      case 'status':
        return this.statusCellRenderer;
      case 'actions':
        return this.actionCellRenderer;
      default:
        return undefined;
    }
  }

  /**
   * Status cell renderer for modern status badges
   */
  private statusCellRenderer = (params: any) => {
    if (!params.value) return '';

    const status = params.value.toLowerCase();
    const statusClass = `status-${status}`;

    return `
      <div class="status-badge ${statusClass}">
        ${this.getStatusIcon(status)}
        ${params.value}
      </div>
    `;
  };

  /**
   * Action cell renderer for modern action buttons
   */
  private actionCellRenderer = (params: any) => {
    return `
      <div class="action-buttons">
        <button class="action-btn edit-btn" title="Edit" data-action="edit" data-id="${params.data.id}">
          <i data-feather="edit-2"></i>
        </button>
        <button class="action-btn delete-btn" title="Delete" data-action="delete" data-id="${params.data.id}">
          <i data-feather="trash-2"></i>
        </button>
      </div>
    `;
  };

  /**
   * Get status icon based on status value
   */
  private getStatusIcon(status: string): string {
    const icons: { [key: string]: string } = {
      'confirmed': '<i data-feather="check-circle" class="w-3 h-3 mr-1"></i>',
      'pending': '<i data-feather="clock" class="w-3 h-3 mr-1"></i>',
      'cancelled': '<i data-feather="x-circle" class="w-3 h-3 mr-1"></i>',
      'active': '<i data-feather="check" class="w-3 h-3 mr-1"></i>',
      'inactive': '<i data-feather="minus-circle" class="w-3 h-3 mr-1"></i>'
    };

    return icons[status] || '';
  }

  /**
   * Create modern filter configurations
   */
  createModernFilters(): { [key: string]: any } {
    return {
      text: {
        filter: 'agTextColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
          closeOnApply: true,
          debounceMs: 300
        }
      },
      number: {
        filter: 'agNumberColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
          closeOnApply: true,
          debounceMs: 300
        }
      },
      date: {
        filter: 'agDateColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
          closeOnApply: true,
          comparator: (filterLocalDateAtMidnight: Date, cellValue: string) => {
            const cellDate = new Date(cellValue);
            if (filterLocalDateAtMidnight.getTime() === cellDate.getTime()) {
              return 0;
            }
            return filterLocalDateAtMidnight.getTime() > cellDate.getTime() ? 1 : -1;
          }
        }
      },
      set: {
        filter: 'agSetColumnFilter',
        filterParams: {
          buttons: ['reset', 'apply'],
          closeOnApply: true
        }
      }
    };
  }

  /**
   * Save grid state (columns, sorting, filtering)
   */
  saveGridState(gridId: string, gridApi: GridApi): void {
    try {
      const state: GridState = {
        columnState: gridApi.getColumnState(),
        sortModel: [], // Simplified for compatibility
        filterModel: gridApi.getFilterModel()
      };
      this.gridStates.set(gridId, state);

      // Save to localStorage for persistence
      localStorage.setItem(`grid-state-${gridId}`, JSON.stringify(state));
    } catch (error) {
      console.warn('Could not save grid state:', error);
    }
  }

  /**
   * Restore grid state
   */
  restoreGridState(gridId: string, gridApi: GridApi): void {
    try {
      // Try to get from memory first, then localStorage
      let state = this.gridStates.get(gridId);

      if (!state) {
        const savedState = localStorage.getItem(`grid-state-${gridId}`);
        if (savedState) {
          state = JSON.parse(savedState);
          if (state) {
            this.gridStates.set(gridId, state);
          }
        }
      }

      if (state) {
        gridApi.applyColumnState({
          state: state.columnState,
          applyOrder: true
        });
        // Skip sort model for compatibility
        gridApi.setFilterModel(state.filterModel);
      }
    } catch (error) {
      console.warn('Could not restore grid state:', error);
    }
  }

  /**
   * Reset grid state
   */
  resetGridState(gridId: string, gridApi: GridApi): void {
    try {
      this.gridStates.delete(gridId);
      localStorage.removeItem(`grid-state-${gridId}`);

      gridApi.resetColumnState();
      // Skip sort model for compatibility
      gridApi.setFilterModel({});
    } catch (error) {
      console.warn('Could not reset grid state:', error);
    }
  }

  /**
   * Export grid data to CSV
   */
  exportToCsv(gridApi: GridApi, fileName: string): void {
    gridApi.exportDataAsCsv({
      fileName: fileName,
      processCellCallback: (params) => {
        // Handle special formatting for export
        if (params.value instanceof Date) {
          return params.value.toISOString();
        }
        return params.value;
      }
    });
  }

  /**
   * Get selected rows data
   */
  getSelectedRowsData(gridApi: GridApi): any[] {
    return gridApi.getSelectedRows();
  }

  /**
   * Update row data
   */
  updateRowData(gridApi: GridApi, rowData: any[]): void {
    gridApi.setGridOption('rowData', rowData);
  }

  /**
   * Add new row
   */
  addRow(gridApi: GridApi, newRow: any): void {
    gridApi.applyTransaction({ add: [newRow] });
  }

  /**
   * Update existing row
   */
  updateRow(gridApi: GridApi, updatedRow: any): void {
    gridApi.applyTransaction({ update: [updatedRow] });
  }

  /**
   * Remove rows
   */
  removeRows(gridApi: GridApi, rowsToRemove: any[]): void {
    gridApi.applyTransaction({ remove: rowsToRemove });
  }



  /**
   * Size columns to fit
   */
  sizeColumnsToFit(gridApi: GridApi): void {
    gridApi.sizeColumnsToFit();
  }

  /**
   * Get column configuration for a specific grid type
   */
  getColumnConfig(gridType: string): ColumnConfig[] {
    return this.columnConfigs.get(gridType) || [];
  }

  /**
   * Set column configuration for a specific grid type
   */
  setColumnConfig(gridType: string, config: ColumnConfig[]): void {
    this.columnConfigs.set(gridType, config);
  }

  /**
   * Create date formatter
   */
  createDateFormatter(format: string = 'short'): (params: any) => string {
    return (params) => {
      if (!params.value) return '';
      const date = new Date(params.value);
      return date.toLocaleDateString();
    };
  }

  /**
   * Create currency formatter
   */
  createCurrencyFormatter(currency: string = 'USD'): (params: any) => string {
    return (params) => {
      if (params.value == null) return '';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(params.value);
    };
  }

  /**
   * Create boolean formatter
   */
  createBooleanFormatter(): (params: any) => string {
    return (params) => {
      if (params.value == null) return '';
      return params.value ? 'Yes' : 'No';
    };
  }

  /**
   * Create status formatter with colors
   */
  createStatusFormatter(statusMap: { [key: string]: { label: string, color: string } }): (params: any) => string {
    return (params) => {
      if (!params.value) return '';
      const status = statusMap[params.value];
      return status ? status.label : params.value;
    };
  }

  /**
   * Export grid data to CSV with modern formatting
   */
  exportToCSV(gridApi: GridApi, filename?: string): void {
    const params = {
      fileName: filename || `harmonest_export_${new Date().toISOString().split('T')[0]}.csv`,
      columnSeparator: ',',
      suppressQuotes: false,
      skipColumnGroupHeaders: false,
      skipColumnHeaders: false,
      allColumns: false,
      onlySelected: false,
      processCellCallback: (params: any) => {
        // Clean up cell values for export
        if (params.value && typeof params.value === 'string') {
          return params.value.replace(/"/g, '""'); // Escape quotes
        }
        return params.value;
      }
    };

    gridApi.exportDataAsCsv(params);
  }

  /**
   * Get grid statistics
   */
  getGridStats(gridApi: GridApi): { total: number; filtered: number; selected: number } {
    return {
      total: gridApi.getDisplayedRowCount(),
      filtered: gridApi.getDisplayedRowCount(),
      selected: gridApi.getSelectedRows().length
    };
  }

  /**
   * Apply quick filter with debouncing
   */
  applyQuickFilter(gridApi: GridApi, filterText: string): void {
    gridApi.setGridOption('quickFilterText', filterText);
  }

  /**
   * Reset all filters and sorting
   */
  resetGridFilters(gridApi: GridApi): void {
    gridApi.setFilterModel(null);
    gridApi.setGridOption('quickFilterText', '');
  }

  /**
   * Auto-size all columns
   */
  autoSizeAllColumns(gridApi: GridApi): void {
    const allColumnIds = gridApi.getColumns()?.map(column => column.getId()) || [];
    gridApi.autoSizeColumns(allColumnIds, false);
  }

  /**
   * Create modern column configuration for common field types
   */
  createStandardColumns(): { [key: string]: Partial<ColDef> } {
    return {
      id: {
        headerName: 'ID',
        width: 120,
        pinned: 'left',
        hide: true,
        filter: 'agTextColumnFilter'
      },
      name: {
        headerName: 'Name',
        minWidth: 180,
        filter: 'agTextColumnFilter',
        cellClass: 'font-medium'
      },
      status: {
        headerName: 'Status',
        width: 140,
        cellRenderer: this.statusCellRenderer,
        filter: 'agSetColumnFilter',
        filterParams: {
          values: ['Active', 'Inactive', 'Pending', 'Confirmed', 'Cancelled']
        }
      },
      createdAt: {
        headerName: 'Created',
        width: 160,
        filter: 'agDateColumnFilter',
        valueFormatter: (params) => {
          if (params.value) {
            return new Date(params.value).toLocaleDateString();
          }
          return '';
        }
      },
      updatedAt: {
        headerName: 'Updated',
        width: 160,
        filter: 'agDateColumnFilter',
        valueFormatter: (params) => {
          if (params.value) {
            return new Date(params.value).toLocaleDateString();
          }
          return '';
        }
      },
      actions: {
        headerName: 'Actions',
        width: 140,
        pinned: 'right',
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: this.actionCellRenderer
      }
    };
  }
}
