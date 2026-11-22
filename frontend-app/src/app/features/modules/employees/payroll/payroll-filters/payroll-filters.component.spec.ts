import { TestBed } from '@angular/core/testing';
import { PayrollFilters, defaultPayrollFilters } from '../../../../../core/utils/payroll-list.util';
import { PayrollFiltersComponent } from './payroll-filters.component';

const DEFAULTS = defaultPayrollFilters('2026-09-21');

describe('PayrollFiltersComponent', () => {
  function render() {
    const fixture = TestBed.createComponent(PayrollFiltersComponent);
    fixture.componentRef.setInput('defaults', DEFAULTS);
    fixture.componentRef.setInput('locations', ['Colombo', 'Kandy']);
    fixture.componentRef.setInput('years', [2025, 2026, 2027]);
    const emitted: PayrollFilters[] = [];
    fixture.componentInstance.applied.subscribe(value => emitted.push(value));
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement, emitted };
  }

  const control = (element: HTMLElement, id: string) =>
    element.querySelector(`#${id}`) as HTMLInputElement & HTMLSelectElement;
  const button = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll('button')).find(
      item => item.textContent?.trim() === text
    ) as HTMLButtonElement;

  function set(
    fixture: { detectChanges(): void },
    field: HTMLElement,
    value: string,
    event: string
  ) {
    (field as HTMLInputElement).value = value;
    field.dispatchEvent(new Event(event));
    fixture.detectChanges();
  }

  it('starts on the current month with every labelled control and one primary Filter', () => {
    const { element } = render();
    expect(control(element, 'payroll-filter-keyword').value).toBe('');
    expect(control(element, 'payroll-filter-year').value).toBe('2026');
    expect(control(element, 'payroll-filter-month').value).toBe('9');
    for (const label of ['Keyword', 'Location', 'Year', 'Month']) {
      expect(element.textContent).toContain(label);
    }
    expect(button(element, 'Filter').getAttribute('data-variant')).toBe('primary');
    expect(element.querySelectorAll('button[data-variant="primary"]')).toHaveSize(1);
  });

  it('emits nothing until Filter is chosen, then emits the chosen values', () => {
    const { fixture, element, emitted } = render();
    set(fixture, control(element, 'payroll-filter-keyword'), 'nimal', 'input');
    set(fixture, control(element, 'payroll-filter-location'), 'Kandy', 'change');
    set(fixture, control(element, 'payroll-filter-year'), '2025', 'change');
    set(fixture, control(element, 'payroll-filter-month'), '3', 'change');
    expect(emitted).toEqual([]);
    button(element, 'Filter').click();
    expect(emitted).toEqual([{ keyword: 'nimal', location: 'Kandy', year: 2025, month: 3 }]);
  });

  it('ignores a tampered location, year or month and caps the keyword', () => {
    const { fixture, element, emitted } = render();
    const keyword = control(element, 'payroll-filter-keyword');
    set(fixture, keyword, 'x'.repeat(500), 'input');
    const location = control(element, 'payroll-filter-location');
    const bad = document.createElement('option');
    bad.value = 'Elsewhere';
    location.appendChild(bad);
    set(fixture, location, 'Elsewhere', 'change');
    const year = control(element, 'payroll-filter-year');
    const badYear = document.createElement('option');
    badYear.value = '1900';
    year.appendChild(badYear);
    set(fixture, year, '1900', 'change');
    const month = control(element, 'payroll-filter-month');
    const badMonth = document.createElement('option');
    badMonth.value = '13';
    month.appendChild(badMonth);
    set(fixture, month, '13', 'change');
    button(element, 'Filter').click();
    expect(emitted[0].keyword.length).toBeLessThanOrEqual(100);
    expect(emitted[0].location).toBe('');
    expect(emitted[0].year).toBe(2026);
    expect(emitted[0].month).toBe(9);
  });

  it('Reset clears the draft, returns to the current month and emits the defaults', () => {
    const { fixture, element, emitted } = render();
    set(fixture, control(element, 'payroll-filter-keyword'), 'nimal', 'input');
    set(fixture, control(element, 'payroll-filter-month'), '2', 'change');
    button(element, 'Reset').click();
    fixture.detectChanges();
    expect(emitted).toEqual([DEFAULTS]);
    expect(control(element, 'payroll-filter-keyword').value).toBe('');
    expect(control(element, 'payroll-filter-month').value).toBe('9');
  });
});
