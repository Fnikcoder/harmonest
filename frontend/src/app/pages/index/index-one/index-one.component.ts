import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { FooterComponent } from '../../../components/footer/footer.component';

export interface GuideStep {
  number: string;
  title: string;
  description: string;
  detail: string;
  image: string;
  imageAlt: string;
}

@Component({
  selector: 'app-index-one',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent, FooterComponent],
  templateUrl: './index-one.component.html',
  styleUrl: './index-one.component.scss',
})
export class IndexOneComponent implements AfterViewInit, OnDestroy {
  @ViewChildren('reveal') revealEls!: QueryList<ElementRef<HTMLElement>>;

  readonly heroPhotos = [
    'assets/images/property-showcase/entrance.png',
    'assets/images/property-showcase/living-dining.png',
    'assets/images/property-showcase/master-suite.png',
    'assets/images/property-showcase/spa-bathroom.png',
  ];

  activeHero = 0;
  activeCheckinStep = 0;
  activeDoorStep = 0;

  readonly checkinSteps: GuideStep[] = [
    {
      number: '01',
      title: 'Open Online Check-In',
      description: 'Tap Start Online Check-In from this page or the menu.',
      detail: 'You will be guided through a short, secure flow before arrival.',
      image: 'assets/images/guidelines/checkin-01-open.jpg',
      imageAlt: 'Guest opening the online check-in page on a phone',
    },
    {
      number: '02',
      title: 'Verify your reservation',
      description: 'Enter your reservation code and the name on your booking.',
      detail: 'Use the same name that appears on your confirmation email.',
      image: 'assets/images/guidelines/checkin-02-verify.jpg',
      imageAlt: 'Guest verifying a reservation code on phone and laptop',
    },
    {
      number: '03',
      title: 'Complete guest details',
      description: 'Confirm stay information and finish identity checks if asked.',
      detail: 'Have a passport or national ID ready for verification when required.',
      image: 'assets/images/guidelines/checkin-03-details.jpg',
      imageAlt: 'Passport and ID ready beside a phone verification form',
    },
    {
      number: '04',
      title: 'Receive your digital keys',
      description: 'Get QR and/or PIN access for the doors on your reservation.',
      detail: 'Access is tied to your stay window — no front desk pickup needed.',
      image: 'assets/images/guidelines/checkin-04-keys.jpg',
      imageAlt: 'Smartphone showing digital keys with QR and PIN',
    },
  ];

  readonly doorSteps: GuideStep[] = [
    {
      number: '01',
      title: 'Open your access screen',
      description: 'After check-in, open the door access page for your reservation.',
      detail: 'Your QR code and PIN details appear once access has been generated.',
      image: 'assets/images/guidelines/door-01-access.jpg',
      imageAlt: 'Guest opening the door access screen outside the apartment',
    },
    {
      number: '02',
      title: 'Use QR at the scanner',
      description: 'Raise phone brightness and hold the QR steady at the reader.',
      detail: 'Wait for the unlock confirmation before pulling the handle.',
      image: 'assets/images/guidelines/door-02-qr.jpg',
      imageAlt: 'Phone QR code held up to a door scanner',
    },
    {
      number: '03',
      title: 'Or enter the PIN',
      description: 'For PIN doors, type the code on the keypad and confirm.',
      detail: 'Each PIN is unique to your stay and listed next to the matching door.',
      image: 'assets/images/guidelines/door-03-pin.jpg',
      imageAlt: 'Guest entering a PIN on a digital door keypad',
    },
    {
      number: '04',
      title: 'If it does not open',
      description: 'Wait a few seconds, then try again with a steady scan or fresh PIN entry.',
      detail: 'Still locked out? Contact HarmoNest support and we will help immediately.',
      image: 'assets/images/guidelines/door-04-help.jpg',
      imageAlt: 'Guest calling support for help with door access',
    },
  ];

  private heroTimer?: ReturnType<typeof setInterval>;
  private observers: IntersectionObserver[] = [];

  get currentCheckin(): GuideStep {
    return this.checkinSteps[this.activeCheckinStep];
  }

  get currentDoor(): GuideStep {
    return this.doorSteps[this.activeDoorStep];
  }

  ngAfterViewInit(): void {
    this.heroTimer = setInterval(() => {
      this.activeHero = (this.activeHero + 1) % this.heroPhotos.length;
    }, 4500);

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        }
      },
      { threshold: 0.18 }
    );
    this.revealEls.forEach((el) => io.observe(el.nativeElement));
    this.observers.push(io);
  }

  ngOnDestroy(): void {
    if (this.heroTimer) {
      clearInterval(this.heroTimer);
    }
    this.observers.forEach((o) => o.disconnect());
  }

  setCheckinStep(index: number): void {
    this.activeCheckinStep = index;
  }

  nextCheckinStep(): void {
    this.activeCheckinStep = Math.min(
      this.activeCheckinStep + 1,
      this.checkinSteps.length - 1
    );
  }

  prevCheckinStep(): void {
    this.activeCheckinStep = Math.max(this.activeCheckinStep - 1, 0);
  }

  setDoorStep(index: number): void {
    this.activeDoorStep = index;
  }

  nextDoorStep(): void {
    this.activeDoorStep = Math.min(this.activeDoorStep + 1, this.doorSteps.length - 1);
  }

  prevDoorStep(): void {
    this.activeDoorStep = Math.max(this.activeDoorStep - 1, 0);
  }

  setHero(index: number): void {
    this.activeHero = index;
  }
}
