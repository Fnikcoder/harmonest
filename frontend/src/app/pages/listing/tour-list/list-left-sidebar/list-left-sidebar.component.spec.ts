import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListLeftSidebarComponent } from './list-left-sidebar.component';

describe('ListLeftSidebarComponent', () => {
  let component: ListLeftSidebarComponent;
  let fixture: ComponentFixture<ListLeftSidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListLeftSidebarComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ListLeftSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
