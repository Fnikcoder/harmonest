import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { FaqAccordianComponent } from '../../../components/faq-accordian/faq-accordian.component';
import { FooterComponent } from '../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../components/switcher/switcher.component';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NavbarComponent,
    FaqAccordianComponent,
    FooterComponent,
    SwitcherComponent
  ],
  templateUrl: './terms.component.html',
  styleUrl: './terms.component.scss'
})
export class TermsComponent {
  restrictions = [
    'Digital Marketing Solutions for Tomorrow',
    'Our Talented & Experienced Marketing Agency',
    'Create your own skin to match your brand',
    'Digital Marketing Solutions for Tomorrow',
    'Our Talented & Experienced Marketing Agency',
    'Create your own skin to match your brand'
  ]
}
