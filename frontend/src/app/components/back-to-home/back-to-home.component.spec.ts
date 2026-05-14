import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BackToHomeComponent } from './back-to-home.component';

describe('BackToHomeComponent', () => {
  let component: BackToHomeComponent;
  let fixture: ComponentFixture<BackToHomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BackToHomeComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(BackToHomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
