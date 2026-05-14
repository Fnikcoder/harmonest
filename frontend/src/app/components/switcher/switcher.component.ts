import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
import * as feather from 'feather-icons';

@Component({
  selector: 'app-switcher',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink
  ],
  templateUrl: './switcher.component.html',
  styleUrl: './switcher.component.scss'
})
export class SwitcherComponent {
  constructor(private themeService: ThemeService) {}

  changeTheme(event: any): void {
    event.preventDefault();
    this.themeService.toggleDarkMode();
  }

  changeLayout(event: any): void {
    event.preventDefault();
    const switcherRtl = document.getElementById("switchRtl") as any;
    if (switcherRtl.innerText === "LTR") {
      document.documentElement.dir = "ltr";
    } else {
      document.documentElement.dir = "rtl";
    }
  }

  topFunction(): void {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }

  ngAfterViewInit(): void {
    feather.replace();
  }
}
