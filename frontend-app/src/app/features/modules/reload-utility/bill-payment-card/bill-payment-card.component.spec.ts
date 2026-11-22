import { TestBed } from '@angular/core/testing';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { NotificationService } from '../../../../core/services/notification.service';
import { ReloadService } from '../../../../core/services/reload.service';
import { BillPaymentCardComponent } from './bill-payment-card.component';

describe('BillPaymentCardComponent', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
    clearBrowserStorage();
    TestBed.inject(NotificationService).dismiss();
  });

  async function settle(fixture: { detectChanges(): void }): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 30));
    fixture.detectChanges();
  }

  async function render(canWrite = true, role: UserRole = UserRole.CASHIER) {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    await signInAs(role);
    const fixture = TestBed.createComponent(BillPaymentCardComponent);
    fixture.componentRef.setInput('canWrite', canWrite);
    let paidCount = 0;
    fixture.componentInstance.paid.subscribe(() => paidCount++);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const field = <T extends HTMLElement>(id: string) => element.querySelector(`#${id}`) as T;
    const payButton = () =>
      Array.from(element.querySelectorAll('button')).find(
        item => item.textContent?.trim() === 'Pay bill'
      ) as HTMLButtonElement | undefined;
    const type = (id: string, value: string) => {
      const input = field<HTMLInputElement>(id);
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const choose = (value: string) => {
      const select = field<HTMLSelectElement>('bill-provider');
      select.value = value;
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    const pay = async () => {
      payButton()!.click();
      fixture.detectChanges();
      await settle(fixture);
    };
    return { fixture, element, field, payButton, type, choose, pay, paid: () => paidCount };
  }

  it('lists the four providers, shows the service fee and marks all fields required', async () => {
    const { element, field } = await render();
    const options = Array.from(field<HTMLSelectElement>('bill-provider').options).map(option =>
      option.textContent?.trim()
    );
    expect(options).toEqual([
      'Choose a provider',
      'Electricity (CEB)',
      'Water (NWSDB)',
      'Telephone (SLT)',
      'Internet',
    ]);
    expect(element.querySelector('[data-testid="bill-fee-hint"]')?.textContent).toContain(
      'Service fee Rs. 25.00 added at the counter.'
    );
    expect(element.querySelectorAll('.field__required')).toHaveSize(3);
  });

  it('shows every problem, focuses the first one and keeps the button usable', async () => {
    const { element, pay, field, payButton } = await render();
    const spy = spyOn(TestBed.inject(ReloadService), 'payBill').and.callThrough();
    await pay();
    const messages = Array.from(element.querySelectorAll('[role="alert"]')).map(item =>
      item.textContent?.trim()
    );
    expect(messages).toEqual([
      'Choose the provider',
      'Enter the account number',
      'Enter the amount',
    ]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(field('bill-provider'));
    expect(payButton()!.disabled).toBeFalse();
  });

  it('focuses the account box when only the account and amount are missing', async () => {
    const { pay, field, choose } = await render();
    choose('Internet');
    await pay();
    expect(document.activeElement).toBe(field('bill-account'));
  });

  it('clears a field error when that field is edited', async () => {
    const { element, pay, type, choose } = await render();
    choose('Water (NWSDB)');
    await pay();
    expect(element.textContent).toContain('Enter the account number');
    type('bill-account', 'AC-1');
    expect(element.textContent).not.toContain('Enter the account number');
    expect(element.textContent).toContain('Enter the amount');
    type('bill-amount', '10');
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('pays a valid bill, shows the total with the fee, resets and emits paid', async () => {
    const { field, pay, type, choose, paid } = await render();
    choose('Electricity (CEB)');
    type('bill-account', '0123456789');
    type('bill-amount', '2500');
    await pay();
    expect(paid()).toBe(1);
    expect(TestBed.inject(NotificationService).current()?.message).toBe(
      'Bill paid. The customer pays Rs. 2,525.00.'
    );
    expect(field<HTMLSelectElement>('bill-provider').value).toBe('');
    expect(field<HTMLInputElement>('bill-account').value).toBe('');
    expect(field<HTMLInputElement>('bill-amount').value).toBe('');
  });

  it('pays only once when Pay bill is pressed twice in a row', async () => {
    const { fixture, payButton, type, choose, paid } = await render();
    const spy = spyOn(TestBed.inject(ReloadService), 'payBill').and.callThrough();
    choose('Internet');
    type('bill-account', 'ACC-9');
    type('bill-amount', '1000');
    const button = payButton()!;
    button.click();
    button.click();
    fixture.detectChanges();
    expect(button.disabled).toBeTrue();
    await settle(fixture);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(paid()).toBe(1);
    expect(payButton()!.disabled).toBeFalse();
  });

  it('warns and keeps the entries when the service refuses a Pharmacist', async () => {
    const { field, pay, type, choose, paid } = await render(true, UserRole.PHARMACIST);
    choose('Internet');
    type('bill-account', 'ACC-9');
    type('bill-amount', '1000');
    await pay();
    expect(paid()).toBe(0);
    expect(TestBed.inject(NotificationService).current()?.message).toBe(
      'That bill was not paid. You may not have access to pay bills.'
    );
    expect(field<HTMLInputElement>('bill-account').value).toBe('ACC-9');
  });

  it('hides Pay bill and disables every control without write access', async () => {
    const { payButton, field } = await render(false);
    expect(payButton()).toBeUndefined();
    expect(field<HTMLSelectElement>('bill-provider').disabled).toBeTrue();
    expect(field<HTMLInputElement>('bill-account').disabled).toBeTrue();
    expect(field<HTMLInputElement>('bill-amount').disabled).toBeTrue();
  });
});
