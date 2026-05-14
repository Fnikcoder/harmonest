import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BlogStandardComponent } from './blog-standard.component';

describe('BlogStandardComponent', () => {
  let component: BlogStandardComponent;
  let fixture: ComponentFixture<BlogStandardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlogStandardComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(BlogStandardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
