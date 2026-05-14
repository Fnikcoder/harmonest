import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SwitcherComponent } from '../../../components/switcher/switcher.component';
import { BackToHomeComponent } from '../../../components/back-to-home/back-to-home.component';

@Component({
  selector: 'app-comingsoon',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    SwitcherComponent,
    BackToHomeComponent
  ],
  templateUrl: './comingsoon.component.html',
  styleUrl: './comingsoon.component.scss'
})
export class ComingsoonComponent {
 date:any
 ngOnInit(): void {
  this.date = new Date().getFullYear();
 }

 eventCountDown: any = new Date("June 25, 2025 16:37:52").getTime();
 now:any = new Date().getTime();
 timeleft:any = this.eventCountDown - this.now;

 days:number = 0;
 hours:number = 0;
 minutes:number = 0;
 seconds:number = 0;

 ngAfterViewInit() {
   setInterval(() => {
     this.myfunction();
   }, 1000);
 }
 
 myfunction(){
   this.days = Math.floor(this.timeleft / (1000 * 60 * 60 * 24));
   this.hours = Math.floor((this.timeleft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
   this.minutes = Math.floor((this.timeleft % (1000 * 60 * 60)) / (1000 * 60));
   this.seconds = Math.floor((this.timeleft % (1000 * 60)) / 1000);
 }
}
