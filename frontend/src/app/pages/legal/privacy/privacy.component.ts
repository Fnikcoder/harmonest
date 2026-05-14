import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BackToHomeComponent } from '../../../components/back-to-home/back-to-home.component';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { FooterComponent } from '../../../components/footer/footer.component';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    BackToHomeComponent,
    NavbarComponent,
    FooterComponent
  ],
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.scss'
})
export class PrivacyComponent {
  lastUpdated = '2025-11-28';
}
