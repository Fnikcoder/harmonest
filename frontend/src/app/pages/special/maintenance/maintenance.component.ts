import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { SwitcherComponent } from '../../../components/switcher/switcher.component';
import { BackToHomeComponent } from '../../../components/back-to-home/back-to-home.component';

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [
    CommonModule,
    SwitcherComponent,
    BackToHomeComponent
  ],
  templateUrl: './maintenance.component.html',
  styleUrl: './maintenance.component.scss'
})
export class MaintenanceComponent {
  minutes:number = 0;
  remainingSeconds:number = 0;
  seconds:number=3599;
  intervalId:any = 0

  ngAfterViewInit() {
    
    this.intervalId = setInterval(() => {
                this.calculateTimeRemaining()
            }, 1000);
  }
      calculateTimeRemaining() {
          this.minutes = Math.round((this.seconds - 30) / 60);
          console.log(this.minutes);
          
          this.remainingSeconds = this.seconds % 60;
          if (this.seconds === 0) {
              clearInterval(this.intervalId);
          } else {
              this.seconds = this.seconds - 1;
          }
      }
}
