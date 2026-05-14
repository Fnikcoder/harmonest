import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BackToHomeComponent } from '../../../components/back-to-home/back-to-home.component';
import { SwitcherComponent } from '../../../components/switcher/switcher.component';

@Component({
  selector: 'app-lock-screen',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    BackToHomeComponent,
    SwitcherComponent
  ],
  templateUrl: './lock-screen.component.html',
  styleUrl: './lock-screen.component.scss'
})
export class LockScreenComponent {

}
