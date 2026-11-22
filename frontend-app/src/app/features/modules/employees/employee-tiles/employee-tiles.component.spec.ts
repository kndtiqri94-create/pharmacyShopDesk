import { TestBed } from '@angular/core/testing';
import { EmployeeSummary } from '../../../../core/utils/employee-list-filter.util';
import { EmployeeTilesComponent } from './employee-tiles.component';

const summary: EmployeeSummary = {
  total: 8,
  fullTime: 6,
  partTime: 2,
  onShift: 5,
  late: 0,
  onLeave: 0,
  earliestReturn: null,
  canLogIn: 8,
};

describe('EmployeeTilesComponent', () => {
  it('words the notes for nobody late, nobody away and everyone with access', () => {
    const fixture = TestBed.createComponent(EmployeeTilesComponent);
    fixture.componentRef.setInput('summary', summary);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Nobody late this morning');
    expect(text).toContain('Everyone is in');
    expect(text).toContain('Everyone has system access');
  });
});
