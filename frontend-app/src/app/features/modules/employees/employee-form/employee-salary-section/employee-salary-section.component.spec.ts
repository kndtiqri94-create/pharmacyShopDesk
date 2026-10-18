import { TestBed } from '@angular/core/testing';
import { emptyEmployeeDraft } from '../../../../../core/utils/employee-diff.util';
import { EmployeeFormInput } from '../../../../../core/utils/employee-validation.util';
import { EmployeeDraftPatch } from '../employee-section.model';
import { EmployeeSalarySectionComponent } from './employee-salary-section.component';

describe('EmployeeSalarySectionComponent', () => {
  function mount(
    options: {
      readOnly?: boolean;
      errors?: Record<string, string>;
      allowances?: EmployeeFormInput['allowances'];
    } = {}
  ) {
    const fixture = TestBed.createComponent(EmployeeSalarySectionComponent);
    fixture.componentRef.setInput('draft', {
      ...emptyEmployeeDraft('Main Shop'),
      allowances: options.allowances ?? [],
    });
    fixture.componentRef.setInput('errors', options.errors ?? {});
    fixture.componentRef.setInput('readOnly', options.readOnly ?? false);
    const patches: EmployeeDraftPatch[] = [];
    fixture.componentInstance.changed.subscribe(patch => patches.push(patch));
    fixture.detectChanges();
    return { element: fixture.nativeElement as HTMLElement, patches };
  }

  const lines = [
    { id: 'a1', name: 'Transport', amount: '1500.50' },
    { id: 'a2', name: 'Meals', amount: '500' },
  ];

  it('renders all pay fields with Rs. and % affixes', () => {
    const { element } = mount();
    for (const key of [
      'basicSalary',
      'overTimeRate',
      'commissionRate',
      'productDiscountRate',
      'invoiceDiscountRate',
      'monthlyTarget',
    ]) {
      expect(element.querySelector(`#employee-${key}`)).not.toBeNull();
    }
    expect(element.textContent).toContain('Rs.');
    expect(element.textContent).toContain('%');
  });

  it('emits a patch when a pay field changes', () => {
    const { element, patches } = mount();
    const input = element.querySelector<HTMLInputElement>('#employee-basicSalary')!;
    input.value = '45000';
    input.dispatchEvent(new Event('input'));
    expect(patches).toEqual([{ basicSalary: '45000' }]);
  });

  it('shows each allowance line and the total with two decimals', () => {
    const { element } = mount({ allowances: lines });
    expect(element.querySelector('#employee-allowance-0-name')).not.toBeNull();
    expect(element.querySelector('#employee-allowance-1-amount')).not.toBeNull();
    expect(element.querySelector('#employee-allowances-total')?.textContent).toBe('Rs. 2,000.50');
  });

  it('adds a blank line', () => {
    const { element, patches } = mount({ allowances: lines });
    const add = Array.from(element.querySelectorAll('button')).find(b =>
      b.textContent?.includes('Add allowance')
    )!;
    add.click();
    const added = patches[0].allowances!;
    expect(added.length).toBe(3);
    expect(added[2]).toEqual(jasmine.objectContaining({ name: '', amount: '' }));
  });

  it('edits a line without touching the others', () => {
    const { element, patches } = mount({ allowances: lines });
    const input = element.querySelector<HTMLInputElement>('#employee-allowance-1-name')!;
    input.value = 'Lunch';
    input.dispatchEvent(new Event('input'));
    expect(patches[0].allowances).toEqual([lines[0], { ...lines[1], name: 'Lunch' }]);
  });

  it('removes a line', () => {
    const { element, patches } = mount({ allowances: lines });
    element.querySelector<HTMLButtonElement>('button[aria-label="Remove allowance 1"]')!.click();
    expect(patches[0].allowances).toEqual([lines[1]]);
  });

  it('shows line-level errors', () => {
    const { element } = mount({
      allowances: lines,
      errors: { 'allowance-1-amount': 'Enter an allowance amount above zero' },
    });
    expect(element.querySelector('#employee-allowance-1-amount-error')?.textContent).toContain(
      'above zero'
    );
  });

  it('stops adding at 20 lines and says why', () => {
    const many = Array.from({ length: 20 }, (_, index) => ({
      id: `l${index}`,
      name: `A${index}`,
      amount: '1',
    }));
    const { element, patches } = mount({ allowances: many });
    const add = Array.from(element.querySelectorAll('button')).find(b =>
      b.textContent?.includes('Add allowance')
    )!;
    expect(add.disabled).toBeTrue();
    add.click();
    expect(patches).toEqual([]);
    expect(element.querySelector('#employee-allowances-cap')?.textContent).toContain('20');
  });

  it('is read-only with no edit controls for View access', () => {
    const { element, patches } = mount({ readOnly: true, allowances: lines });
    expect(element.querySelector<HTMLInputElement>('#employee-basicSalary')!.readOnly).toBeTrue();
    expect(
      element.querySelector<HTMLInputElement>('#employee-allowance-0-name')!.readOnly
    ).toBeTrue();
    expect(element.textContent).not.toContain('Add allowance');
    expect(element.querySelector('button[aria-label^="Remove allowance"]')).toBeNull();
    const input = element.querySelector<HTMLInputElement>('#employee-basicSalary')!;
    input.dispatchEvent(new Event('input'));
    expect(patches).toEqual([]);
  });
});
