import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import * as feather from 'feather-icons';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink
  ],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent {
  date :any

  ngOnInit(): void {
    this.date = new Date().getFullYear();
  }

  ngAfterViewInit(): void {
    // Initialize feather icons after view is rendered
    setTimeout(() => {
      feather.replace();
    }, 100);
  }
  // DISABLED: Social media icons
  // social = [
  //   {
  //     icon:'facebook',
  //     link:'https://www.facebook.com/harmonest'
  //   },
  //   {
  //     icon:'instagram',
  //     link:'https://www.instagram.com/harmonest/'
  //   },
  //   {
  //     icon:'twitter',
  //     link:'https://twitter.com/harmonest'
  //   },
  //   {
  //     icon:'linkedin',
  //     link:'http://linkedin.com/company/harmonest'
  //   },
  //   {
  //     icon:'mail',
  //     link:'mailto:support@harmonest.com'
  //   },
  // ]

  company = [
    // DISABLED: Most features removed, keeping only essential ones
    // {
    //   link:'/aboutus',
    //   name:'About Us'
    // },
    // {
    //   link:'/properties',
    //   name:'Browse Properties'
    // },
    // {
    //   link:'/host',
    //   name:'Become a Host'
    // },
    // {
    //   link:'/blog',
    //   name:'Blog'
    // },
    {
      link:'/online-check-in',
      name:'Online Check-In'
    },
    {
      link:'/contact',
      name:'Support'
    },
    {
      link:'/login',
      name:'Sign In'
    },
  ]
}
