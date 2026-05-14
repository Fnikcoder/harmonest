import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-list-data',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink
  ],
  templateUrl: './list-data.component.html',
  styleUrl: './list-data.component.scss'
})
export class ListDataComponent {
@Input() packageData: any;
}
