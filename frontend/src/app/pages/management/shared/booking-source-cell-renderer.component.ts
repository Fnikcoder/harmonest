import { Component, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { getBookingSourceInfo, BookingSource } from './booking-source.utils';
import * as feather from 'feather-icons';

@Component({
  selector: 'app-booking-source-cell-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center space-x-2">
      <span
        class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
        [class]="badgeClasses"
        [title]="sourceInfo?.name">
        <i
          [attr.data-feather]="sourceInfo?.icon"
          class="size-3 mr-1"
          [class]="iconClasses">
        </i>
        {{ shortName }}
      </span>
    </div>
  `
})
export class BookingSourceCellRendererComponent implements ICellRendererAngularComp, AfterViewInit {
  sourceInfo: any;
  shortName: string = '';
  badgeClasses: string = '';
  iconClasses: string = '';

  agInit(params: ICellRendererParams): void {
    this.refresh(params);
  }

  refresh(params: ICellRendererParams): boolean {
    const bookingSource = params.value as BookingSource;

    if (bookingSource) {
      this.sourceInfo = getBookingSourceInfo(bookingSource);
      this.shortName = this.getShortName(bookingSource);
      this.badgeClasses = `${this.sourceInfo.bgColor} ${this.sourceInfo.color}`;
      this.iconClasses = this.sourceInfo.color;
    } else {
      // Fallback for unknown source
      this.sourceInfo = getBookingSourceInfo('unknown');
      this.shortName = '?';
      this.badgeClasses = 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400';
      this.iconClasses = 'text-gray-600 dark:text-gray-400';
    }

    return true;
  }

  ngAfterViewInit(): void {
    // Initialize feather icons after view is rendered
    setTimeout(() => {
      feather.replace();
    }, 0);
  }

  private getShortName(source: BookingSource): string {
    const shortNames: Record<BookingSource, string> = {
      airbnb: 'ABB',
      booking_com: 'BDC',
      homeaway: 'HomeAway',
      vrbo: 'VRBO',
      direct: 'Direct',
      unknown: '?'
    };

    return shortNames[source] || '?';
  }
}
