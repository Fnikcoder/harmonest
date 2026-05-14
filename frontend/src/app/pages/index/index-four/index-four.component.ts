import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import {DatePipe} from '@angular/common';
import feather from 'feather-icons';

import { TaglineComponent } from '../../../components/tagline/tagline.component';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { GridDataComponent } from '../../../components/grid-data/grid-data.component';
import { ClientComponent } from '../../../components/client/client.component';
import { FooterComponent } from '../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../components/switcher/switcher.component';

import { tns } from 'tiny-slider';

import TopDestination from '../../../data/top-destination.json'
import Pagkage from '../../../data/packages.json'
import FaqData from '../../../data/faq.json'
import {MatDateRangeInput, MatDateRangePicker, MatEndDate, MatStartDate} from '@angular/material/datepicker';


@Component({
  selector: 'app-index-four',
  standalone: true,
  imports: [
    CommonModule,
    TaglineComponent,
    NavbarComponent,
    RouterLink,
    GridDataComponent,
    ClientComponent,
    FooterComponent,
    SwitcherComponent,
    FormsModule,
    MatDateRangeInput,
    MatDateRangePicker,
    MatEndDate,
    MatStartDate,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    DatePipe
  ],
  templateUrl: './index-four.component.html',
  styleUrl: './index-four.component.scss'
})
export class IndexFourComponent {
  form: FormGroup;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      dateRange: this.fb.group({
        start: [null],
        end: [null]
      })
    });
  }

  topDestination  = TopDestination;
  package = Pagkage
  faqData = FaqData

  slider:any

  ngAfterViewInit(): void {
      this.slider = tns({
        container: '.tiny-six-item',
        controls: true,
        mouseDrag: true,
        loop: true,
        rewind: true,
        autoplay: true,
        autoplayButtonOutput: false,
        autoplayTimeout: 3000,
        navPosition: "bottom",
        controlsText: ['<i class="mdi mdi-chevron-left "></i>', '<i class="mdi mdi-chevron-right"></i>'],
        nav: false,
        speed: 400,
        gutter: 0,
        responsive: {
            1025: {
                items: 6
            },

            992: {
                items: 4
            },

            767: {
                items: 3
            },

            425: {
                items: 1
            },
        },
    });
    feather.replace();
  }

  activeTab:number = 1

  onTabClick(index:number){
    this.activeTab = index;
  }
  get dateRangeGroup(): FormGroup {
    return this.form.get('dateRange') as FormGroup;
  }


}
