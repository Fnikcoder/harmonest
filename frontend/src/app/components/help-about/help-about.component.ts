import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-help-about',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink
  ],
  templateUrl: './help-about.component.html',
  styleUrl: './help-about.component.scss'
})
export class HelpAboutComponent {
  aboutData = [ 
    {
      icon:'help-circle',
      title:'FAQs',
      desc:'The phrasal sequence of the is now so that many campaign and benefit',
      link:'/helpcenter-faqs'
    },
    {
      icon:'bookmark',
      title:'Guides / Support',
      desc:'The phrasal sequence of the is now so that many campaign and benefit',
      link:'/helpcenter-guides'
    },
    {
      icon:'settings',
      title:'Support Request',
      desc:'The phrasal sequence of the is now so that many campaign and benefit',
      link:'/helpcenter-support'
    }
  ]
}
