import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NavbarComponent } from '../../../../components/navbar/navbar.component';
import { GridDataComponent } from '../../../../components/grid-data/grid-data.component';
import { PackageSidebarComponent } from '../../../../components/package-sidebar/package-sidebar.component';
import { FooterComponent } from '../../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../../components/switcher/switcher.component';

import Package from '../../../../data/packages.json'

@Component({
  selector: 'app-grid-right-sidebar',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink, 
    NavbarComponent, 
    GridDataComponent,
    PackageSidebarComponent, 
    FooterComponent, 
    SwitcherComponent
  ],
  templateUrl: './grid-right-sidebar.component.html',
  styleUrl: './grid-right-sidebar.component.scss'
})
export class GridRightSidebarComponent {
  package = Package
}
