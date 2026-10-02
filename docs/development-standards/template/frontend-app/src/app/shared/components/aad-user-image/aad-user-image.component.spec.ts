import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AadUserImageComponent } from './aad-user-image.component';

describe('AadUserImageComponent', () => {
  let component: AadUserImageComponent;
  let fixture: ComponentFixture<AadUserImageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AadUserImageComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AadUserImageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
