import { TestBed } from '@angular/core/testing';
import { TopUpDialogComponent } from './top-up-dialog.component';

describe('TopUpDialogComponent', () => {
  function render(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(TopUpDialogComponent);
    fixture.componentRef.setInput('open', true);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    const confirmed: number[] = [];
    const cancelled: string[] = [];
    fixture.componentInstance.confirmed.subscribe(cents => confirmed.push(cents));
    fixture.componentInstance.cancelled.subscribe(() => cancelled.push('cancelled'));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector('#top-up-amount') as HTMLInputElement;
    const buttonByText = (text: string) =>
      Array.from(element.querySelectorAll('button')).find(
        button => button.textContent?.trim() === text
      ) as HTMLButtonElement;
    const type = (value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, element, input, confirmed, cancelled, buttonByText, type };
  }

  it('opens as a modal dialog with an empty amount field and a way to confirm and cancel', () => {
    const { element, input, buttonByText } = render();
    expect(element.querySelector('dialog')?.open).toBeTrue();
    expect(element.querySelector('h2')?.textContent).toBe('Top up float');
    expect(input.value).toBe('');
    expect(input.getAttribute('autocomplete')).toBe('off');
    expect(input.getAttribute('maxlength')).toBe('10');
    expect(buttonByText('Top up float')).toBeDefined();
    expect(buttonByText('Cancel')).toBeDefined();
  });

  it('confirms the amount once, in cents', () => {
    const { fixture, confirmed, buttonByText, type } = render();
    type('5000');
    buttonByText('Top up float').click();
    fixture.detectChanges();
    expect(confirmed).toEqual([500_000]);
  });

  it('confirms from the Enter key', () => {
    const { input, confirmed, type } = render();
    type('250');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(confirmed).toEqual([25_000]);
  });

  it('adds nothing and says what to fix for each bad amount, then clears the error on typing', () => {
    const { fixture, element, confirmed, buttonByText, type } = render();
    for (const value of ['', 'abc', '0', '-5', '10.5', '1e3', '1000001']) {
      type(value);
      buttonByText('Top up float').click();
      fixture.detectChanges();
      expect(element.querySelector('.field__error')).withContext(value).not.toBeNull();
    }
    expect(confirmed).toEqual([]);
    type('100');
    expect(element.querySelector('.field__error')).toBeNull();
  });

  it('puts the focus back in the amount field when the amount is wrong', () => {
    const { fixture, input, buttonByText } = render();
    buttonByText('Top up float').click();
    fixture.detectChanges();
    expect(document.activeElement).toBe(input);
  });

  it('tells the page when it is cancelled and changes nothing', () => {
    const { confirmed, cancelled, buttonByText } = render();
    buttonByText('Cancel').click();
    expect(cancelled).toEqual(['cancelled']);
    expect(confirmed).toEqual([]);
  });

  it('shows an error sent back from the top up and starts empty when reopened', () => {
    const { fixture, element, input, type } = render({ serverError: 'Try again.' });
    expect(element.querySelector('.field__error')?.textContent).toBe('Try again.');
    fixture.componentRef.setInput('serverError', null);
    type('5');
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(input.value).toBe('');
  });

  it('cannot be confirmed again while a top up is being made', () => {
    const { fixture, confirmed, buttonByText, type } = render({ busy: true });
    type('100');
    expect(buttonByText('Top up float').disabled).toBeTrue();
    buttonByText('Top up float').click();
    fixture.detectChanges();
    expect(confirmed).toEqual([]);
  });
});
