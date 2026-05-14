import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

interface ActionButton {
  action: string;
  icon: string;
  title: string;
  class: string;
  condition?: (data: any) => boolean;
}

@Component({
  selector: 'app-action-cell-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="action-buttons flex items-center space-x-1">
      <button
        *ngFor="let button of visibleButtons"
        [class]="'action-btn ' + button.class"
        [title]="button.title"
        [attr.data-action]="button.action"
        [attr.data-id]="rowId"
        (click)="onActionClick(button.action, $event)"
        type="button"
      >
        <i [attr.data-feather]="button.icon" class="w-4 h-4"></i>
      </button>
    </div>
  `,
  styles: [`
    .action-buttons {
      display: flex;
      align-items: center;
      gap: 4px;
      height: 100%;
    }

    .action-btn {
      @apply inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-300
             bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2
             focus:ring-blue-500 focus:border-transparent transition-all duration-200;
    }

    .action-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .action-btn.view-btn:hover {
      @apply bg-blue-50 text-blue-600 border-blue-300;
    }

    .action-btn.edit-btn:hover {
      @apply bg-green-50 text-green-600 border-green-300;
    }

    .action-btn.delete-btn:hover {
      @apply bg-red-50 text-red-600 border-red-300;
    }

    .action-btn.assign-btn:hover {
      @apply bg-purple-50 text-purple-600 border-purple-300;
    }

    .action-btn.download-btn:hover {
      @apply bg-indigo-50 text-indigo-600 border-indigo-300;
    }

    /* Dark mode support */
    .dark .action-btn {
      @apply border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600;
    }

    .dark .action-btn.view-btn:hover {
      @apply bg-blue-900 text-blue-400 border-blue-600;
    }

    .dark .action-btn.edit-btn:hover {
      @apply bg-green-900 text-green-400 border-green-600;
    }

    .dark .action-btn.delete-btn:hover {
      @apply bg-red-900 text-red-400 border-red-600;
    }

    .dark .action-btn.assign-btn:hover {
      @apply bg-purple-900 text-purple-400 border-purple-600;
    }

    .dark .action-btn.download-btn:hover {
      @apply bg-indigo-900 text-indigo-400 border-indigo-600;
    }

    /* Disabled state */
    .action-btn:disabled {
      @apply opacity-50 cursor-not-allowed;
    }

    .action-btn:disabled:hover {
      transform: none;
      box-shadow: none;
    }
  `]
})
export class ActionCellRendererComponent implements ICellRendererAngularComp, OnDestroy {
  params!: ICellRendererParams;
  rowId!: string;
  visibleButtons: ActionButton[] = [];

  private defaultButtons: ActionButton[] = [
    {
      action: 'view',
      icon: 'eye',
      title: 'View Details',
      class: 'view-btn'
    },
    {
      action: 'edit',
      icon: 'edit-2',
      title: 'Edit',
      class: 'edit-btn'
    },
    {
      action: 'delete',
      icon: 'trash-2',
      title: 'Delete',
      class: 'delete-btn'
    }
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.rowId = params.data?.id || params.data?.PK || params.data?.reservationId || '';

    // Get custom buttons from column definition or use defaults
    const customButtons = params.colDef?.cellRendererParams?.buttons;
    const buttons = customButtons || this.defaultButtons;

    // Filter buttons based on conditions
    this.visibleButtons = buttons.filter((button: ActionButton) => {
      if (button.condition) {
        return button.condition(params.data);
      }
      return true;
    });

    // Initialize feather icons
    setTimeout(() => {
      if (typeof feather !== 'undefined') {
        feather.replace();
      }
    }, 0);
  }

  refresh(params: ICellRendererParams): boolean {
    this.agInit(params);
    return true;
  }

  onActionClick(action: string, event: Event): void {
    event.stopPropagation();

    // Emit action through params callback
    if (this.params.context && this.params.context.onActionClick) {
      this.params.context.onActionClick(action, this.rowId, this.params.data);
    }

    // Also trigger through column definition callback if available
    const callback = this.params.colDef?.cellRendererParams?.onActionClick;
    if (callback) {
      callback(action, this.rowId, this.params.data);
    }

    // Re-initialize feather icons after action
    setTimeout(() => {
      if (typeof feather !== 'undefined') {
        feather.replace();
      }
    }, 100);
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }
}

// Declare feather for TypeScript
declare var feather: any;

// Export action button interface for use in other components
export type { ActionButton };
