import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import * as feather from 'feather-icons';

@Component({
  selector: 'app-tagline',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink
  ],
  templateUrl: './tagline.component.html',
  styleUrl: './tagline.component.scss'
})
export class TaglineComponent {

  ngAfterViewInit() {
    feather.replace();
  }

  ngAfterViewChecked() {
    feather.replace();
  }
}
