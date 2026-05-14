import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TaglineComponent } from '../../../components/tagline/tagline.component';
import { NavbarComponent } from '../../../components/navbar/navbar.component';

import Swiper from 'swiper';
import { register } from 'swiper/element/bundle';
import { FormComponent } from '../../../components/form/form.component';
import { AboutComponent } from '../../../components/about/about.component';

import Package from '../../../data/packages.json'
import { ListDataComponent } from '../../../components/list-data/list-data.component';
import { ClientComponent } from '../../../components/client/client.component';
import { BlogComponent } from '../../../components/blog/blog.component';
import { FooterComponent } from '../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../components/switcher/switcher.component';

@Component({
  selector: 'app-index-two',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink,
    TaglineComponent, 
    NavbarComponent,
    FormComponent, 
    AboutComponent,
    ListDataComponent,
    ClientComponent,
    BlogComponent,
    FooterComponent, 
    SwitcherComponent
  ],
  templateUrl: './index-two.component.html',
  styleUrl: './index-two.component.scss'
})
export class IndexTwoComponent {
  package = Package

  swiper!: Swiper;
  constructor() {
    register()
  }

  ngOnInit() {
    this.swiper = new Swiper('.swiper-container', {
      slidesPerView: 1,
      spaceBetween: 0,
      autoplay:true,
      speed:3000,
      
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
      pagination: {
        el: '.swiper-pagination',
        clickable: true,
      },
    });
  }
}
