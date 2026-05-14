import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GridRightSidebarComponent } from './grid-right-sidebar.component';

describe('GridRightSidebarComponent', () => {
  let component: GridRightSidebarComponent;
  let fixture: ComponentFixture<GridRightSidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GridRightSidebarComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(GridRightSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
