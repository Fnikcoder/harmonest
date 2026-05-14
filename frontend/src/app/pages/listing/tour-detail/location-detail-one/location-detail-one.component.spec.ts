import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LocationDetailOneComponent } from './location-detail-one.component';

describe('TourDetailOneComponent', () => {
  let component: LocationDetailOneComponent;
  let fixture: ComponentFixture<LocationDetailOneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LocationDetailOneComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LocationDetailOneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
