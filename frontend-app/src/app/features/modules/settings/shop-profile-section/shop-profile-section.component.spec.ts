import { TestBed } from '@angular/core/testing';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  SETTINGS_TEXT_MAX_LENGTH,
  SettingsDraft,
  SettingsFieldErrors,
} from '../../../../core/utils/settings-validation.util';
import { ShopProfileSectionComponent } from './shop-profile-section.component';

describe('ShopProfileSectionComponent', () => {
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
  };

  function render(errors: SettingsFieldErrors = {}, disabled = false) {
    const fixture = TestBed.createComponent(ShopProfileSectionComponent);
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

  afterEach(() => TestBed.inject(NotificationService).dismiss());

  it('shows the five details from the draft with their labels and limits', () => {
    const { element, input } = render();
    expect(input('shopName').value).toBe('Sunrise Pharmacy');
    expect(input('registrationNo').value).toBe('REG-1');
    expect(input('address').value).toBe('12 Main Street');
    expect(input('phone').value).toBe('011 234 5678');
    expect(input('email').value).toBe('a@b.lk');
    expect(input('shopName').maxLength).toBe(SETTINGS_TEXT_MAX_LENGTH.shopName);
    expect(element.querySelectorAll('.field__required')).toHaveSize(1);
    expect(element.querySelector('[for="settings-shopName"]')?.textContent).toContain('Shop name');
  });

  it('emits only the edited field', () => {
    const { fixture, input, patches } = render();
    input('phone').value = '077 000 0000';
    input('phone').dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(patches).toEqual([{ phone: '077 000 0000' }]);
  });

  it('shows field errors and disables everything when disabled', () => {
    const { element, input } = render({ shopName: 'Enter the shop name' }, true);
    expect(element.querySelector('#settings-shopName-error')?.textContent).toContain(
      'Enter the shop name'
    );
    expect(input('shopName').disabled).toBeTrue();
    expect(element.querySelector('button')!.disabled).toBeTrue();
  });

  it('answers Upload logo with a sample-only message', () => {
    const { element } = render();
    element.querySelector('button')!.click();
    expect(TestBed.inject(NotificationService).current()?.message).toBe(
      'Upload logo is sample only for now and does nothing yet.'
    );
  });
});
