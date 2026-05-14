import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TabManagementComponent } from './tab-management.component';

describe('TabManagementComponent', () => {
  let component: TabManagementComponent;
  let fixture: ComponentFixture<TabManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabManagementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TabManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
