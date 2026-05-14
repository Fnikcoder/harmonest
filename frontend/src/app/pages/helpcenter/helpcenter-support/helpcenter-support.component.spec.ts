import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HelpcenterSupportComponent } from './helpcenter-support.component';

describe('HelpcenterSupportComponent', () => {
  let component: HelpcenterSupportComponent;
  let fixture: ComponentFixture<HelpcenterSupportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HelpcenterSupportComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(HelpcenterSupportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
