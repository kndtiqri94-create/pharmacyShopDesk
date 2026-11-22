import { TestBed } from '@angular/core/testing';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { closeOpenDialogs, settle } from '../../../../../testing/pos-test.util';
import { DuePayment } from '../../../../core/models/domain/due-payment.model';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { NotificationService } from '../../../../core/services/notification.service';
import { PosDueService } from '../../../../core/services/pos-due.service';
import { DueAmountDialogComponent } from './due-amount-dialog.component';

describe('DueAmountDialogComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(() => {
    closeOpenDialogs();
    TestBed.inject(NotificationService).dismiss();
    clearBrowserStorage();
  });

  async function render(canChange = true) {
    await signInAs(UserRole.CASHIER);
    const fixture = TestBed.createComponent(DueAmountDialogComponent);
    const printed: DuePayment[] = [];
    fixture.componentInstance.printRequested.subscribe(item => printed.push(item));
    fixture.componentRef.setInput('canChange', canChange);
    fixture.componentRef.setInput('open', true);
    await settle(fixture);
    const element = fixture.nativeElement as HTMLElement;
    const type = (id: string, value: string) => {
      const input = element.querySelector(`#${id}`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const take = (name: string) =>
      element.querySelector(`button[aria-label="Take payment from ${name}"]`) as HTMLButtonElement;
    const button = (label: string) =>
      Array.from(element.querySelectorAll('button')).find(
        candidate => candidate.textContent?.trim() === label
      )!;
    return { fixture, element, type, take, button, printed };
  }

  it('lists customers who owe money with the amount', async () => {
    const { element } = await render();
    const rows = Array.from(element.querySelectorAll('tbody tr'));
    expect(rows).toHaveSize(2);
    expect(rows[0].textContent).toContain('Galle Road Clinic');
    expect(rows[0].textContent).toContain('12,750');
    expect(element.textContent).not.toContain('Walk-in Customer');
  });

  it('searches by customer name', async () => {
    const { fixture, element, type } = await render();
    type('due-search', 'sunil');
    await settle(fixture, 0);
    const rows = Array.from(element.querySelectorAll('tbody tr'));
    expect(rows).toHaveSize(1);
    expect(rows[0].textContent).toContain('Sunil Rathnayake');
  });

  it('says no one owes anything once every balance is cleared', async () => {
    await signInAs(UserRole.CASHIER);
    for (const due of await TestBed.inject(PosDueService).list()) {
      await TestBed.inject(PosDueService).takePayment(
        due.customerId,
        (due.owedCents / 100).toFixed(2),
        'CASH',
        ''
      );
    }
    const fixture = TestBed.createComponent(DueAmountDialogComponent);
    fixture.componentRef.setInput('open', true);
    await settle(fixture);
    expect(fixture.nativeElement.textContent).toContain('No unpaid balances');
  });

  it('refuses zero, negative, non numeric and more than owed with a message', async () => {
    const { fixture, element, type, take, button } = await render();
    take('Sunil Rathnayake').click();
    fixture.detectChanges();
    for (const bad of ['0', '-5', 'abc', '99999.00', '']) {
      type('due-amount', bad);
      button('Save payment').click();
      await settle(fixture);
      expect(element.querySelector('.field__error')).not.toBeNull();
    }
    expect((await TestBed.inject(PosDueService).list()).length).toBe(2);
  });

  it('takes a payment, lowers the balance and offers a receipt', async () => {
    const { fixture, element, type, take, button, printed } = await render();
    take('Sunil Rathnayake').click();
    fixture.detectChanges();
    type('due-amount', '1000');
    button('Save payment').click();
    await settle(fixture);
    expect(element.textContent).toContain('Payment saved');
    expect(element.textContent).toContain('RCP-0001');
    const dues = await TestBed.inject(PosDueService).list();
    expect(dues.find(due => due.name === 'Sunil Rathnayake')?.owedCents).toBe(350_000);
    button('Print receipt').click();
    expect(printed).toHaveSize(1);
  });

  it('removes a customer from the list once the balance is cleared', async () => {
    const { fixture, element, type, take, button } = await render();
    take('Sunil Rathnayake').click();
    fixture.detectChanges();
    type('due-amount', '4500');
    button('Save payment').click();
    await settle(fixture);
    const names = Array.from(element.querySelectorAll('tbody tr')).map(row => row.textContent);
    expect(names.some(name => name?.includes('Sunil Rathnayake'))).toBeFalse();
  });

  it('asks for a reference only for card and online', async () => {
    const { fixture, element, take } = await render();
    take('Sunil Rathnayake').click();
    fixture.detectChanges();
    expect(element.querySelector('#due-reference')).toBeNull();
    const method = element.querySelector('#due-method') as HTMLSelectElement;
    method.value = 'CARD';
    method.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(element.querySelector('#due-reference')).not.toBeNull();
  });

  it('cannot take a payment for a user who cannot sell', async () => {
    const { take } = await render(false);
    expect(take('Sunil Rathnayake').disabled).toBeTrue();
  });
});
