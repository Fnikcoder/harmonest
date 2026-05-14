import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NavbarComponent } from '../../../../components/navbar/navbar.component';
import { ListDataComponent } from '../../../../components/list-data/list-data.component';
import { FooterComponent } from '../../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../../components/switcher/switcher.component';

import Package from '../../../../data/packages.json'

@Component({
  selector: 'app-list',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink, 
    NavbarComponent,
    ListDataComponent, 
    FooterComponent, 
    SwitcherComponent
  ],
  templateUrl: './list.component.html',
  styleUrl: './list.component.scss'
})
export class ListComponent {
 package = Package
}
