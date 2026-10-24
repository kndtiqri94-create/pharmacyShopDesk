import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { PermissionLevel } from '../../../../core/models/enums/permission-level.enum';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { RoleDataService } from '../../../../core/services/data/role-data.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { PosService } from '../../../../core/services/pos.service';
import { PosBillHeaderComponent } from './pos-bill-header.component';

describe('PosBillHeaderComponent', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
    TestBed.inject(NotificationService).dismiss();
    clearBrowserStorage();
  });

  async function render(viewOnly = false) {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    await signInAs(UserRole.CASHIER);
    if (viewOnly) {
      await TestBed.inject(PermissionService).load();
      const roleData = TestBed.inject(RoleDataService);
      const matrix = await firstValueFrom(roleData.getMatrix());
      await firstValueFrom(
        roleData.saveMatrix({
          ...matrix,
          CASHIER: { ...matrix.CASHIER, pos: PermissionLevel.VIEW },
        })
      );
    }
    await TestBed.inject(PosService).open();
    const fixture = TestBed.createComponent(PosBillHeaderComponent);
    const events = { newBill: 0, hold: 0 };
    fixture.componentInstance.newBillRequested.subscribe(() => (events.newBill += 1));
    fixture.componentInstance.holdRequested.subscribe(() => (events.hold += 1));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const input = (id: string) => element.querySelector(`#${id}`) as HTMLInputElement;
    const change = (target: HTMLInputElement, value: string) => {
      target.value = value;
      target.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    const button = (label: string) =>
      Array.from(element.querySelectorAll('button')).find(candidate =>
        candidate.textContent?.includes(label)
      )!;
    const pos = TestBed.inject(PosService);
    return { fixture, element, input, change, button, events, pos };
  }

  it('starts with today, Invoice, a generated invoice number and the Walk-in Customer', async () => {
    const { input, element } = await render();
    expect(input('pos-bill-date').value).toBe('2026-09-21');
    expect(input('pos-invoice-no').value).toBe('INV-0001');
    expect(input('pos-invoice-no').readOnly).toBeTrue();
    expect(input('pos-customer').value).toBe('Walk-in Customer');
    expect(input('pos-rep').value).toBe('');
    const options = Array.from(element.querySelectorAll('#pos-bill-type option'));
    expect(options.map(option => option.textContent?.trim())).toEqual(['Invoice']);
  });

  it('offers sample customers to pick from and no way to add one', async () => {
    const { element } = await render();
    const names = Array.from(element.querySelectorAll('#pos-customer-options option')).map(option =>
      option.getAttribute('value')
    );
    expect(names).toContain('Walk-in Customer');
    expect(names.length).toBeGreaterThan(2);
    const labels = Array.from(element.querySelectorAll('button')).map(item => item.textContent);
    expect(labels.some(label => /add customer|new customer/i.test(label ?? ''))).toBeFalse();
  });

  describe('bill date', () => {
    it('uses a changed date on the bill', async () => {
      const { input, change, pos } = await render();
      change(input('pos-bill-date'), '2026-09-18');
      expect(pos.bill().date).toBe('2026-09-18');
    });

    it('refuses a future date, says so and puts the old date back', async () => {
      const { input, change, pos } = await render();
      change(input('pos-bill-date'), '2026-09-25');
      expect(pos.bill().date).toBe('2026-09-21');
      expect(input('pos-bill-date').value).toBe('2026-09-21');
      expect(TestBed.inject(NotificationService).current()?.message).toContain(
        'today or an earlier'
      );
    });
  });

  describe('customer and rep', () => {
    it('picks a customer from the list by name', async () => {
      const { input, change, pos } = await render();
      change(input('pos-customer'), 'sunil rathnayake');
      expect(pos.bill().customerId).toBe('cus-002');
      expect(input('pos-customer').value).toBe('Sunil Rathnayake');
    });

    it('refuses a name that is not on the list and keeps the current customer', async () => {
      const { input, change, pos } = await render();
      change(input('pos-customer'), 'Somebody New');
      expect(pos.bill().customerId).toBe('cus-001');
      expect(input('pos-customer').value).toBe('Walk-in Customer');
      expect(TestBed.inject(NotificationService).current()?.message).toBe(
        'Choose a customer from the list.'
      );
    });

    it('records a rep when picked, and leaves it empty when cleared', async () => {
      const { input, change, pos } = await render();
      change(input('pos-rep'), 'Dilani Fernando');
      expect(pos.bill().repId).toBe('rep-002');
      change(input('pos-rep'), '');
      expect(pos.bill().repId).toBeNull();
      expect(input('pos-rep').value).toBe('');
    });

    it('refuses a rep that is not on the list', async () => {
      const { input, change, pos } = await render();
      change(input('pos-rep'), 'Nobody');
      expect(pos.bill().repId).toBeNull();
      expect(input('pos-rep').value).toBe('');
      expect(TestBed.inject(NotificationService).current()?.tone).toBe('warning');
    });
  });

  it('raises Create new bill and Hold bill', async () => {
    const { button, events } = await render();
    button('Create new bill').click();
    button('Hold bill').click();
    expect(events).toEqual({ newBill: 1, hold: 1 });
  });

  it('is read-only for a user who cannot sell', async () => {
    const { input, button } = await render(true);
    expect(input('pos-bill-date').disabled).toBeTrue();
    expect(input('pos-customer').disabled).toBeTrue();
    expect(input('pos-rep').disabled).toBeTrue();
    expect(button('Hold bill').disabled).toBeTrue();
  });

  it('uses the extra large control size so buttons are at least 52px', async () => {
    const { element } = await render();
    const buttons = Array.from(element.querySelectorAll('button'));
    expect(buttons.every(candidate => candidate.getAttribute('data-size') === 'xl')).toBeTrue();
  });
});
