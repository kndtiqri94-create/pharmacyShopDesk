import { TestBed } from '@angular/core/testing';
import { emptyEmployeeDraft } from '../../../../../core/utils/employee-diff.util';
import { EmployeeDraftPatch } from '../employee-section.model';
import { EmployeeBasicSectionComponent } from './employee-basic-section.component';

describe('EmployeeBasicSectionComponent', () => {
  function mount(errors: Record<string, string> = {}, readOnly = false) {
    const fixture = TestBed.createComponent(EmployeeBasicSectionComponent);
    fixture.componentRef.setInput('draft', emptyEmployeeDraft('Main Shop'));
    fixture.componentRef.setInput('errors', errors);
    fixture.componentRef.setInput('readOnly', readOnly);
    fixture.componentRef.setInput('locations', ['Main Shop']);
    fixture.componentRef.setInput('today', '2026-10-18');
    const patches: EmployeeDraftPatch[] = [];
    fixture.componentInstance.changed.subscribe(patch => patches.push(patch));
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement, patches };
  }

  it('renders every basic field with a label tied to its control', () => {
    const { element } = mount();
    const keys = [
      'title',
      'code',
      'location',
      'firstName',
      'middleName',
      'lastName',
      'email',
      'dateOfBirth',
      'mobile',
    ];
    for (const key of keys) {
      expect(element.querySelector(`label[for="employee-${key}"]`)).not.toBeNull();
      expect(element.querySelector(`#employee-${key}`)).not.toBeNull();
    }
  });

  it('emits a patch when a value changes', () => {
    const { element, patches } = mount();
    const input = element.querySelector<HTMLInputElement>('#employee-code')!;
    input.value = 'EMP-9';
    input.dispatchEvent(new Event('input'));
    expect(patches).toEqual([{ code: 'EMP-9' }]);
  });

  it('shows field errors and the mobile example', () => {
    const { element } = mount({ firstName: 'Enter the first name' });
    expect(element.querySelector('#employee-firstName-error')?.textContent).toContain(
      'Enter the first name'
    );
    expect(element.querySelector('#employee-mobile-hint')?.textContent).toContain('77XXXXXXX');
  });

  it('is read-only when told so', () => {
    const { element } = mount({}, true);
    expect(element.querySelector<HTMLInputElement>('#employee-code')!.readOnly).toBeTrue();
    expect(element.querySelector<HTMLSelectElement>('#employee-title')!.disabled).toBeTrue();
  });
});
