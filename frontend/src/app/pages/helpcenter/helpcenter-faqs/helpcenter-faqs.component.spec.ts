import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HelpcenterFaqsComponent } from './helpcenter-faqs.component';

describe('HelpcenterFaqsComponent', () => {
  let component: HelpcenterFaqsComponent;
  let fixture: ComponentFixture<HelpcenterFaqsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HelpcenterFaqsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(HelpcenterFaqsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
