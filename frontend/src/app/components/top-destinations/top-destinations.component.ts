import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { tns } from 'tiny-slider/src/tiny-slider';
import Destination from '../../data/top-destination.json';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-top-destinations',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink
  ],
  templateUrl: './top-destinations.component.html',
  styleUrl: './top-destinations.component.scss'
})
export class TopDestinationsComponent {
  destination = Destination
  ngAfterViewInit(){
    tns(
     { 
        container: '.tiny-five-item',
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
                items: 5
            },

            992: {
                items: 4
            },

            767: {
                items: 3
            },

            425: {
                items: 1
            },
        },
      }
    )
  }

}
