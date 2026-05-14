import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListRightSidebarComponent } from './list-right-sidebar.component';

describe('ListRightSidebarComponent', () => {
  let component: ListRightSidebarComponent;
  let fixture: ComponentFixture<ListRightSidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListRightSidebarComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ListRightSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
