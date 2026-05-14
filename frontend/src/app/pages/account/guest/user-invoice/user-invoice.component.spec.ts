import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserInvoiceComponent } from './user-invoice.component';

describe('UserInvoiceComponent', () => {
  let component: UserInvoiceComponent;
  let fixture: ComponentFixture<UserInvoiceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserInvoiceComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(UserInvoiceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
