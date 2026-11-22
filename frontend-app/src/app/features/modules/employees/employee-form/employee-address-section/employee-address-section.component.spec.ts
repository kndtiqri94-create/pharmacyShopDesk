import { TestBed } from '@angular/core/testing';
import { emptyEmployeeDraft } from '../../../../../core/utils/employee-diff.util';
import { EmployeeDraftPatch } from '../employee-section.model';
import { EmployeeAddressSectionComponent } from './employee-address-section.component';

describe('EmployeeAddressSectionComponent', () => {
  function mount(errors: Record<string, string> = {}, readOnly = false) {
    const fixture = TestBed.createComponent(EmployeeAddressSectionComponent);
    fixture.componentRef.setInput('draft', emptyEmployeeDraft('Main Shop'));
    fixture.componentRef.setInput('errors', errors);
    fixture.componentRef.setInput('readOnly', readOnly);
    const patches: EmployeeDraftPatch[] = [];
    fixture.componentInstance.changed.subscribe(patch => patches.push(patch));
    fixture.detectChanges();
    return { element: fixture.nativeElement as HTMLElement, patches };
  }

  it('renders the seven address fields with labels', () => {
    const { element } = mount();
    for (const key of [
      'addressLine1',
      'addressLine2',
      'city',
      'suburb',
      'state',
      'country',
      'zip',
    ]) {
      expect(element.querySelector(`label[for="employee-${key}"]`)).not.toBeNull();
      expect(element.querySelector(`#employee-${key}`)).not.toBeNull();
    }
  });

  it('emits a keyed patch on input', () => {
    const { element, patches } = mount();
    const input = element.querySelector<HTMLInputElement>('#employee-city')!;
    input.value = 'Colombo';
    input.dispatchEvent(new Event('input'));
    expect(patches).toEqual([{ city: 'Colombo' }]);
  });

  it('shows errors and supports read-only', () => {
    const { element } = mount({ zip: 'The zip code is too long' }, true);
    expect(element.querySelector('#employee-zip-error')?.textContent).toContain('too long');
    expect(element.querySelector<HTMLInputElement>('#employee-zip')!.readOnly).toBeTrue();
  });
});
