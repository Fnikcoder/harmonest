import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { FaqAccordianComponent } from '../../../components/faq-accordian/faq-accordian.component';
import { FooterComponent } from '../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../components/switcher/switcher.component';
import { GetInTouchComponent } from '../../../components/get-in-touch/get-in-touch.component';

@Component({
  selector: 'app-helpcenter-faqs',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NavbarComponent,
    FaqAccordianComponent,
    GetInTouchComponent,
    FooterComponent,
    SwitcherComponent
  ],
  templateUrl: './helpcenter-faqs.component.html',
  styleUrl: './helpcenter-faqs.component.scss'
})
export class HelpcenterFaqsComponent {

}
