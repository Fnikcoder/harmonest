import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { NavbarComponent } from '../../components/navbar/navbar.component';
import { ClientComponent } from '../../components/client/client.component';
import { BlogComponent } from '../../components/blog/blog.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { SwitcherComponent } from '../../components/switcher/switcher.component';
import {CountUpModule} from 'ngx-countup';

@Component({
  selector: 'app-aboutus',
  standalone: true,
  imports: [
    NavbarComponent,
    CommonModule,
    RouterLink,
    ClientComponent,
    BlogComponent,
    FooterComponent,
    SwitcherComponent,
    CountUpModule
  ],
  templateUrl: './aboutus.component.html',
  styleUrl: './aboutus.component.scss'
})
export class AboutusComponent {
    teamData = [
      {
        image:'assets/images/client/04.jpg',
        name:'Jack John',
        possition:'Jack John'
      },
      {
        image:'assets/images/client/05.jpg',
        name:'Krista John',
        possition:'Jack John'
      },
      {
        image:'assets/images/client/06.jpg',
        name:'Roger Jackson',
        possition:'Jack John'
      },
      {
        image:'assets/images/client/07.jpg',
        name:'Johnny English',
        possition:'Jack John'
      }
    ]
}
