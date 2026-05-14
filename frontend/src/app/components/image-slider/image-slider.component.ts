import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { tns } from 'tiny-slider';
import { LightgalleryModule } from 'lightgallery/angular';

@Component({
  selector: 'app-image-slider',
  standalone: true,
  imports: [
    CommonModule,
    LightgalleryModule
  ],
  templateUrl: './image-slider.component.html',
  styleUrl: './image-slider.component.scss'
})
export class ImageSliderComponent {

  slider!: any;

  ngAfterViewInit(): void {
    this.slider = tns({
      container: '.tiny-twelve-item',
      controls: true,
      mouseDrag: true,
      loop: true,
      rewind: true,
      autoplay: true,
      autoplayButtonOutput: false,
      autoplayTimeout: 3000,
      navPosition: "bottom",
      controlsText: ['<i class="mdi mdi-chevron-left "></i>', '<i class="mdi mdi-chevron-right"></i>'],
      nav: false,
      speed: 400,
      gutter: 0,
      responsive: {
          1025: {
              items: 12
          },

          992: {
              items: 8
          },

          767: {
              items: 6
          },

          575: {
              items: 5
          },

          420: {
              items: 3
          },

          320: {
              items: 2
          },
      },
  });
  }

  image = [
    'assets/images/listing/1.jpg','assets/images/listing/2.jpg','assets/images/listing/3.jpg','assets/images/listing/4.jpg','assets/images/listing/5.jpg','assets/images/listing/6.jpg','assets/images/listing/7.jpg','assets/images/listing/8.jpg','assets/images/listing/9.jpg','assets/images/listing/10.jpg','assets/images/listing/11.jpg','assets/images/listing/12.jpg','assets/images/listing/4.jpg','assets/images/listing/5.jpg','assets/images/listing/6.jpg','assets/images/listing/7.jpg'
  ]

}
