import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavbarComponent } from '../../../../components/navbar/navbar.component';
import { LightgalleryModule } from 'lightgallery/angular';
import { FaqAccordianComponent } from '../../../../components/faq-accordian/faq-accordian.component';
import { FooterComponent } from '../../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../../components/switcher/switcher.component';

@Component({
  selector: 'app-location-detail-two',
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    LightgalleryModule,
    FaqAccordianComponent,
    FooterComponent,
    SwitcherComponent
  ],
  templateUrl: './location-detail-two.component.html',
  styleUrl: './location-detail-two.component.scss'
})
export class LocationDetailTwoComponent {

}
