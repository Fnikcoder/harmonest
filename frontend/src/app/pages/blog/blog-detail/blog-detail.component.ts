import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';

import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { FooterComponent } from '../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../components/switcher/switcher.component';
import { BlogComponent } from '../../../components/blog/blog.component';

import BlogData from '../../../data/blog.json'

@Component({
  selector: 'app-blog-detail',
  standalone: true,
  imports: [ 
    CommonModule,
    RouterLink,
    NavbarComponent,
    FooterComponent,
    SwitcherComponent,
    BlogComponent
  ],
  templateUrl: './blog-detail.component.html',
  styleUrl: './blog-detail.component.scss'
})
export class BlogDetailComponent {
  blogData = BlogData
  blogId:any
  data:any

  social = [
    'facebook','instagram','twitter','linkedin','github','youtube','gitlab'
  ]

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.blogId = params.get('id')
      this.data = this.blogData.find((item:any) => item.id === parseInt(this.blogId))
    }
    )
  }
}
