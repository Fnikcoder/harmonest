import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { FooterComponent } from '../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../components/switcher/switcher.component';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NavbarComponent,
    FooterComponent,
    SwitcherComponent
  ],
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.scss'
})
export class PrivacyComponent {
  restrictions = [
    'Digital Marketing Solutions for Tomorrow',
    'Our Talented & Experienced Marketing Agency',
    'Create your own skin to match your brand',
    'Digital Marketing Solutions for Tomorrow',
    'Our Talented & Experienced Marketing Agency',
    'Create your own skin to match your brand'
  ]
}
