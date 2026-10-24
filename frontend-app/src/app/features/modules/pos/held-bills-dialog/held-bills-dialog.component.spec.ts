import { TestBed } from '@angular/core/testing';
import { HeldBill } from '../../../../core/models/domain/held-bill.model';
import { HeldBillsDialogComponent } from './held-bills-dialog.component';

function heldBill(id: string, holdNo: string, overrides: Partial<HeldBill> = {}): HeldBill {
  return {
    id,
    holdNo,
    heldAt: '2026-09-21T10:35:12',
    customerName: 'Walk-in Customer',
    itemCount: 2,
    totalCents: 123_450,
    bill: {
      invoiceNo: 'INV-0001',
      date: '2026-09-21',
      customerId: 'cus-001',
      repId: null,
      lines: [],
      billDiscount: { mode: 'PERCENT', percent: 0 },
      billDiscountApproval: null,
      payments: {
        cash: '',
        card: '',
        online: '',
        cardReference: '',
        onlineReference: '',
        creditSelected: false,
      },
    },
    ...overrides,
  };
}

describe('HeldBillsDialogComponent', () => {
  afterEach(() => {
    for (const dialog of Array.from(document.querySelectorAll('dialog[open]'))) {
      (dialog as HTMLDialogElement).close();
    }
  });

  function render(
    held: readonly HeldBill[] = [
      heldBill('held-001', 'H-001'),
      heldBill('held-002', 'H-002', { customerName: 'Sunil Rathnayake', itemCount: 1 }),
    ],
    options: { busy?: boolean; canChange?: boolean } = {}
  ) {
    const fixture = TestBed.createComponent(HeldBillsDialogComponent);
    fixture.componentRef.setInput('heldBills', held);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('busy', options.busy ?? false);
    fixture.componentRef.setInput('canChange', options.canChange ?? true);
    const events = { resumed: [] as string[], discarded: [] as string[], closed: 0 };
    fixture.componentInstance.resumed.subscribe(id => events.resumed.push(id));
    fixture.componentInstance.discarded.subscribe(id => events.discarded.push(id));
    fixture.componentInstance.closed.subscribe(() => (events.closed += 1));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const dialog = element.querySelector('dialog') as HTMLDialogElement;
    const button = (label: string, row = 0) =>
      Array.from(element.querySelectorAll('tbody tr')[row].querySelectorAll('button')).find(
        candidate =>
          candidate.textContent?.includes(label) || candidate.getAttribute('aria-label') === label
      );
    return { fixture, element, dialog, events, button };
  }

  it('opens as a modal dialog titled Held bills', () => {
    const { dialog, element } = render();
    expect(dialog.open).toBeTrue();
    expect(element.querySelector('h2')?.textContent).toBe('Held bills');
    expect(dialog.getAttribute('aria-labelledby')).toBe(element.querySelector('h2')?.id ?? '');
  });

  it('shows each held bill with its hold number, customer, item count, total and time', () => {
    const { element } = render();
    const first = Array.from(element.querySelectorAll('tbody tr')[0].querySelectorAll('td')).map(
      cell => cell.textContent?.replace(/\s+/g, ' ').trim()
    );
    expect(first.slice(0, 5)).toEqual(['H-001', 'Walk-in Customer', '2', '1,234.50', '10:35']);
    const second = Array.from(element.querySelectorAll('tbody tr')[1].querySelectorAll('td'));
    expect(second[0].textContent?.trim()).toBe('H-002');
    expect(second[1].textContent?.trim()).toBe('Sunil Rathnayake');
  });

  it('says what to do when nothing is on hold', () => {
    const { element } = render([]);
    expect(element.textContent).toContain('No bills on hold');
    expect(element.textContent).toContain('Press Hold');
  });

  describe('resume and discard', () => {
    it('raises Resume with the id of that held bill', () => {
      const { button, events } = render();
      button('Resume H-002', 1)!.click();
      expect(events.resumed).toEqual(['held-002']);
    });

    it('asks before discarding and lets you keep the bill', () => {
      const { fixture, element, button, events } = render();
      button('Discard H-001')!.click();
      fixture.detectChanges();
      expect(element.textContent).toContain('Discard H-001?');
      button('Keep it')!.click();
      fixture.detectChanges();
      expect(events.discarded).toEqual([]);
      expect(element.textContent).not.toContain('Discard H-001?');
    });

    it('discards only after the second confirmation', () => {
      const { fixture, element, button, events } = render();
      button('Discard H-001')!.click();
      fixture.detectChanges();
      const confirm = Array.from(
        element.querySelectorAll('tbody tr')[0].querySelectorAll('button')
      ).find(candidate => candidate.textContent?.trim() === 'Discard')!;
      confirm.click();
      expect(events.discarded).toEqual(['held-001']);
    });

    it('turns Resume and Discard off while busy or when the user cannot sell', () => {
      const busy = render(undefined, { busy: true });
      expect(busy.button('Resume H-001')!.hasAttribute('disabled')).toBeTrue();
      expect(busy.button('Discard H-001')!.hasAttribute('disabled')).toBeTrue();
      TestBed.resetTestingModule();
      const readOnly = render(undefined, { canChange: false });
      expect(readOnly.button('Resume H-001')!.hasAttribute('disabled')).toBeTrue();
    });
  });

  describe('closing', () => {
    it('raises closed from the Close button', () => {
      const { element, events } = render();
      const close = Array.from(element.querySelectorAll('button')).find(
        candidate => candidate.textContent?.trim() === 'Close'
      )!;
      close.click();
      expect(events.closed).toBe(1);
    });

    it('treats Esc as close without letting the dialog close by itself', () => {
      const { dialog, events } = render();
      const escape = new Event('cancel', { cancelable: true });
      dialog.dispatchEvent(escape);
      expect(escape.defaultPrevented).toBeTrue();
      expect(events.closed).toBe(1);
    });

    it('forgets a half-finished discard when it closes', () => {
      const { fixture, element, button } = render();
      button('Discard H-001')!.click();
      fixture.detectChanges();
      fixture.componentRef.setInput('open', false);
      fixture.detectChanges();
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();
      expect(element.textContent).not.toContain('Discard H-001?');
    });
  });

  it('uses buttons that are at least 52px', () => {
    const { element } = render();
    for (const candidate of Array.from(element.querySelectorAll('button'))) {
      expect(parseFloat(getComputedStyle(candidate).minHeight)).toBeGreaterThanOrEqual(52);
    }
  });
});
