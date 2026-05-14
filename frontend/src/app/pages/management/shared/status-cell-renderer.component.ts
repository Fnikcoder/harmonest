import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

interface StatusConfig {
  label: string;
  icon: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

@Component({
  selector: 'app-status-cell-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="status-badge" [ngClass]="statusConfig?.bgColor">
      <div class="flex items-center space-x-1">
        <i [attr.data-feather]="statusConfig?.icon" 
           [ngClass]="statusConfig?.textColor" 
           class="w-3 h-3"></i>
        <span [ngClass]="statusConfig?.textColor" 
              class="text-xs font-semibold uppercase tracking-wide">
          {{ statusConfig?.label }}
        </span>
      </div>
    </div>
  `,
  styles: [`
    .status-badge {
      @apply inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border;
      min-width: fit-content;
    }
    
    /* Status-specific styling */
    .status-confirmed {
      @apply bg-green-100 text-green-800 border-green-200;
    }
    
    .status-pending {
      @apply bg-yellow-100 text-yellow-800 border-yellow-200;
    }
    
    .status-cancelled {
      @apply bg-red-100 text-red-800 border-red-200;
    }
    
    .status-active {
      @apply bg-blue-100 text-blue-800 border-blue-200;
    }
    
    .status-inactive {
      @apply bg-gray-100 text-gray-800 border-gray-200;
    }
    
    .status-draft {
      @apply bg-gray-100 text-gray-600 border-gray-200;
    }
    
    .status-published {
      @apply bg-green-100 text-green-700 border-green-200;
    }
    
    .status-archived {
      @apply bg-orange-100 text-orange-700 border-orange-200;
    }
    
    /* Dark mode support */
    .dark .status-confirmed {
      @apply bg-green-900 text-green-300 border-green-700;
    }
    
    .dark .status-pending {
      @apply bg-yellow-900 text-yellow-300 border-yellow-700;
    }
    
    .dark .status-cancelled {
      @apply bg-red-900 text-red-300 border-red-700;
    }
    
    .dark .status-active {
      @apply bg-blue-900 text-blue-300 border-blue-700;
    }
    
    .dark .status-inactive {
      @apply bg-gray-700 text-gray-300 border-gray-600;
    }
    
    .dark .status-draft {
      @apply bg-gray-700 text-gray-400 border-gray-600;
    }
    
    .dark .status-published {
      @apply bg-green-900 text-green-400 border-green-700;
    }
    
    .dark .status-archived {
      @apply bg-orange-900 text-orange-400 border-orange-700;
    }
  `]
})
export class StatusCellRendererComponent implements ICellRendererAngularComp {
  statusConfig?: StatusConfig;
  
  private statusConfigs: { [key: string]: StatusConfig } = {
    'confirmed': {
      label: 'Confirmed',
      icon: 'check-circle',
      bgColor: 'status-confirmed',
      textColor: 'text-green-800',
      borderColor: 'border-green-200'
    },
    'pending': {
      label: 'Pending',
      icon: 'clock',
      bgColor: 'status-pending',
      textColor: 'text-yellow-800',
      borderColor: 'border-yellow-200'
    },
    'cancelled': {
      label: 'Cancelled',
      icon: 'x-circle',
      bgColor: 'status-cancelled',
      textColor: 'text-red-800',
      borderColor: 'border-red-200'
    },
    'active': {
      label: 'Active',
      icon: 'check',
      bgColor: 'status-active',
      textColor: 'text-blue-800',
      borderColor: 'border-blue-200'
    },
    'inactive': {
      label: 'Inactive',
      icon: 'minus-circle',
      bgColor: 'status-inactive',
      textColor: 'text-gray-800',
      borderColor: 'border-gray-200'
    },
    'draft': {
      label: 'Draft',
      icon: 'edit-3',
      bgColor: 'status-draft',
      textColor: 'text-gray-600',
      borderColor: 'border-gray-200'
    },
    'published': {
      label: 'Published',
      icon: 'globe',
      bgColor: 'status-published',
      textColor: 'text-green-700',
      borderColor: 'border-green-200'
    },
    'archived': {
      label: 'Archived',
      icon: 'archive',
      bgColor: 'status-archived',
      textColor: 'text-orange-700',
      borderColor: 'border-orange-200'
    }
  };

  agInit(params: ICellRendererParams): void {
    this.refresh(params);
  }

  refresh(params: ICellRendererParams): boolean {
    const status = params.value?.toLowerCase();
    
    if (status && this.statusConfigs[status]) {
      this.statusConfig = this.statusConfigs[status];
    } else {
      // Default configuration for unknown statuses
      this.statusConfig = {
        label: params.value || 'Unknown',
        icon: 'help-circle',
        bgColor: 'status-inactive',
        textColor: 'text-gray-600',
        borderColor: 'border-gray-200'
      };
    }

    // Initialize feather icons after component update
    setTimeout(() => {
      if (typeof feather !== 'undefined') {
        feather.replace();
      }
    }, 0);

    return true;
  }
}

// Declare feather for TypeScript
declare var feather: any;
