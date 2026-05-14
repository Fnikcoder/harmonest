import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IdScannerComponent } from './id-scanner.component';

describe('IdScannerComponent', () => {
  let component: IdScannerComponent;
  let fixture: ComponentFixture<IdScannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdScannerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(IdScannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
