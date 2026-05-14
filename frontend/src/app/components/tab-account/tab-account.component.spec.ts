import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TabAccountComponent } from './tab-account.component';

describe('TabAccountComponent', () => {
  let component: TabAccountComponent;
  let fixture: ComponentFixture<TabAccountComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabAccountComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TabAccountComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
