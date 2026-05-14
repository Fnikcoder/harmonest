import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HelpAboutComponent } from './help-about.component';

describe('HelpAboutComponent', () => {
  let component: HelpAboutComponent;
  let fixture: ComponentFixture<HelpAboutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HelpAboutComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(HelpAboutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
