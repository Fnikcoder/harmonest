import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TaglineComponent } from '../../../components/tagline/tagline.component';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { FormComponent } from '../../../components/form/form.component';
import { AboutComponent } from '../../../components/about/about.component';
import { GridDataComponent } from '../../../components/grid-data/grid-data.component';
import { ClientComponent } from '../../../components/client/client.component';
import { ImageSliderComponent } from '../../../components/image-slider/image-slider.component';
import { FooterComponent } from '../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../components/switcher/switcher.component';

import Swiper from 'swiper';
import { register } from 'swiper/element';

import Package from '../../../data/packages.json'
import TopDestination from '../../../data/top-destination.json'

@Component({
  selector: 'app-index-three',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink, 
    TaglineComponent, 
    NavbarComponent,
    FormComponent,
    AboutComponent,
    GridDataComponent,
    ClientComponent,
    ImageSliderComponent,
    FooterComponent,
    SwitcherComponent
  ],
  templateUrl: './index-three.component.html',
  styleUrl: './index-three.component.scss'
})
export class IndexThreeComponent {
  package = Package
  topDestination = TopDestination;

  swiper!: Swiper;
  constructor(){
    register()
  }

  ngOnInit() {
    this.swiper = new Swiper('.swiper-container', {
      slidesPerView: 1,
      spaceBetween: 0,
      autoplay:true,
      speed:3000,
      effect: 'fade',
      fadeEffect: {
        crossFade: true
      },
      
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
