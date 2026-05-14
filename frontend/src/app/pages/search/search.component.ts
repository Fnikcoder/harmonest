import { Component } from '@angular/core';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {GridDataComponent} from '../../components/grid-data/grid-data.component';
import PackageData from '../../data/packages.json'
import {CommonModule} from '@angular/common';
import {NavbarComponent} from '../../components/navbar/navbar.component';
import {LightgalleryModule} from 'lightgallery/angular';
import {FaqAccordianComponent} from '../../components/faq-accordian/faq-accordian.component';
import {FooterComponent} from '../../components/footer/footer.component';
import {SwitcherComponent} from '../../components/switcher/switcher.component';
import {FormSingleListingComponent} from '../../components/form-single-listing/form-single-listing.component';
import {TaglineComponent} from '../../components/tagline/tagline.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [
    CommonModule,
    GridDataComponent,
    NavbarComponent,
    LightgalleryModule,
    FooterComponent,
    SwitcherComponent,
    RouterLink,
    TaglineComponent,
  ],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss'
})
export class SearchComponent {
  filteredPackages: Array<{location: {city: string; country: string; latitude: number; longitude: number; address: string; googleMapUrl: string;}; [key: string]: any}> = [];
  constructor(private route: ActivatedRoute) {}

  location: string = '';
  queryParams: any = {};
  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.queryParams = params; // ✅ capture and forward
      this.location = params['location']  || '';
      const start = new Date(params['start']);
      const end = new Date(params['end']);
      const rooms = +params['rooms'] || 1;
      const adults = +params['adults'] || 1;
      const children = +params['children'] || 0;

      this.filteredPackages = PackageData.filter(pkg =>
        pkg.location?.city?.toLowerCase() === this.location?.toLowerCase()
      );

      console.log('Search results loaded for:', {
        location,
        start,
        end,
        rooms,
        adults,
        children
      });
      console.log(this.filteredPackages);
    });
  }
}
