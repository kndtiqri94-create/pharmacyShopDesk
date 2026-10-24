import { TestBed } from '@angular/core/testing';
import {
  SettingsDraft,
  SettingsFieldErrors,
} from '../../../../core/utils/settings-validation.util';
import { InventoryAlertsSectionComponent } from './inventory-alerts-section.component';

describe('InventoryAlertsSectionComponent', () => {
  const draft: SettingsDraft = {
    shopName: 'Sunrise Pharmacy',
    registrationNo: 'REG-1',
    address: '12 Main Street',
    phone: '011 234 5678',
    email: 'a@b.lk',
    expiryAlertDays: '90',
    defaultReorderLevel: '10',
    lowFloatRupees: '10000',
    sellEarliestExpiringFirst: true,
    blockExpiredSales: false,
    showLowStockCountInSidebar: true,
    posLineDiscountEnabled: true,
    posBillDiscountEnabled: true,
    posDefaultDiscountPercent: '0',
    posMaxDiscountPercent: '20',
    posHideSidebar: true,
  };

  function render(errors: SettingsFieldErrors = {}, disabled = false) {
    const fixture = TestBed.createComponent(InventoryAlertsSectionComponent);
    fixture.componentRef.setInput('draft', draft);
    fixture.componentRef.setInput('errors', errors);
    fixture.componentRef.setInput('disabled', disabled);
    const patches: Partial<SettingsDraft>[] = [];
    fixture.componentInstance.changed.subscribe(patch => patches.push(patch));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const input = (id: string) => element.querySelector(`#settings-${id}`) as HTMLInputElement;
    return { fixture, element, input, patches };
  }

  it('shows the three numbers and the three stock options from the draft', () => {
    const { element, input } = render();
    expect(input('expiryAlertDays').value).toBe('90');
    expect(input('defaultReorderLevel').value).toBe('10');
    expect(input('lowFloatRupees').value).toBe('10000');
    expect(input('sellEarliestExpiringFirst').checked).toBeTrue();
    expect(input('blockExpiredSales').checked).toBeFalse();
    expect(input('showLowStockCountInSidebar').checked).toBeTrue();
    expect(element.querySelectorAll('.field__required')).toHaveSize(3);
    expect(element.textContent).toContain('Block sales of expired batches');
  });

  it('emits the typed value for a number and the checked state for an option', () => {
    const { fixture, input, patches } = render();
    input('expiryAlertDays').value = '60';
    input('expiryAlertDays').dispatchEvent(new Event('input'));
    input('blockExpiredSales').click();
    fixture.detectChanges();
    expect(patches).toEqual([{ expiryAlertDays: '60' }, { blockExpiredSales: true }]);
  });

  it('shows field errors and disables the inputs and the options when disabled', () => {
    const { element, input } = render({ lowFloatRupees: 'Enter a whole number' }, true);
    expect(element.querySelector('#settings-lowFloatRupees-error')?.textContent).toContain(
      'Enter a whole number'
    );
    expect(input('expiryAlertDays').disabled).toBeTrue();
    expect(element.querySelector('fieldset')!.disabled).toBeTrue();
  });
});
