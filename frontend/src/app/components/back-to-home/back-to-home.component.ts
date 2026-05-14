import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-back-to-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink
  ],
  templateUrl: './back-to-home.component.html',
  styleUrl: './back-to-home.component.scss'
})
export class BackToHomeComponent {

}
