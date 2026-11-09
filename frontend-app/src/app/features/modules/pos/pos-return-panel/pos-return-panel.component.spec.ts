import { TestBed } from '@angular/core/testing';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { setPosLevel, settle, testBill } from '../../../../../testing/pos-test.util';
import { SaleReturn } from '../../../../core/models/domain/sale-return.model';
import { PermissionLevel } from '../../../../core/models/enums/permission-level.enum';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { NotificationService } from '../../../../core/services/notification.service';
import { PosSaleService } from '../../../../core/services/pos-sale.service';
import { PosService } from '../../../../core/services/pos.service';
import { PosReturnPanelComponent } from './pos-return-panel.component';

describe('PosReturnPanelComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(() => {
    TestBed.inject(NotificationService).dismiss();
    clearBrowserStorage();
  });

  async function render(options: { sell?: boolean; viewOnly?: boolean } = {}) {
    await signInAs(UserRole.CASHIER);
    if (options.sell !== false) await TestBed.inject(PosSaleService).save(testBill());
    if (options.viewOnly) await setPosLevel(UserRole.CASHIER, PermissionLevel.VIEW);
    await TestBed.inject(PosService).open();
    const fixture = TestBed.createComponent(PosReturnPanelComponent);
    const completed: SaleReturn[] = [];
    fixture.componentInstance.returnCompleted.subscribe(item => completed.push(item));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const type = (id: string, value: string) => {
      const input = element.querySelector(`#${id}`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const button = (label: string) =>
      Array.from(element.querySelectorAll('button')).find(candidate =>
        candidate.textContent?.trim().startsWith(label)
      )!;
    const message = () => TestBed.inject(NotificationService).current()?.message;
    return { fixture, element, type, button, completed, message };
  }

  it('offers an invoice lookup and a return bill lookup', async () => {
    const { element } = await render();
    expect(element.querySelector('#return-invoice-lookup')).not.toBeNull();
    expect(element.querySelector('#return-bill-lookup')).not.toBeNull();
  });

  it('shows the original sale and what can still be returned', async () => {
    const { fixture, element, type, button } = await render();
    type('return-invoice-lookup', 'inv-0001');
    button('Find sale').click();
    await settle(fixture);
    const sale = element.querySelector('[data-testid="return-sale"]')!;
    expect(sale.textContent).toContain('INV-0001');
    expect(sale.textContent).toContain('Walk-in Customer');
    expect(sale.textContent).toContain('Paracetamol 500mg');
  });

  it('says no sale was found and shows nothing to return', async () => {
    const { fixture, element, type, button } = await render();
    type('return-invoice-lookup', 'INV-9999');
    button('Find sale').click();
    await settle(fixture);
    expect(element.textContent).toContain('No sale found for INV-9999');
    expect(element.querySelector('[data-testid="return-sale"]')).toBeNull();
  });

  it('offers a cash refund only for the Walk-in Customer', async () => {
    const { fixture, element, type, button } = await render();
    type('return-invoice-lookup', 'INV-0001');
    button('Find sale').click();
    await settle(fixture);
    const radios = Array.from(element.querySelectorAll('input[type="radio"]'));
    expect(radios).toHaveSize(1);
    expect(element.textContent).toContain('Cash refund');
    expect(element.textContent).not.toContain('Customer credit');
  });

  it('shows a message when more than is returnable is typed', async () => {
    const { fixture, element, type, button } = await render();
    type('return-invoice-lookup', 'INV-0001');
    button('Find sale').click();
    await settle(fixture);
    const quantity = element.querySelector(
      'input[aria-label="Quantity of Paracetamol 500mg to return"]'
    ) as HTMLInputElement;
    quantity.value = '9';
    quantity.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(element.textContent).toContain('Only 4 of Paracetamol 500mg remain returnable');
  });

  it('totals the selected lines and completes the return', async () => {
    const { fixture, element, type, button, completed, message } = await render();
    type('return-invoice-lookup', 'INV-0001');
    button('Find sale').click();
    await settle(fixture);
    const quantity = element.querySelector(
      'input[aria-label="Quantity of Paracetamol 500mg to return"]'
    ) as HTMLInputElement;
    quantity.value = '2';
    quantity.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(element.querySelector('[data-testid="return-total"]')?.textContent).toContain('5.00');
    button('Complete return').click();
    await settle(fixture);
    expect(completed).toHaveSize(1);
    expect(completed[0].returnNo).toBe('RET-0001');
    expect(message()).toBe('Return RET-0001 saved.');
    expect(element.querySelector('[data-testid="return-sale"]')).toBeNull();
  });

  it('refuses to complete with nothing selected and says why', async () => {
    const { fixture, type, button, completed, message } = await render();
    type('return-invoice-lookup', 'INV-0001');
    button('Find sale').click();
    await settle(fixture);
    button('Complete return').click();
    await settle(fixture);
    expect(completed).toEqual([]);
    expect(message()).toContain('Nothing is selected');
  });

  it('shows an earlier return for printing and offers no way to return it again', async () => {
    const { fixture, element, type, button } = await render();
    type('return-invoice-lookup', 'INV-0001');
    button('Find sale').click();
    await settle(fixture);
    const quantity = element.querySelector(
      'input[aria-label="Quantity of Paracetamol 500mg to return"]'
    ) as HTMLInputElement;
    quantity.value = '1';
    quantity.dispatchEvent(new Event('input'));
    button('Complete return').click();
    await settle(fixture);
    type('return-bill-lookup', 'ret-0001');
    button('Find return').click();
    await settle(fixture);
    const viewed = element.querySelector('[data-testid="viewed-return"]')!;
    expect(viewed.textContent).toContain('RET-0001');
    expect(viewed.textContent).toContain('cannot be returned a second time');
    expect(button('Complete return')).toBeUndefined();
    expect(button('Print return receipt')).toBeDefined();
  });

  it('says so when a return number is not found', async () => {
    const { fixture, element, type, button } = await render();
    type('return-bill-lookup', 'RET-0042');
    button('Find return').click();
    await settle(fixture);
    expect(element.textContent).toContain('No return found for RET-0042');
  });

  it('does not let a user who cannot sell complete a return', async () => {
    const { fixture, type, button } = await render({ viewOnly: true });
    type('return-invoice-lookup', 'INV-0001');
    button('Find sale').click();
    await settle(fixture);
    expect(button('Complete return').disabled).toBeTrue();
  });
});
