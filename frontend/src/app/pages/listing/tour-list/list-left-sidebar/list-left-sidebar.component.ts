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
  selector: 'app-list-left-sidebar',
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
  templateUrl: './list-left-sidebar.component.html',
  styleUrl: './list-left-sidebar.component.scss'
})
export class ListLeftSidebarComponent {
package = Package
}
