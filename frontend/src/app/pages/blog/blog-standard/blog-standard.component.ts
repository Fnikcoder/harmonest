import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { FooterComponent } from '../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../components/switcher/switcher.component';

import BlogData from "../../../data/blog.json"

@Component({
  selector: 'app-blog-standard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NavbarComponent,
    FooterComponent,
    SwitcherComponent
  ],
  templateUrl: './blog-standard.component.html',
  styleUrl: './blog-standard.component.scss'
})
export class BlogStandardComponent {
  blogData = BlogData

  social = [
    'facebook','instagram','twitter','linkedin','github','youtube','gitlab'
  ]
}
