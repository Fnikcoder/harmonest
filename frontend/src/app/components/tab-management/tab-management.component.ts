import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, Router } from '@angular/router';

@Component({
  selector: 'app-tab-management',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink
  ],
  templateUrl: './tab-management.component.html',
  styleUrl: './tab-management.component.scss'
})
export class TabManagementComponent {
  constructor(private router: Router){}
  current:string = ''

  ngOnInit(): void {
    this.current = this.router.url

  }
}
