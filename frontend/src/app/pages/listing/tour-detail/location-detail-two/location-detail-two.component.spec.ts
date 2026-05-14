import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LocationDetailTwoComponent } from './location-detail-two.component';

describe('TourDetailTwoComponent', () => {
  let component: LocationDetailTwoComponent;
  let fixture: ComponentFixture<LocationDetailTwoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LocationDetailTwoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LocationDetailTwoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
