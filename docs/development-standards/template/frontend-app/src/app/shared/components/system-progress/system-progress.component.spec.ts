import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SystemProgressComponent } from './system-progress.component';

describe('SpinnerComponent', () => {
  let component: SystemProgressComponent;
  let fixture: ComponentFixture<SystemProgressComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SystemProgressComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SystemProgressComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
