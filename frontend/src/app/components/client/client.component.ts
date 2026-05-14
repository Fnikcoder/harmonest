import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { tns } from 'tiny-slider';

@Component({
  selector: 'app-client',
  standalone: true,
  imports: [
    CommonModule
  ],
  templateUrl: './client.component.html',
  styleUrl: './client.component.scss'
})
export class ClientComponent {
  clientData = [
    {
      image: 'assets/images/client/01.jpg',
      name: 'Anna Becker',
      position: 'Frequent Guest',
      desc: `"HarmoNest made my work trip to Berlin so much easier. The apartment was spotless, cozy, and everything worked perfectly."`
    },
    {
      image: 'assets/images/client/02.jpg',
      name: 'Michael Lange',
      position: 'Family Traveler',
      desc: `"We stayed in Stuttgart for a week with our two kids. Having a fully equipped kitchen and great location was a game changer!"`
    },
    {
      image: 'assets/images/client/03.jpg',
      name: 'Sara Mendez',
      position: 'Business Owner',
      desc: `"What I love about HarmoNest is the consistency. Every time I book, I know I’ll get a well-managed and comfortable place."`
    },
    {
      image: 'assets/images/client/04.jpg',
      name: 'David Reimann',
      position: 'Event Organizer',
      desc: `"I hosted a team in Düsseldorf for an expo. HarmoNest helped us find multiple apartments near each other. Super convenient!"`
    },
    {
      image: 'assets/images/client/05.jpg',
      name: 'Lina Koch',
      position: 'Digital Nomad',
      desc: `"Fast Wi-Fi, calm neighborhoods, and stylish interiors — HarmoNest is now my go-to when traveling through Germany."`
    },
    {
      image: 'assets/images/client/06.jpg',
      name: 'Tom Wagner',
      position: 'Weekend Explorer',
      desc: `"The booking process was seamless, and the host was incredibly responsive. Highly recommend for short city trips!"`
    }
  ];

  ngAfterViewInit() {
    tns({
      container: '.tiny-three-item',
      controls: false,
      mouseDrag: true,
      loop: true,
      rewind: true,
      autoplay: true,
      autoplayButtonOutput: false,
      autoplayTimeout: 3000,
      navPosition: 'bottom',
      speed: 400,
      gutter: 12,
      responsive: {
        992: { items: 3 },
        767: { items: 2 },
        320: { items: 1 },
      },
    });
  }
}
