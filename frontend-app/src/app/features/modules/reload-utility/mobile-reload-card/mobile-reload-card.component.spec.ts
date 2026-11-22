import { TestBed } from '@angular/core/testing';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { NotificationService } from '../../../../core/services/notification.service';
import { ReloadService } from '../../../../core/services/reload.service';
import { MobileReloadCardComponent } from './mobile-reload-card.component';

describe('MobileReloadCardComponent', () => {
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
    const fixture = TestBed.createComponent(MobileReloadCardComponent);
    fixture.componentRef.setInput('canWrite', canWrite);
    let sentCount = 0;
    fixture.componentInstance.sent.subscribe(() => sentCount++);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const field = <T extends HTMLElement>(id: string) => element.querySelector(`#${id}`) as T;
    const button = (label: string) =>
      Array.from(element.querySelectorAll('button')).find(
        item => item.textContent?.trim() === label
      ) as HTMLButtonElement | undefined;
    const type = (id: string, value: string) => {
      const input = field<HTMLInputElement>(id);
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const chooseOperator = (index: number) => {
      element.querySelectorAll<HTMLInputElement>('app-operator-tiles input')[index].click();
      fixture.detectChanges();
    };
    const chip = (label: string) => {
      button(label)!.click();
      fixture.detectChanges();
    };
    const text = (testId: string) =>
      element.querySelector(`[data-testid="${testId}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
    const send = async () => {
      button('Send reload')!.click();
      fixture.detectChanges();
      await settle(fixture);
    };
    return {
      fixture,
      element,
      field,
      button,
      type,
      chooseOperator,
      chip,
      text,
      send,
      sent: () => sentCount,
    };
  }

  it('starts with an empty form, a zero preview and a plain output region', async () => {
    const { element, text, field } = await render();
    expect(text('commission-preview')).toBe('Rs. 0.00 (2.5%)');
    expect(text('customer-pays')).toBe('Rs. 0.00');
    expect(field<HTMLInputElement>('reload-mobile').value).toBe('');
    expect(element.querySelector('output')?.hasAttribute('aria-live')).toBeFalse();
  });

  it('shows the preview for a chip and keeps the amount box read-only until Other', async () => {
    const { field, chip, text, type } = await render();
    const amount = field<HTMLInputElement>('reload-amount');
    expect(amount.readOnly).toBeTrue();
    chip('Rs. 500');
    expect(amount.value).toBe('500');
    expect(amount.readOnly).toBeTrue();
    expect(text('commission-preview')).toBe('Rs. 12.50 (2.5%)');
    expect(text('customer-pays')).toBe('Rs. 500.00');
    chip('Other');
    expect(amount.readOnly).toBeFalse();
    expect(document.activeElement).toBe(amount);
    type('reload-amount', '120');
    expect(text('commission-preview')).toBe('Rs. 3.00 (2.5%)');
    expect(text('customer-pays')).toBe('Rs. 120.00');
    type('reload-amount', 'abc');
    expect(text('commission-preview')).toBe('Rs. 0.00 (2.5%)');
  });

  it('shows every problem, focuses the first one and keeps the button usable', async () => {
    const { element, button, field, send } = await render();
    const spy = spyOn(TestBed.inject(ReloadService), 'sendReload').and.callThrough();
    await send();
    const messages = Array.from(element.querySelectorAll('[role="alert"]')).map(item =>
      item.textContent?.trim()
    );
    expect(messages).toContain('Choose the operator');
    expect(messages).toContain('Enter the mobile number');
    expect(messages).toContain('Enter the amount');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(field('reload-operator'));
    expect(button('Send reload')!.disabled).toBeFalse();
  });

  it('focuses the first invalid field after the operator is chosen', async () => {
    const { field, chooseOperator, send } = await render();
    chooseOperator(0);
    await send();
    expect(document.activeElement).toBe(field('reload-mobile'));
  });

  it('clears a field error as soon as that field is edited', async () => {
    const { element, type, chooseOperator, send } = await render();
    chooseOperator(1);
    await send();
    expect(element.textContent).toContain('Enter the mobile number');
    type('reload-mobile', '77');
    expect(element.textContent).not.toContain('Enter the mobile number');
    expect(element.textContent).toContain('Enter the amount');
  });

  it('rejects an amount above the available float', async () => {
    const { element, type, chooseOperator, chip, send } = await render();
    chooseOperator(0);
    type('reload-mobile', '77 123 4567');
    chip('Other');
    type('reload-amount', '999999');
    await send();
    expect(element.querySelector('#reload-amount-error')?.textContent).toContain(
      'The amount can be at most'
    );
  });

  it('sends a valid reload, says what was earned, clears the form and emits sent', async () => {
    const { field, type, chooseOperator, chip, text, send, sent } = await render();
    chooseOperator(0);
    type('reload-mobile', '77 123 4567');
    type('reload-customer-name', 'Nimal');
    chip('Rs. 500');
    await send();
    expect(sent()).toBe(1);
    expect(TestBed.inject(NotificationService).current()?.message).toBe(
      'Reload of Rs. 500.00 sent on Dialog. You earned Rs. 12.50.'
    );
    expect(field<HTMLInputElement>('reload-mobile').value).toBe('');
    expect(field<HTMLInputElement>('reload-customer-name').value).toBe('');
    expect(field<HTMLInputElement>('reload-amount').value).toBe('');
    expect(text('customer-pays')).toBe('Rs. 0.00');
  });

  it('sends only once when Send reload is pressed twice in a row', async () => {
    const { fixture, button, type, chooseOperator, chip, sent } = await render();
    const spy = spyOn(TestBed.inject(ReloadService), 'sendReload').and.callThrough();
    chooseOperator(2);
    type('reload-mobile', '77 123 4567');
    chip('Rs. 100');
    const submit = button('Send reload')!;
    submit.click();
    submit.click();
    fixture.detectChanges();
    expect(submit.disabled).toBeTrue();
    await settle(fixture);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(sent()).toBe(1);
    expect(button('Send reload')!.disabled).toBeFalse();
  });

  it('empties the form and the errors with Clear', async () => {
    const { fixture, element, button, type, chooseOperator, chip, field, send } = await render();
    chooseOperator(0);
    type('reload-mobile', '12');
    chip('Rs. 200');
    await send();
    expect(element.querySelector('[role="alert"]')).not.toBeNull();
    button('Clear')!.click();
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(field<HTMLInputElement>('reload-mobile').value).toBe('');
    expect(field<HTMLInputElement>('reload-amount').value).toBe('');
    expect(element.querySelector('.tile--selected')).toBeNull();
  });

  it('warns and keeps the form when the service refuses a Pharmacist', async () => {
    const { field, type, chooseOperator, chip, send, sent } = await render(
      true,
      UserRole.PHARMACIST
    );
    chooseOperator(0);
    type('reload-mobile', '77 123 4567');
    chip('Rs. 50');
    await send();
    expect(sent()).toBe(0);
    expect(TestBed.inject(NotificationService).current()?.message).toBe(
      'That reload was not sent. You may not have access to send reloads.'
    );
    expect(field<HTMLInputElement>('reload-mobile').value).toBe('77 123 4567');
  });

  it('hides Clear and Send reload and disables every control without write access', async () => {
    const { element, button, field } = await render(false);
    expect(button('Send reload')).toBeUndefined();
    expect(button('Clear')).toBeUndefined();
    expect(field<HTMLInputElement>('reload-mobile').disabled).toBeTrue();
    expect(field<HTMLInputElement>('reload-customer-name').disabled).toBeTrue();
    expect(field<HTMLInputElement>('reload-amount').disabled).toBeTrue();
    expect(
      element.querySelector('app-operator-tiles fieldset')?.hasAttribute('disabled')
    ).toBeTrue();
  });
});
