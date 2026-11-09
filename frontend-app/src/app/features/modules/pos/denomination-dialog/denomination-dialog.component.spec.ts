import { TestBed } from '@angular/core/testing';
import { settle } from '../../../../../testing/pos-test.util';
import { DenominationDialogComponent } from './denomination-dialog.component';

describe('DenominationDialogComponent', () => {
  afterEach(() => {
    for (const dialog of Array.from(document.querySelectorAll('dialog[open]'))) {
      (dialog as HTMLDialogElement).close();
    }
  });

  async function render() {
    const fixture = TestBed.createComponent(DenominationDialogComponent);
    const confirmed: number[] = [];
    let closedCount = 0;
    fixture.componentInstance.confirmed.subscribe(total => confirmed.push(total));
    fixture.componentInstance.closed.subscribe(() => (closedCount += 1));
    fixture.componentRef.setInput('open', true);
    await settle(fixture, 0);
    const element = fixture.nativeElement as HTMLElement;
    const count = (label: string) =>
      element.querySelector(`input[aria-label="${label} count"]`) as HTMLInputElement;
    const type = (label: string, value: string) => {
      const input = count(label);
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const button = (label: string) =>
      Array.from(element.querySelectorAll('button')).find(
        candidate => candidate.textContent?.trim() === label
      )!;
    return { fixture, element, count, type, button, confirmed, closes: () => closedCount };
  }

  it('lists every note and coin with a count box and a line amount', async () => {
    const { element } = await render();
    const rows = Array.from(element.querySelectorAll('tbody th')).map(cell =>
      cell.textContent?.trim()
    );
    expect(rows).toEqual([
      'Rs. 5,000 note',
      'Rs. 2,000 note',
      'Rs. 1,000 note',
      'Rs. 500 note',
      'Rs. 100 note',
      'Rs. 50 note',
      'Rs. 20 note',
      'Rs. 10 coin',
      'Rs. 5 coin',
      'Rs. 2 coin',
      'Rs. 1 coin',
    ]);
    expect(element.querySelectorAll('tbody input')).toHaveSize(11);
  });

  it('shows line amounts and a running total', async () => {
    const { element, type } = await render();
    type('Rs. 1,000 note', '3');
    type('Rs. 5 coin', '4');
    const total = element.querySelector('[data-testid="denomination-total"]')!;
    expect(total.textContent).toContain('3,020.00');
    expect(element.querySelector('tbody tr:nth-child(3) td:last-child')?.textContent).toContain(
      '3,000.00'
    );
  });

  it('sends the total in cents when confirmed', async () => {
    const { type, button, confirmed } = await render();
    type('Rs. 500 note', '2');
    type('Rs. 1 coin', '5');
    button('Use this total').click();
    expect(confirmed).toEqual([100_500]);
  });

  it('can confirm with every count blank as zero', async () => {
    const { button, confirmed } = await render();
    button('Use this total').click();
    expect(confirmed).toEqual([0]);
  });

  it('refuses a negative or fractional count with a message and does not confirm', async () => {
    const { fixture, element, type, button, confirmed } = await render();
    for (const bad of ['-1', '1.5', 'abc']) {
      type('Rs. 100 note', bad);
      button('Use this total').click();
      fixture.detectChanges();
      expect(element.querySelector('#dd-error-100')?.textContent).toContain('whole number');
      expect(element.querySelector('[role="alert"]')).not.toBeNull();
    }
    expect(confirmed).toEqual([]);
  });

  it('lets the whole screen be used with the keyboard: every control is a native button or input', async () => {
    const { element } = await render();
    const controls = Array.from(element.querySelectorAll('button, input'));
    expect(controls.length).toBeGreaterThan(11);
    for (const control of controls) {
      expect((control as HTMLElement).tabIndex).toBeGreaterThanOrEqual(0);
    }
  });

  it('confirms with Enter inside a count box', async () => {
    const { count, type, confirmed } = await render();
    type('Rs. 20 note', '5');
    count('Rs. 20 note').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(confirmed).toEqual([10_000]);
  });

  it('moves focus into the dialog when it opens', async () => {
    const { element } = await render();
    const dialog = element.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBeTrue();
    expect(dialog.contains(document.activeElement)).toBeTrue();
  });

  it('tells the owner it was dismissed when Cancel or Escape is used', async () => {
    const { element, button, closes } = await render();
    button('Cancel').click();
    expect(closes()).toBe(1);
    const dialog = element.querySelector('dialog') as HTMLDialogElement;
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(closes()).toBe(2);
  });

  it('starts blank again each time it opens', async () => {
    const { fixture, count, type } = await render();
    type('Rs. 50 note', '9');
    fixture.componentRef.setInput('open', false);
    await settle(fixture, 0);
    fixture.componentRef.setInput('open', true);
    await settle(fixture, 0);
    expect(count('Rs. 50 note').value).toBe('');
  });
});
