import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NavbarComponent } from '../../../../components/navbar/navbar.component';
import { ListDataComponent } from '../../../../components/list-data/list-data.component';
import { PackageSidebarComponent } from '../../../../components/package-sidebar/package-sidebar.component';
import { FooterComponent } from '../../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../../components/switcher/switcher.component';

import Package from '../../../../data/packages.json'

@Component({
  selector: 'app-list-right-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NavbarComponent,
    ListDataComponent,
    PackageSidebarComponent,
    FooterComponent,
    SwitcherComponent
  ],
  templateUrl: './list-right-sidebar.component.html',
  styleUrl: './list-right-sidebar.component.scss'
})
export class ListRightSidebarComponent {
  package = Package
}
