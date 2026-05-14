import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';

import { NavbarComponent } from '../../../../components/navbar/navbar.component';
import { FooterComponent } from '../../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../../components/switcher/switcher.component';


import { LightgalleryModule } from 'lightgallery/angular';
import PackageData from '../../../../data/packages.json'
import { ImageViewerDialogComponent } from '../../../../components/image-viewer-dialog/image-viewer-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { FormSingleListingComponent } from '../../../../components/form-single-listing/form-single-listing.component'; // Adjust path as needed
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';


@Component({
  selector: 'app-location-detail-one',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NavbarComponent,
    LightgalleryModule,
    FooterComponent,
    SwitcherComponent,
    FormSingleListingComponent
  ],
  templateUrl: './location-detail-one.component.html',
  styleUrl: './location-detail-one.component.scss'
})
export class LocationDetailOneComponent {
  packageData = PackageData;
  packageId:any;
  data :any;
  initialDateRange: { start: Date | null, end: Date | null } = { start: null, end: null };
  initialGuests = { rooms: 1, adults: 1, children: 0 };
  safeMapUrl: SafeResourceUrl | null = null; // ✅ ADD THIS


  constructor(private route: ActivatedRoute, private dialog: MatDialog,   private sanitizer: DomSanitizer // ✅ add this line
  ) { }
  openImageViewer(index: number): void {
    const dialogRef = this.dialog.open(ImageViewerDialogComponent, {
      data: this.data.images,
      panelClass: 'custom-image-dialog',
      width: '80vw',
      height: '80vh',
      autoFocus: false,
      restoreFocus: false
    });
    dialogRef.componentInstance.currentIndex = index;
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.packageId = params.get('id');
      this.data= this.packageData.find((item:any) => item.id === parseInt(this.packageId))
      if (this.data?.location?.latitude && this.data?.location?.longitude) {
        const rawUrl = `https://maps.google.com/maps?q=${this.data.location.latitude},${this.data.location.longitude}&hl=es;z=14&output=embed`;
        this.safeMapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(rawUrl);
      }
    });

    this.route.queryParamMap.subscribe(params => {
    });
    this.route.queryParams.subscribe(params => {
      const start = new Date(params['start']);
      const end = new Date(params['end']);
      this.initialDateRange = {
        start: start ? new Date(start) : null,
        end: end ? new Date(end) : null
      };
        console.log(this.initialDateRange);
      this.initialGuests = {
        rooms: parseInt(params['rooms'] || '1', 10),
        adults: parseInt(params['adults'] || '1', 10),
        children: parseInt(params['children'] || '0', 10)
      };
      console.log(this.initialGuests);
    });
  }
  handleBooking(event: any): void {
    console.log('Booking submitted:', event);
    // Optional: Send to backend, or route to confirmation page
  }

}
