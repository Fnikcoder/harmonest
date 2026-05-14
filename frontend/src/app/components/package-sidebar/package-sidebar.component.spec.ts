import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PackageSidebarComponent } from './package-sidebar.component';

describe('PackageSidebarComponent', () => {
  let component: PackageSidebarComponent;
  let fixture: ComponentFixture<PackageSidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PackageSidebarComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PackageSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
