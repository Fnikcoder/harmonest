import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { GetInTouchComponent } from '../../../components/get-in-touch/get-in-touch.component';
import { FooterComponent } from '../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../components/switcher/switcher.component';

@Component({
  selector: 'app-helpcenter-guides',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NavbarComponent,
    GetInTouchComponent,
    FooterComponent,
    SwitcherComponent
  ],
  templateUrl: './helpcenter-guides.component.html',
  styleUrl: './helpcenter-guides.component.scss'
})
export class HelpcenterGuidesComponent {
    guidesData = [
      {
        title:'Getting started',
        feature:[
          'Deciding to purchase',
          'List your space',
          'Landing an experience or adventure',
          'Top uses questions'
        ]
      },
      {
        title:'Your calendar',
        feature:[
          'Pricing & availability',
          'Booking settings',
          'Responding to enquiries & requests',
          'Snoozing or deactivating your listing'
        ]
      },
      {
        title:'Your listings',
        feature:[
          'Updating your listing',
          'Neighbourhoods',
          'Listing photos & photography',
          'Travosy Plus',
          'API-connected software'
        ]
      },
      {
        title:'How payouts work',
        feature:[
          'Getting paid',
          'Adding payout info',
          'Your payout status',
          'Donations',
          'Taxes'
        ]
      },
      {
        title:'Your reservations',
        feature:[
          'Travosy safely',
          'Travosy Experiences and Adventures',
          'Changing a reservation',
          'Cancelling a reservation',
          'Long-term reservations'
        ]
      },
      {
        title:'Reservation help',
        feature:[
          'Help with a reservation or guest',
          'Guest cancellations',
        ]
      },
      {
        title:'Your account',
        feature:[
          'Your profile',
          'Account security',
          'Identification & verifications',
          'Reviews',
          'Superhost status'
        ]
      },
    ]
}
