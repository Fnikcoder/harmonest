import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GridLeftSidebarComponent } from './grid-left-sidebar.component';

describe('GridLeftSidebarComponent', () => {
  let component: GridLeftSidebarComponent;
  let fixture: ComponentFixture<GridLeftSidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GridLeftSidebarComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(GridLeftSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
