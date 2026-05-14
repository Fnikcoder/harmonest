import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-package-sidebar',
  standalone: true,
  imports: [
    CommonModule, 
  ],
  templateUrl: './package-sidebar.component.html',
  styleUrl: './package-sidebar.component.scss'
})
export class PackageSidebarComponent {
  minrange:number = 50
  maxrange:number = 120
  
  minValue(e:any){
    this.minrange = e.target.value;
  }
  
  maxValue(e:any){
    this.maxrange = e.target.value;
  }

  booking = [
    'Bali Park','Paris','Arcadia','Culver City','Long Beach','California',
  ]
}
