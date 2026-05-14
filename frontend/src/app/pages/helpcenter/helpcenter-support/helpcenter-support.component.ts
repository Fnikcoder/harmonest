import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { HelpAboutComponent } from '../../../components/help-about/help-about.component';
import { FooterComponent } from '../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../components/switcher/switcher.component';

@Component({
  selector: 'app-helpcenter-support',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NavbarComponent,
    HelpAboutComponent,
    FooterComponent,
    SwitcherComponent
  ],
  templateUrl: './helpcenter-support.component.html',
  styleUrl: './helpcenter-support.component.scss'
})
export class HelpcenterSupportComponent {

}
