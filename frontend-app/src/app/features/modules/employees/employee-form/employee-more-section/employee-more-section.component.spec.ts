import { TestBed } from '@angular/core/testing';
import { EmployeeStatus } from '../../../../../core/models/enums/employee-status.enum';
import { emptyEmployeeDraft } from '../../../../../core/utils/employee-diff.util';
import { EmployeeDraftPatch } from '../employee-section.model';
import { EmployeeMoreSectionComponent } from './employee-more-section.component';

describe('EmployeeMoreSectionComponent', () => {
  function mount(options: { linked?: boolean; readOnly?: boolean; status?: string } = {}) {
    const fixture = TestBed.createComponent(EmployeeMoreSectionComponent);
    fixture.componentRef.setInput('draft', {
      ...emptyEmployeeDraft('Main Shop'),
      status: options.status ?? EmployeeStatus.ACTIVE,
    });
    fixture.componentRef.setInput('errors', { customField2: 'Too long' });
    fixture.componentRef.setInput('readOnly', options.readOnly ?? false);
    fixture.componentRef.setInput('linkedUser', options.linked ?? false);
    const patches: EmployeeDraftPatch[] = [];
    fixture.componentInstance.changed.subscribe(patch => patches.push(patch));
    fixture.detectChanges();
    return { element: fixture.nativeElement as HTMLElement, patches };
  }

  it('shows four custom fields with helper notes', () => {
    const { element } = mount();
    expect(element.querySelector('#employee-customField1-hint')?.textContent).toContain('Optional');
    expect(element.querySelector('#employee-customField4')).not.toBeNull();
    expect(element.querySelector('#employee-customField2-error')?.textContent).toContain(
      'Too long'
    );
  });

  it('offers only Active and Inactive status, and Monthly or Daily salary type', () => {
    const { element } = mount();
    const options = (id: string) =>
      Array.from(element.querySelectorAll(`#${id} option`)).map(option =>
        option.textContent?.trim()
      );
    expect(options('employee-status')).toEqual(['Active', 'Inactive']);
    expect(options('employee-salaryType')).toEqual(['Monthly', 'Daily']);
  });

  it('keeps an existing on leave status selectable so it is not changed silently', () => {
    const { element } = mount({ status: EmployeeStatus.ON_LEAVE });
    expect(element.querySelector('#employee-status')?.textContent).toContain('On leave');
  });

  it('emits toggle changes', () => {
    const { element, patches } = mount();
    const epf = Array.from(element.querySelectorAll<HTMLButtonElement>('[role="switch"]')).find(
      toggle => toggle.textContent?.includes('Calculate EPF')
    )!;
    epf.click();
    expect(patches).toEqual([{ calculateEpf: true }]);
  });

  it('shows already linked and no Create user account toggle for a linked employee', () => {
    const { element } = mount({ linked: true });
    expect(element.textContent).toContain('Already linked to a user account');
    const toggles = Array.from(element.querySelectorAll('[role="switch"]')).map(
      toggle => toggle.textContent
    );
    expect(toggles.some(text => text?.includes('Create user account'))).toBeFalse();
  });

  it('disables toggles and selects when read-only', () => {
    const { element } = mount({ readOnly: true });
    expect(
      Array.from(element.querySelectorAll<HTMLButtonElement>('[role="switch"]')).every(
        toggle => toggle.disabled
      )
    ).toBeTrue();
    expect(element.querySelector<HTMLSelectElement>('#employee-status')!.disabled).toBeTrue();
  });
});
