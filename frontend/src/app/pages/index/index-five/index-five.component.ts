import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { FormComponent } from '../../../components/form/form.component';
import { TopDestinationsComponent } from '../../../components/top-destinations/top-destinations.component';
import { AboutComponent } from '../../../components/about/about.component';
import { ListDataComponent } from '../../../components/list-data/list-data.component';
import { ClientComponent } from '../../../components/client/client.component';
import { BlogComponent } from '../../../components/blog/blog.component';
import { FooterComponent } from '../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../components/switcher/switcher.component';

import Package from '../../../data/packages.json'

@Component({
  selector: 'app-index-five',
  standalone: true,
  imports: [
     CommonModule,
     RouterLink,
     NavbarComponent,
     FormComponent,
     TopDestinationsComponent,
     AboutComponent,
     ListDataComponent,
     ClientComponent,
     BlogComponent,
     FooterComponent, 
     SwitcherComponent],
  templateUrl: './index-five.component.html',
  styleUrl: './index-five.component.scss'
})
export class IndexFiveComponent {
  package = Package
}
