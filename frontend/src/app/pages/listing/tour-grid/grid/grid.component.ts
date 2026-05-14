import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { NavbarComponent } from '../../../../components/navbar/navbar.component';
import { GridDataComponent } from '../../../../components/grid-data/grid-data.component';
import { FooterComponent } from '../../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../../components/switcher/switcher.component';

import Package from '../../../../data/packages.json'

@Component({
  selector: 'app-grid',
  standalone: true,
  imports: [
    NavbarComponent,
    CommonModule,
    RouterLink,
    GridDataComponent,
    FooterComponent,
    SwitcherComponent
  ],
  templateUrl: './grid.component.html',
  styleUrl: './grid.component.scss'
})
export class GridComponent {
  package = Package
}
