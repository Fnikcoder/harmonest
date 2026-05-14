import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FaqAccordianComponent } from './faq-accordian.component';

describe('FaqAccordianComponent', () => {
  let component: FaqAccordianComponent;
  let fixture: ComponentFixture<FaqAccordianComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FaqAccordianComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(FaqAccordianComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
