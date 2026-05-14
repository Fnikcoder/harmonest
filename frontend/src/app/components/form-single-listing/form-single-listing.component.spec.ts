import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormSingleListingComponent } from './form-single-listing.component';

describe('FormSingleListingComponent', () => {
  let component: FormSingleListingComponent;
  let fixture: ComponentFixture<FormSingleListingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormSingleListingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FormSingleListingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
