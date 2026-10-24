import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../../testing/auth-test.util';
import { UserRole } from '../../../core/models/enums/user-role.enum';
import { SettingsDataService } from '../../../core/services/data/settings-data.service';
import { SyncDataService } from '../../../core/services/data/sync-data.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
    clearBrowserStorage();
    TestBed.inject(NotificationService).dismiss();
  });

  interface Detectable {
    detectChanges(): void;
  }

  async function settle(fixture: Detectable): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 30));
    fixture.detectChanges();
  }

  async function render(role: UserRole = UserRole.ADMIN) {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    await signInAs(role);
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    await settle(fixture);
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  const buttonByText = (scope: ParentNode, label: string) =>
    Array.from(scope.querySelectorAll('button')).find(
      item => item.textContent?.trim() === label
    ) as HTMLButtonElement | undefined;
  const text = (scope: ParentNode, selector: string) =>
    scope.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const notification = () => TestBed.inject(NotificationService).current();
  const saved = () => firstValueFrom(TestBed.inject(SettingsDataService).get());
  const field = <T extends HTMLElement>(element: HTMLElement, key: string) =>
    element.querySelector(`#settings-${key}`) as T;

  function type(fixture: Detectable, input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function openGroup(fixture: Detectable, element: HTMLElement, label: string) {
    buttonByText(element.querySelector('app-settings-group-list')!, label)!.click();
    fixture.detectChanges();
  }

  const saveButton = (element: HTMLElement) => buttonByText(element, 'Save changes')!;
  const discardButton = (element: HTMLElement) => buttonByText(element, 'Discard')!;

  async function pressSave(fixture: Detectable, element: HTMLElement) {
    saveButton(element).click();
    fixture.detectChanges();
    await settle(fixture);
  }

  describe('page and groups', () => {
    it('shows the heading, the subtitle, Discard and one primary Save changes', async () => {
      const { element } = await render();
      expect(text(element, 'h1')).toBe('Settings');
      expect(text(element, 'app-page-header')).toContain(
        'One shop, one place to change how it runs.'
      );
      expect(discardButton(element)).toBeDefined();
      expect(saveButton(element).getAttribute('data-variant')).toBe('primary');
      expect(discardButton(element).getAttribute('data-variant')).not.toBe('primary');
    });

    it('lists the five groups with the current one marked and switches the right card', async () => {
      const { fixture, element } = await render();
      const list = element.querySelector('app-settings-group-list')!;
      expect(
        Array.from(list.querySelectorAll('button')).map(item => item.textContent?.trim())
      ).toEqual([
        'Shop profile',
        'Currency & region',
        'Inventory alerts',
        'Point of sale',
        'Backup & sync',
      ]);
      expect(list.querySelector('[aria-current=true]')?.textContent?.trim()).toBe('Shop profile');
      expect(text(element, 'app-card h2')).toBe('Shop profile');
      for (const label of [
        'Currency & region',
        'Inventory alerts',
        'Point of sale',
        'Backup & sync',
      ]) {
        openGroup(fixture, element, label);
        expect(text(element, 'app-card h2')).toBe(label);
        expect(list.querySelector('[aria-current=true]')?.textContent?.trim()).toBe(label);
      }
    });

    it('shows the Shop profile fields and the sample-only Upload logo', async () => {
      const { fixture, element } = await render();
      const section = element.querySelector('app-shop-profile-section')!;
      const labels = Array.from(section.querySelectorAll('label')).map(label =>
        label.textContent?.replace(/\s+/g, ' ').trim()
      );
      expect(labels).toEqual(['Shop name *', 'Registration no', 'Address', 'Phone', 'Email']);
      expect(field<HTMLInputElement>(element, 'shopName').value).toBe('ShopDesk');
      expect(section.textContent).toContain('Shop logo');
      expect(section.textContent).toContain(
        'PNG or JPG, at least 200 px. Shown on printed documents.'
      );
      buttonByText(section, 'Upload logo')!.click();
      fixture.detectChanges();
      expect(notification()?.message).toBe(
        'Upload logo is sample only for now and does nothing yet.'
      );
      expect(saveButton(element).disabled).toBeTrue();
    });

    it('shows Currency & region as fixed values', async () => {
      const { fixture, element } = await render();
      openGroup(fixture, element, 'Currency & region');
      const values = Array.from(
        element.querySelectorAll<HTMLInputElement>('app-currency-region-section input')
      );
      expect(values.map(item => item.value)).toEqual([
        'Lankan rupee (LKR)',
        '21 Sep 2026',
        'Asia/Colombo',
      ]);
      expect(values.every(item => item.readOnly)).toBeTrue();
    });

    it('shows Inventory alerts with the defaults and the saved options', async () => {
      const { fixture, element } = await render();
      openGroup(fixture, element, 'Inventory alerts');
      expect(field<HTMLInputElement>(element, 'expiryAlertDays').value).toBe('60');
      expect(field<HTMLInputElement>(element, 'defaultReorderLevel').value).toBe('20');
      expect(field<HTMLInputElement>(element, 'lowFloatRupees').value).toBe('10000');
      const section = element.querySelector('app-inventory-alerts-section')!;
      expect(text(section, '[for=settings-expiryAlertDays]')).toContain('Warn about expiry');
      expect(text(section, '[for=settings-lowFloatRupees]')).toContain(
        'Warn when reload float is below (Rs.)'
      );
      const options = Array.from(
        section.querySelectorAll<HTMLInputElement>('input[type=checkbox]')
      );
      expect(options.map(option => option.parentElement?.textContent?.trim())).toEqual([
        'Sell the earliest-expiring batch first (FEFO)',
        'Block sales of expired batches',
        'Show low-stock count in the sidebar',
      ]);
      expect(options.every(option => option.checked)).toBeTrue();
    });

    it('shows Point of sale with the fresh-session values', async () => {
      const { fixture, element } = await render();
      openGroup(fixture, element, 'Point of sale');
      expect(field<HTMLInputElement>(element, 'posLineDiscountEnabled').checked).toBeTrue();
      expect(field<HTMLInputElement>(element, 'posBillDiscountEnabled').checked).toBeTrue();
      expect(field<HTMLInputElement>(element, 'posDefaultDiscountPercent').value).toBe('0');
      expect(field<HTMLInputElement>(element, 'posMaxDiscountPercent').value).toBe('20');
      expect(field<HTMLInputElement>(element, 'posHideSidebar').checked).toBeTrue();
      expect(text(element, 'app-point-of-sale-section')).toContain('Hide sidebar when POS opens');
    });

    it('shows Point of sale read-only for a role that cannot change settings', async () => {
      const { fixture, element } = await render(UserRole.MANAGER);
      openGroup(fixture, element, 'Point of sale');
      expect(field<HTMLInputElement>(element, 'posMaxDiscountPercent').disabled).toBeTrue();
      expect(
        field<HTMLInputElement>(element, 'posHideSidebar').closest('fieldset')?.disabled
      ).toBeTrue();
      expect(buttonByText(element, 'Save changes')).toBeUndefined();
    });

    it('shows Backup & sync with the notice, the instant option and sample-only buttons', async () => {
      const { fixture, element } = await render();
      openGroup(fixture, element, 'Backup & sync');
      const section = element.querySelector('app-backup-sync-section')!;
      expect(section.textContent).toContain(
        'Everything is backed up. Last sync today 09:12 · next automatic sync in 5 minutes.'
      );
      expect(section.querySelector('[role=switch]')?.getAttribute('aria-checked')).toBe('true');
      expect(section.textContent).toContain('Sync automatically when online');
      buttonByText(section, 'Back up now')!.click();
      expect(notification()?.message).toBe(
        'Back up now is sample only for now and does nothing yet.'
      );
      buttonByText(section, 'Sync now')!.click();
      expect(notification()?.message).toBe('Sync now is sample only for now and does nothing yet.');
      expect(saveButton(element).disabled).toBeTrue();
    });
  });

  describe('Point of sale changes', () => {
    it('refuses a default above the maximum and saves nothing', async () => {
      const { fixture, element } = await render();
      openGroup(fixture, element, 'Point of sale');
      type(fixture, field(element, 'posDefaultDiscountPercent'), '30');
      await pressSave(fixture, element);
      expect(
        element.querySelector('#settings-posDefaultDiscountPercent-error')?.textContent
      ).toContain('cannot be more than the maximum');
      expect((await saved()).posDefaultDiscountPercent).toBe(0);
      expect(notification()).toBeNull();
    });

    it('refuses negative, above 100 and non-numeric percentages', async () => {
      const { fixture, element } = await render();
      openGroup(fixture, element, 'Point of sale');
      for (const bad of ['-1', '101', 'abc', '1.234']) {
        type(fixture, field(element, 'posMaxDiscountPercent'), bad);
        await pressSave(fixture, element);
        expect(element.querySelector('#settings-posMaxDiscountPercent-error')?.textContent)
          .withContext(bad)
          .toContain('0 to 100');
        expect((await saved()).posMaxDiscountPercent).toBe(20);
      }
    });

    it('saves valid values and confirms', async () => {
      const { fixture, element } = await render();
      openGroup(fixture, element, 'Point of sale');
      type(fixture, field(element, 'posMaxDiscountPercent'), '15');
      type(fixture, field(element, 'posDefaultDiscountPercent'), '5');
      field<HTMLInputElement>(element, 'posLineDiscountEnabled').click();
      field<HTMLInputElement>(element, 'posHideSidebar').click();
      fixture.detectChanges();
      await pressSave(fixture, element);
      expect(notification()?.tone).toBe('success');
      const now = await saved();
      expect(now.posMaxDiscountPercent).toBe(15);
      expect(now.posDefaultDiscountPercent).toBe(5);
      expect(now.posLineDiscountEnabled).toBeFalse();
      expect(now.posBillDiscountEnabled).toBeTrue();
      expect(now.posHideSidebar).toBeFalse();
    });

    it('returns the previous saved values on Discard', async () => {
      const { fixture, element } = await render();
      openGroup(fixture, element, 'Point of sale');
      type(fixture, field(element, 'posMaxDiscountPercent'), '15');
      field<HTMLInputElement>(element, 'posBillDiscountEnabled').click();
      fixture.detectChanges();
      discardButton(element).click();
      fixture.detectChanges();
      expect(field<HTMLInputElement>(element, 'posMaxDiscountPercent').value).toBe('20');
      expect(field<HTMLInputElement>(element, 'posBillDiscountEnabled').checked).toBeTrue();
      expect((await saved()).posMaxDiscountPercent).toBe(20);
    });
  });

  describe('Save changes and Discard', () => {
    it('keeps both unavailable until something changes, and available after a change', async () => {
      const { fixture, element } = await render();
      expect(saveButton(element).disabled).toBeTrue();
      expect(discardButton(element).disabled).toBeTrue();
      type(fixture, field(element, 'shopName'), 'Corner Pharmacy');
      expect(saveButton(element).disabled).toBeFalse();
      expect(discardButton(element).disabled).toBeFalse();
      type(fixture, field(element, 'shopName'), 'ShopDesk');
      expect(saveButton(element).disabled).toBeTrue();
    });

    it('saves valid changes, confirms, and makes both unavailable again', async () => {
      const { fixture, element } = await render();
      type(fixture, field(element, 'shopName'), 'Corner Pharmacy');
      openGroup(fixture, element, 'Inventory alerts');
      type(fixture, field(element, 'expiryAlertDays'), '30');
      type(fixture, field(element, 'lowFloatRupees'), '12500');
      await pressSave(fixture, element);
      expect(notification()?.tone).toBe('success');
      expect(notification()?.message).toContain('Settings saved');
      const now = await saved();
      expect(now.shopName).toBe('Corner Pharmacy');
      expect(now.expiryAlertDays).toBe(30);
      expect(now.lowFloatCents).toBe(1_250_000);
      expect(saveButton(element).disabled).toBeTrue();
      expect(discardButton(element).disabled).toBeTrue();
    });

    it('keeps edits across group switches and saves them all with one Save', async () => {
      const { fixture, element } = await render();
      type(fixture, field(element, 'phone'), '011 999 0000');
      openGroup(fixture, element, 'Inventory alerts');
      type(fixture, field(element, 'defaultReorderLevel'), '15');
      openGroup(fixture, element, 'Currency & region');
      openGroup(fixture, element, 'Shop profile');
      expect(field<HTMLInputElement>(element, 'phone').value).toBe('011 999 0000');
      openGroup(fixture, element, 'Inventory alerts');
      expect(field<HTMLInputElement>(element, 'defaultReorderLevel').value).toBe('15');
      await pressSave(fixture, element);
      const now = await saved();
      expect(now.phone).toBe('011 999 0000');
      expect(now.defaultReorderLevel).toBe(15);
    });

    it('saves nothing and shows red-border errors when a value is wrong, focusing the first problem', async () => {
      const { fixture, element } = await render();
      const before = await saved();
      type(fixture, field(element, 'shopName'), '');
      type(fixture, field(element, 'email'), 'not-an-email');
      openGroup(fixture, element, 'Inventory alerts');
      type(fixture, field(element, 'expiryAlertDays'), '400');
      type(fixture, field(element, 'defaultReorderLevel'), '0');
      type(fixture, field(element, 'lowFloatRupees'), '-5');
      openGroup(fixture, element, 'Backup & sync');
      await pressSave(fixture, element);
      expect(await saved()).toEqual(before);
      expect(text(element, 'app-card h2')).toBe('Shop profile');
      expect(text(element, '#settings-shopName-error')).toBe('Enter the shop name');
      expect(text(element, '#settings-email-error')).toContain('name@example.com');
      expect(element.querySelectorAll('.sd-field-box--error').length).toBe(2);
      expect(document.activeElement).toBe(field(element, 'shopName'));
      expect(saveButton(element).disabled).toBeFalse();

      openGroup(fixture, element, 'Inventory alerts');
      expect(text(element, '#settings-expiryAlertDays-error')).toBe(
        'Enter a whole number of days from 1 to 365'
      );
      expect(text(element, '#settings-defaultReorderLevel-error')).toBe(
        'Enter a whole number of units from 1 to 10,000'
      );
      expect(text(element, '#settings-lowFloatRupees-error')).toBe(
        'Enter a whole amount of rupees from 0 to 1,000,000'
      );
    });

    it('focuses the first problem when it is already on the open group', async () => {
      const { fixture, element } = await render();
      openGroup(fixture, element, 'Inventory alerts');
      type(fixture, field(element, 'defaultReorderLevel'), 'abc');
      type(fixture, field(element, 'lowFloatRupees'), 'abc');
      await pressSave(fixture, element);
      expect(document.activeElement).toBe(field(element, 'defaultReorderLevel'));
    });

    it('clears a field error as soon as that field is edited', async () => {
      const { fixture, element } = await render();
      type(fixture, field(element, 'shopName'), '');
      await pressSave(fixture, element);
      expect(element.querySelector('#settings-shopName-error')).not.toBeNull();
      type(fixture, field(element, 'shopName'), 'Shop');
      expect(element.querySelector('#settings-shopName-error')).toBeNull();
    });

    it('accepts the boundary values 1, 365, 10,000 and Rs. 0', async () => {
      const { fixture, element } = await render();
      openGroup(fixture, element, 'Inventory alerts');
      type(fixture, field(element, 'expiryAlertDays'), '365');
      type(fixture, field(element, 'defaultReorderLevel'), '10000');
      type(fixture, field(element, 'lowFloatRupees'), '0');
      await pressSave(fixture, element);
      const now = await saved();
      expect([now.expiryAlertDays, now.defaultReorderLevel, now.lowFloatCents]).toEqual([
        365, 10_000, 0,
      ]);
    });

    it('Discard returns every field and option to the last saved value and saves nothing', async () => {
      const { fixture, element } = await render();
      const before = await saved();
      type(fixture, field(element, 'address'), 'Somewhere else');
      openGroup(fixture, element, 'Inventory alerts');
      type(fixture, field(element, 'expiryAlertDays'), '10');
      field<HTMLInputElement>(element, 'blockExpiredSales').click();
      fixture.detectChanges();
      discardButton(element).click();
      fixture.detectChanges();
      expect(field<HTMLInputElement>(element, 'expiryAlertDays').value).toBe('60');
      expect(field<HTMLInputElement>(element, 'blockExpiredSales').checked).toBeTrue();
      openGroup(fixture, element, 'Shop profile');
      expect(field<HTMLInputElement>(element, 'address').value).toBe(before.address);
      expect(saveButton(element).disabled).toBeTrue();
      expect(await saved()).toEqual(before);
    });

    it('saves the FEFO, expired-sales and sidebar options and shows them again next time', async () => {
      const { fixture, element } = await render();
      openGroup(fixture, element, 'Inventory alerts');
      for (const key of [
        'sellEarliestExpiringFirst',
        'blockExpiredSales',
        'showLowStockCountInSidebar',
      ]) {
        field<HTMLInputElement>(element, key).click();
      }
      fixture.detectChanges();
      await pressSave(fixture, element);
      const now = await saved();
      expect([
        now.sellEarliestExpiringFirst,
        now.blockExpiredSales,
        now.showLowStockCountInSidebar,
      ]).toEqual([false, false, false]);
      const reopened = TestBed.createComponent(SettingsComponent);
      reopened.detectChanges();
      await settle(reopened);
      openGroup(reopened, reopened.nativeElement, 'Inventory alerts');
      expect(
        Array.from(
          (reopened.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
            'input[type=checkbox]'
          )
        ).map(option => option.checked)
      ).toEqual([false, false, false]);
    });

    it('drops unsaved edits when the page is left, showing the last saved values on return', async () => {
      const { fixture, element } = await render();
      type(fixture, field(element, 'shopName'), 'Unsaved name');
      fixture.destroy();
      const returned = TestBed.createComponent(SettingsComponent);
      returned.detectChanges();
      await settle(returned);
      expect(field<HTMLInputElement>(returned.nativeElement, 'shopName').value).toBe('ShopDesk');
    });

    it('does not apply unsaved edits anywhere else', async () => {
      const { fixture, element } = await render();
      openGroup(fixture, element, 'Inventory alerts');
      type(fixture, field(element, 'expiryAlertDays'), '30');
      expect((await saved()).expiryAlertDays).toBe(60);
    });
  });

  describe('instant automatic sync', () => {
    const status = () => firstValueFrom(TestBed.inject(SyncDataService).getStatus());
    const syncSwitch = (element: HTMLElement) =>
      element.querySelector('app-backup-sync-section [role=switch]') as HTMLButtonElement;

    it('applies at once with a confirmation and without Save changes', async () => {
      const { fixture, element } = await render();
      openGroup(fixture, element, 'Backup & sync');
      syncSwitch(element).click();
      fixture.detectChanges();
      await settle(fixture);
      expect((await status()).autoSyncEnabled).toBeFalse();
      expect(syncSwitch(element).getAttribute('aria-checked')).toBe('false');
      expect(notification()?.message).toBe('Automatic sync is off.');
      expect(saveButton(element).disabled).toBeTrue();
      syncSwitch(element).click();
      fixture.detectChanges();
      await settle(fixture);
      expect((await status()).autoSyncEnabled).toBeTrue();
      expect(notification()?.message).toBe('Automatic sync is on.');
    });

    it('neither saves nor loses unsaved edits elsewhere, and Discard does not undo it', async () => {
      const { fixture, element } = await render();
      const before = await saved();
      type(fixture, field(element, 'shopName'), 'Unsaved name');
      openGroup(fixture, element, 'Backup & sync');
      syncSwitch(element).click();
      fixture.detectChanges();
      await settle(fixture);
      expect(await saved()).toEqual(before);
      expect(saveButton(element).disabled).toBeFalse();
      discardButton(element).click();
      fixture.detectChanges();
      expect((await status()).autoSyncEnabled).toBeFalse();
      expect(syncSwitch(element).getAttribute('aria-checked')).toBe('false');
      openGroup(fixture, element, 'Shop profile');
      expect(field<HTMLInputElement>(element, 'shopName').value).toBe('ShopDesk');
    });
  });

  describe('access', () => {
    it('is fully usable by an Admin', async () => {
      const { element } = await render(UserRole.ADMIN);
      expect(saveButton(element)).toBeDefined();
      expect(element.querySelector('app-page-header app-badge')).toBeNull();
    });

    it('does not let anyone without Full access change settings, even through the screen', async () => {
      const { fixture, element } = await render(UserRole.MANAGER);
      expect(saveButton(element)).toBeUndefined();
      expect(discardButton(element)).toBeUndefined();
      expect(text(element, 'app-page-header')).toContain('View only');
      expect(field<HTMLInputElement>(element, 'shopName').disabled).toBeTrue();
      const before = await saved();
      type(fixture, field(element, 'shopName'), 'Changed');
      expect(await saved()).toEqual(before);
    });
  });
});
