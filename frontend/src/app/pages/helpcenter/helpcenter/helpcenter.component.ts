import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { GetInTouchComponent } from '../../../components/get-in-touch/get-in-touch.component';
import { HelpAboutComponent } from '../../../components/help-about/help-about.component';
import { FooterComponent } from '../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../components/switcher/switcher.component';

@Component({
  selector: 'app-helpcenter',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NavbarComponent,
    GetInTouchComponent,
    HelpAboutComponent,
    FooterComponent,
    SwitcherComponent
  ],
  templateUrl: './helpcenter.component.html',
  styleUrl: './helpcenter.component.scss'
})
export class HelpcenterComponent {

}
