import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-listing-detail-test',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-6">
      <h1>Listing Detail Test</h1>
      <p>This is a test component to verify the import works.</p>
    </div>
  `
})
export class ListingDetailTestComponent {
}
