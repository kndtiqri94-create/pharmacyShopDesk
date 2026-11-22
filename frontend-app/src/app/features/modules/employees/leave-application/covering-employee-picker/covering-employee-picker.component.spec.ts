import { TestBed } from '@angular/core/testing';
import { Employee } from '../../../../../core/models/domain/employee.model';
import { EmployeeStatus } from '../../../../../core/models/enums/employee-status.enum';
import { CoveringEmployeePickerComponent } from './covering-employee-picker.component';

describe('CoveringEmployeePickerComponent', () => {
  const employee = (
    id: string,
    code: string,
    name: string,
    status: EmployeeStatus = EmployeeStatus.ACTIVE
  ) => ({ id, code, name, status }) as Employee;
  const employees = [
    employee('e1', 'EMP-001', 'Nimal Perera'),
    employee('e2', 'EMP-002', 'Kamala Silva'),
    employee('e3', 'EMP-003', 'Saman Silva'),
    employee('e4', 'EMP-004', 'Old Hand', EmployeeStatus.INACTIVE),
  ];

  function mount(value = '') {
    const fixture = TestBed.createComponent(CoveringEmployeePickerComponent);
    fixture.componentRef.setInput('employees', employees);
    fixture.componentRef.setInput('applicantId', 'e1');
    fixture.componentRef.setInput('value', value);
    const emitted: string[] = [];
    fixture.componentInstance.changed.subscribe(id => emitted.push(id));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const select = () => element.querySelector('select') as HTMLSelectElement;
    const labels = () => Array.from(select().options).map(option => option.textContent?.trim());
    const search = (text: string) => {
      const input = element.querySelector<HTMLInputElement>('input[type="search"]')!;
      input.value = text;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const openSearch = () => {
      element.querySelector<HTMLButtonElement>('button')!.click();
      fixture.detectChanges();
    };
    return { fixture, element, emitted, select, labels, search, openSearch };
  }

  it('lists active employees except the applicant', () => {
    const { labels } = mount();
    expect(labels()).toEqual([
      'No covering employee',
      'EMP-002 - Kamala Silva',
      'EMP-003 - Saman Silva',
    ]);
  });

  it('has a labelled select and a collapsed search button', () => {
    const { element } = mount();
    expect(element.querySelector('label[for="leave-coveringEmployeeId"]')).not.toBeNull();
    const button = element.querySelector('button')!;
    expect(button.textContent).toContain('Search employees');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(element.querySelector('input[type="search"]')).toBeNull();
  });

  it('filters by code or by name', () => {
    const { labels, search, openSearch } = mount();
    openSearch();
    search('emp-003');
    expect(labels()).toEqual(['No covering employee', 'EMP-003 - Saman Silva']);
    search('SILVA');
    expect(labels()).toHaveSize(3);
  });

  it('says so when nobody matches', () => {
    const { element, search, openSearch } = mount();
    openSearch();
    search('zzz');
    expect(element.querySelector('[role="status"]')?.textContent).toContain('No active employee');
  });

  it('keeps the chosen employee listed while the search hides them', () => {
    const { labels, search, openSearch } = mount('e2');
    openSearch();
    search('saman');
    expect(labels()).toContain('EMP-002 - Kamala Silva');
  });

  it('emits the chosen id', () => {
    const { select, emitted, fixture } = mount();
    select().value = 'e3';
    select().dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(emitted).toEqual(['e3']);
  });
});
