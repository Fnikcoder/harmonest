import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BackToHomeComponent } from '../../../components/back-to-home/back-to-home.component';
import { SwitcherComponent } from '../../../components/switcher/switcher.component';

@Component({
  selector: 'app-error',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    BackToHomeComponent,
    SwitcherComponent
  ],
  templateUrl: './error.component.html',
  styleUrl: './error.component.scss'
})
export class ErrorComponent {
  date:any
  ngOnInit(): void {
    this.date = new Date().getFullYear();
  }
}
