import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import Package from '../../data/packages.json'

@Component({
  selector: 'app-grid-data',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink
  ],
  templateUrl: './grid-data.component.html',
  styleUrl: './grid-data.component.scss'
})
export class GridDataComponent {
  package = Package
  @Input() packageData: any;
  @Input() searchParams: any;
  get currentSearchParams() {
    return this.searchParams || {};
  }

}
