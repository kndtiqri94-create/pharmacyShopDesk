import { TestBed } from '@angular/core/testing';
import { RecordPaymentDialogComponent } from './record-payment-dialog.component';

describe('RecordPaymentDialogComponent', () => {
  function render(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(RecordPaymentDialogComponent);
    fixture.componentRef.setInput('supplierName', 'Lanka Pharma');
    fixture.componentRef.setInput('owedCents', 1_160_000);
    fixture.componentRef.setInput('open', true);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    const confirmed: number[] = [];
    fixture.componentInstance.confirmed.subscribe(cents => confirmed.push(cents));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector('#record-payment-amount') as HTMLInputElement;
    const confirmButton = () =>
      Array.from(element.querySelectorAll('button')).find(
        button => button.textContent?.trim() === 'Record payment'
      ) as HTMLButtonElement;
    const type = (value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, element, input, confirmed, confirmButton, type };
  }

  it('is pre-filled with the full outstanding amount and says who is being paid', () => {
    const { element, input } = render();
    expect(input.value).toBe('11600.00');
    expect(element.textContent).toContain('You owe Lanka Pharma Rs. 11,600.00');
    expect(input.getAttribute('autocomplete')).toBe('off');
    expect(input.getAttribute('maxlength')).toBe('15');
  });

  it('confirms the amount once, in cents', () => {
    const { fixture, confirmed, confirmButton, type } = render();
    type('1500.50');
    confirmButton().click();
    fixture.detectChanges();
    expect(confirmed).toEqual([150_050]);
  });

  it('confirms from the Enter key', () => {
    const { input, confirmed } = render();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(confirmed).toEqual([1_160_000]);
  });

  it('confirms nothing and shows what to fix for a bad amount, then clears the error when typing', () => {
    const { fixture, element, confirmed, confirmButton, type } = render();
    for (const value of ['', 'abc', '0', '-5', '1e3', '11600.01']) {
      type(value);
      confirmButton().click();
      fixture.detectChanges();
      expect(element.querySelector('.field__error')).withContext(value).not.toBeNull();
    }
    expect(confirmed).toEqual([]);
    type('100');
    expect(element.querySelector('.field__error')).toBeNull();
  });

  it('shows an error sent back from the payment and starts again when reopened', () => {
    const { fixture, element, input, type } = render({ serverError: 'Try again.' });
    expect(element.querySelector('.field__error')?.textContent).toBe('Try again.');
    fixture.componentRef.setInput('serverError', null);
    type('5');
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(input.value).toBe('11600.00');
  });

  it('clears a stale server error as soon as the amount is edited', () => {
    const { element, type } = render({ serverError: 'Try again.' });
    expect(element.querySelector('.field__error')?.textContent).toBe('Try again.');
    type('100');
    expect(element.querySelector('.field__error')).toBeNull();
  });

  it('cannot be confirmed again while a payment is being recorded', () => {
    const { fixture, confirmed, confirmButton } = render({ busy: true });
    expect(confirmButton().disabled).toBeTrue();
    confirmButton().click();
    fixture.detectChanges();
    expect(confirmed).toEqual([]);
  });
});
