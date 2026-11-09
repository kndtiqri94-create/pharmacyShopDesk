import { TestBed } from '@angular/core/testing';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import {
  closeOpenDialogs,
  counterCloseInput,
  settle,
  testBill,
} from '../../../../../testing/pos-test.util';
import { CounterReport } from '../../../../core/models/domain/counter-report.model';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { NotificationService } from '../../../../core/services/notification.service';
import { PosCashService } from '../../../../core/services/pos-cash.service';
import { PosCounterService } from '../../../../core/services/pos-counter.service';
import { PosSaleService } from '../../../../core/services/pos-sale.service';
import { CounterCloseDialogComponent } from './counter-close-dialog.component';
import { COUNTER_CLOSE_LABELS, bilingualText } from './counter-close-labels';

const SINHALA_CHARACTERS = /[඀-෿‍]/g;
const HINT = 'Enter cash count to enable completion';

function plain(text: string | null | undefined): string {
  return (text ?? '').replaceAll(/\s+/g, ' ').trim();
}

function rows(root: Element | null): string[] {
  return Array.from(root?.querySelectorAll('dl > div') ?? []).map(row =>
    plain(`${row.querySelector('dt')?.textContent} ${row.querySelector('dd')?.textContent}`)
  );
}

describe('CounterCloseDialogComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(() => {
    closeOpenDialogs();
    document.documentElement.removeAttribute('data-theme');
    TestBed.inject(NotificationService).dismiss();
    clearBrowserStorage();
  });

  async function render(
    options: { unsavedBill?: boolean; held?: boolean; canChange?: boolean } = {}
  ) {
    await signInAs(UserRole.CASHIER);
    await TestBed.inject(PosCashService).saveOpening('1000', false);
    await TestBed.inject(PosSaleService).save(
      testBill({ payments: { ...testBill().payments, cash: '20' } })
    );
    if (options.held) await TestBed.inject(PosSaleService).hold(testBill());
    const fixture = TestBed.createComponent(CounterCloseDialogComponent);
    const printed: CounterReport[] = [];
    fixture.componentInstance.printRequested.subscribe(item => printed.push(item));
    fixture.componentRef.setInput('hasUnsavedBill', options.unsavedBill ?? false);
    fixture.componentRef.setInput('canChange', options.canChange ?? true);
    fixture.componentRef.setInput('open', true);
    await settle(fixture);
    const element = fixture.nativeElement as HTMLElement;
    const field = (id: string) => element.querySelector(`#${id}`) as HTMLInputElement;
    const typeInto = (id: string, value: string) => {
      field(id).value = value;
      field(id).dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const type = (value: string) => typeInto('counter-counted', value);
    const button = (label: string) =>
      Array.from(element.querySelectorAll('button')).find(
        candidate => candidate.textContent?.trim() === label
      )!;
    const complete = () => button('Complete Counter Close');
    const choose = (id: string, value: string) => {
      const select = field(id) as unknown as HTMLSelectElement;
      select.value = value;
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    const calculator = () =>
      element.querySelector('button[aria-label="Count notes and coins"]') as HTMLButtonElement;
    return {
      fixture,
      element,
      field,
      type,
      typeInto,
      choose,
      button,
      complete,
      calculator,
      printed,
    };
  }

  describe('layout', () => {
    it('shows Shift Summary with Sales Breakdown, Cash Count and Cash Reconciliation in that order', async () => {
      const { element } = await render();
      const grid = element.querySelector('.cc-grid')!;
      const order = Array.from(grid.children).map(child => child.getAttribute('data-testid'));
      expect(order).toEqual(['column-summary', 'column-count', 'column-reconciliation']);
      expect(getComputedStyle(grid).display).toBe('grid');
      const titles = Array.from(element.querySelectorAll('.cc-card__title')).map(item =>
        plain(item.textContent)
      );
      expect(titles).toEqual([
        bilingualText(COUNTER_CLOSE_LABELS.shiftSummary),
        bilingualText(COUNTER_CLOSE_LABELS.salesBreakdown),
        bilingualText(COUNTER_CLOSE_LABELS.cashCount),
        bilingualText(COUNTER_CLOSE_LABELS.reconciliation),
      ]);
    });

    it('uses a wide dialog and the design tokens, with a dark theme that changes the card colour', async () => {
      const { element } = await render();
      const card = element.querySelector('.cc-card') as HTMLElement;
      const dialog = element.querySelector('dialog') as HTMLDialogElement;
      expect(dialog.getAttribute('data-size')).toBe('xl');
      const light = getComputedStyle(card).backgroundColor;
      document.documentElement.setAttribute('data-theme', 'dark');
      const dark = getComputedStyle(card).backgroundColor;
      expect(dark).not.toBe(light);
    });
  });

  describe('words on the screen', () => {
    it('shows the English label first with the Sinhala beside it for the eight listed labels', async () => {
      const { element } = await render();
      const text = plain(element.textContent);
      for (const label of Object.values(COUNTER_CLOSE_LABELS)) {
        expect(text).withContext(label.english).toContain(bilingualText(label));
      }
    });

    it('invents no other Sinhala: only the eight listed labels carry it', async () => {
      const { element, type } = await render();
      type('1000');
      const expected = Object.values(COUNTER_CLOSE_LABELS)
        .map(label => label.sinhala)
        .join('')
        .match(SINHALA_CHARACTERS);
      const shown = (element.textContent ?? '').match(SINHALA_CHARACTERS);
      expect(shown).toEqual(expected);
    });

    it('keeps the other labels in English only', async () => {
      const { element, type } = await render();
      type('1020');
      const text = plain(element.textContent);
      for (const word of [
        'Cashier',
        'Register',
        'Start Time',
        'End Time',
        'Total Sales',
        'Opening Amount',
        'Cash In',
        'Cash Out',
        'Net Total',
        'Expected',
        'Counted',
        'Difference',
        'Over',
      ]) {
        expect(text).withContext(word).toContain(word);
      }
    });

    it('has no Reload Commission line, amount or button anywhere', async () => {
      const { element, type } = await render();
      type('1000');
      expect(plain(element.textContent)).not.toMatch(/reload/i);
      expect(plain(element.textContent)).not.toMatch(/commission/i);
    });
  });

  describe('Shift Summary and Sales Breakdown', () => {
    it('shows the cashier, register, start time, a pending end time and the POS sales total', async () => {
      const { element } = await render();
      const summary = element.querySelector('[data-testid="shift-summary"]')!;
      const text = plain(summary.textContent);
      expect(text).toContain('Ruwani Jayawardena');
      expect(text).toContain('Counter 1');
      expect(text).toContain('Rs. 10.00');
      expect(plain(element.querySelector('[data-testid="start-time"]')?.textContent)).toMatch(
        /^21 Sep 2026 \d{2}:\d{2}$/
      );
      expect(plain(element.querySelector('[data-testid="end-time"]')?.textContent)).toBe(
        'Set when you complete the close'
      );
    });

    it('lists Opening Amount, Cash In, Cash Out and Net Total, and Net Total equals Expected Cash', async () => {
      const { element } = await render();
      expect(rows(element.querySelector('[data-testid="counter-summary"]'))).toEqual([
        'Opening Amount Rs. 1,000.00',
        'Cash In Rs. 10.00',
        'Cash Out Rs. 0.00',
        'Net Total Rs. 1,010.00',
      ]);
      expect(plain(element.querySelector('[data-testid="counter-expected"]')?.textContent)).toBe(
        'Rs. 1,010.00'
      );
      expect(plain(element.querySelector('[data-testid="counter-net-total"]')?.textContent)).toBe(
        'Rs. 1,010.00'
      );
    });

    it('says there is no activity yet when nothing has happened today', async () => {
      await signInAs(UserRole.CASHIER);
      const fixture = TestBed.createComponent(CounterCloseDialogComponent);
      fixture.componentRef.setInput('open', true);
      await settle(fixture);
      const element = fixture.nativeElement as HTMLElement;
      expect(plain(element.querySelector('[data-testid="start-time"]')?.textContent)).toBe(
        'No activity yet'
      );
    });
  });

  describe('Cash Count fields', () => {
    it('gives the three fields an Rs. prefix, right aligned text and controls of at least 52px', async () => {
      const { element, type, field } = await render();
      type('1000');
      const handover = field('counter-handover');
      handover.value = '100';
      handover.dispatchEvent(new Event('input'));
      for (const id of ['counter-counted', 'counter-handover', 'counter-bf']) {
        const input = field(id);
        const box = input.closest('.sd-field-box') as HTMLElement;
        expect(plain(box.querySelector('.field__affix')?.textContent))
          .withContext(id)
          .toBe('Rs.');
        expect(getComputedStyle(input).textAlign).withContext(id).toBe('right');
        expect(parseFloat(getComputedStyle(box).minHeight))
          .withContext(id)
          .toBeGreaterThanOrEqual(52);
      }
      const calculatorButton = element.querySelector(
        'button[aria-label="Count notes and coins"]'
      ) as HTMLElement;
      expect(parseFloat(getComputedStyle(calculatorButton).minHeight)).toBeGreaterThanOrEqual(52);
    });

    it('has a label for every field and the tab order follows the visual order', async () => {
      const { element, fixture, typeInto, type } = await render();
      type('1000');
      typeInto('counter-handover', '100');
      fixture.detectChanges();
      const ids = Array.from(element.querySelectorAll('.cc-fields input, .cc-fields select'))
        .map(control => control.id)
        .filter(id => id.length > 0);
      expect(ids).toEqual([
        'counter-counted',
        'counter-handover',
        'counter-supervisor',
        'counter-bf',
      ]);
      for (const id of ids) {
        expect(element.querySelector(`label[for="${id}"]`))
          .withContext(id)
          .not.toBeNull();
      }
      const countedLabel = plain(
        element.querySelector('label[for="counter-counted"]')?.textContent
      );
      expect(countedLabel).toBe(bilingualText(COUNTER_CLOSE_LABELS.countedCash));
    });
  });

  describe('Complete Counter Close', () => {
    it('is disabled with a hint that the button points to, and the reconciliation is empty', async () => {
      const { element, complete } = await render();
      expect(complete().disabled).toBeTrue();
      const hint = element.querySelector('#counter-complete-hint')!;
      expect(plain(hint.textContent)).toBe(HINT);
      expect(complete().getAttribute('aria-describedby')).toBe('counter-complete-hint');
      expect(element.querySelector('[data-testid="reconciliation"]')).toBeNull();
    });

    it('enables once a valid count is entered, shows the reconciliation, and disables again when cleared', async () => {
      const { element, complete, type } = await render();
      type('1020');
      expect(complete().disabled).toBeFalse();
      expect(element.querySelector('#counter-complete-hint')).toBeNull();
      expect(complete().getAttribute('aria-describedby')).toBeNull();
      const reconciliation = rows(element.querySelector('[data-testid="reconciliation"]'));
      expect(reconciliation).toEqual([
        'Expected Rs. 1,010.00',
        'Counted Rs. 1,020.00',
        jasmine.anything(),
      ]);
      expect(reconciliation[2]).toBe('Difference Rs. 10.00 Over');
      expect(
        element.querySelector('[data-testid="counter-difference"] app-icon svg')
      ).not.toBeNull();
      type('');
      expect(complete().disabled).toBeTrue();
      expect(plain(element.querySelector('#counter-complete-hint')?.textContent)).toBe(HINT);
      expect(element.querySelector('[data-testid="reconciliation"]')).toBeNull();
    });

    it('shows the difference at once in words and icon, not colour alone', async () => {
      const { element, type } = await render();
      const outcome = () =>
        element.querySelector('[data-testid="counter-difference"] .cc-outcome') as HTMLElement;
      type('1020');
      expect(outcome().textContent).toContain('Over');
      type('1000');
      expect(outcome().textContent).toContain('Short');
      type('1010');
      expect(outcome().textContent).toContain('Balanced');
      expect(outcome().querySelector('svg')).not.toBeNull();
    });

    it('offers a note only when the cash is over or short', async () => {
      const { element, type } = await render();
      type('1010');
      expect(element.querySelector('#counter-note')).toBeNull();
      type('1000');
      expect(element.querySelector('#counter-note')).not.toBeNull();
    });

    it('refuses a negative or non numeric count with a message and does not ask to confirm', async () => {
      const { fixture, element, type, complete } = await render();
      for (const bad of ['-1', 'abc', 'NaN', '1.234']) {
        type(bad);
        expect(complete().disabled).withContext(bad).toBeTrue();
        complete().click();
        await settle(fixture);
        expect(element.querySelector('#counter-counted-error')).withContext(bad).not.toBeNull();
        expect(element.textContent).not.toContain('Close the counter for today?');
      }
    });

    it('is disabled when the user can only view the till', async () => {
      const { complete, type, element } = await render({ canChange: false });
      type('1000');
      expect(complete().disabled).toBeTrue();
      expect((element.querySelector('#counter-counted') as HTMLInputElement).disabled).toBeTrue();
    });
  });

  describe('handover and balance brought forward', () => {
    it('asks for a supervisor only when the handover is above zero, from Admin and Manager users only', async () => {
      const { element, type, typeInto, field } = await render();
      type('1000');
      expect(field('counter-supervisor')).toBeNull();
      typeInto('counter-handover', '0');
      expect(field('counter-supervisor')).toBeNull();
      typeInto('counter-handover', '100');
      const options = Array.from(element.querySelectorAll('#counter-supervisor option')).map(
        option => plain(option.textContent)
      );
      expect(options).toEqual(['Choose a supervisor', 'Nimal Perera', 'Kamal Silva']);
    });

    it('refuses to complete a handover without a supervisor, then accepts one', async () => {
      const { fixture, element, type, typeInto, choose, complete } = await render();
      type('1000');
      typeInto('counter-handover', '100');
      complete().click();
      await settle(fixture);
      expect(element.querySelector('#counter-supervisor-error')?.textContent).toContain(
        'Choose the supervisor'
      );
      expect(element.textContent).not.toContain('Close the counter for today?');
      choose('counter-supervisor', 'usr-002');
      complete().click();
      await settle(fixture);
      expect(element.textContent).toContain('Close the counter for today?');
    });

    it('refuses a handover above the count, negative or not a number', async () => {
      const { element, type, typeInto } = await render();
      type('100');
      for (const bad of ['100.01', '-1', 'abc']) {
        typeInto('counter-handover', bad);
        expect(element.querySelector('#counter-handover-error')).withContext(bad).not.toBeNull();
      }
      typeInto('counter-handover', '100');
      expect(element.querySelector('#counter-handover-error')).toBeNull();
    });

    it('pre-fills the balance brought forward as the count less the handover', async () => {
      const { field, type, typeInto } = await render();
      type('1000');
      expect(field('counter-bf').value).toBe('1000.00');
      typeInto('counter-handover', '250');
      expect(field('counter-bf').value).toBe('750.00');
    });

    it('lets the balance be changed up to the bound and refuses a higher one', async () => {
      const { element, type, typeInto, field } = await render();
      type('1000');
      typeInto('counter-handover', '250');
      typeInto('counter-bf', '600');
      expect(element.querySelector('#counter-bf-error')).toBeNull();
      expect(field('counter-bf').value).toBe('600');
      typeInto('counter-bf', '750.01');
      expect(element.querySelector('#counter-bf-error')?.textContent).toContain(
        'cannot be more than the cash you counted'
      );
    });

    it('flags cash that is neither handed over nor brought forward, in words', async () => {
      const { element, type, typeInto } = await render();
      type('1000');
      expect(element.querySelector('[data-testid="unaccounted"]')).toBeNull();
      typeInto('counter-bf', '900');
      expect(plain(element.querySelector('[data-testid="unaccounted"]')?.textContent)).toBe(
        'Rs. 100.00 is neither handed over nor brought forward.'
      );
    });

    it('does not change Expected Cash or the result when a handover is entered', async () => {
      const { element, type, typeInto } = await render();
      type('1010');
      typeInto('counter-handover', '500');
      expect(plain(element.querySelector('[data-testid="counter-expected"]')?.textContent)).toBe(
        'Rs. 1,010.00'
      );
      expect(element.querySelector('[data-testid="counter-difference"]')?.textContent).toContain(
        'Balanced'
      );
    });
  });

  describe('confirming and the locked report', () => {
    it('asks for confirmation before closing and then shows the locked report in three columns', async () => {
      const { fixture, element, type, typeInto, choose, complete, button } = await render();
      type('1000');
      typeInto('counter-handover', '400');
      choose('counter-supervisor', 'usr-002');
      typeInto('counter-bf', '500');
      complete().click();
      fixture.detectChanges();
      expect(element.textContent).toContain('Close the counter for today?');
      expect((await TestBed.inject(PosCounterService).preview()).report).toBeNull();
      button('Close counter').click();
      await settle(fixture);
      const report = element.querySelector('[data-testid="locked-report"]')!;
      const text = plain(report.textContent);
      expect(text).toContain('Short');
      expect(text).toContain('Ruwani Jayawardena');
      expect(plain(report.querySelector('[data-testid="locked-handover"]')?.textContent)).toBe(
        'Rs. 400.00'
      );
      expect(plain(report.querySelector('[data-testid="locked-supervisor"]')?.textContent)).toBe(
        'Kamal Silva'
      );
      expect(plain(report.querySelector('[data-testid="locked-bf"]')?.textContent)).toBe(
        'Rs. 500.00'
      );
      expect(plain(report.querySelector('[data-testid="unaccounted"]')?.textContent)).toContain(
        'Rs. 100.00'
      );
      expect(plain(report.querySelector('[data-testid="end-time"]')?.textContent)).toMatch(
        /^21 Sep 2026 \d{2}:\d{2}$/
      );
      expect(Array.from(report.children).map(child => child.getAttribute('data-testid'))).toEqual([
        'column-summary',
        'column-count',
        'column-reconciliation',
      ]);
      expect(element.querySelector('#counter-counted')).toBeNull();
      expect(report.querySelector('input, select, textarea, button')).toBeNull();
      expect(complete()).toBeUndefined();
    });

    it('goes back from the confirmation without closing', async () => {
      const { fixture, element, type, complete, button } = await render();
      type('1000');
      complete().click();
      fixture.detectChanges();
      button('Go back').click();
      fixture.detectChanges();
      expect(element.textContent).not.toContain('Close the counter for today?');
      expect((await TestBed.inject(PosCounterService).preview()).report).toBeNull();
    });

    it('shows a closed day as a locked report that can be printed, with no Complete button', async () => {
      await signInAs(UserRole.CASHIER);
      await TestBed.inject(PosCounterService).close(counterCloseInput('0', { note: 'noted' }));
      const fixture = TestBed.createComponent(CounterCloseDialogComponent);
      const printed: CounterReport[] = [];
      fixture.componentInstance.printRequested.subscribe(item => printed.push(item));
      fixture.componentRef.setInput('open', true);
      await settle(fixture);
      const element = fixture.nativeElement as HTMLElement;
      expect(element.textContent).toContain('closed and locked');
      expect(element.textContent).not.toContain('Complete Counter Close');
      expect(element.querySelector('#counter-complete-hint')).toBeNull();
      const print = Array.from(element.querySelectorAll('button')).find(
        candidate => candidate.textContent?.trim() === 'Print report'
      )!;
      print.click();
      expect(printed).toHaveSize(1);
      expect(printed[0].note).toBe('noted');
    });
  });

  describe('unsaved and held bills', () => {
    it('warns about an unsaved bill and counts held bills without stopping the close', async () => {
      const { element, type, complete } = await render({ unsavedBill: true, held: true });
      expect(element.textContent).toContain('A bill is still open on the till');
      expect(element.textContent).toContain('1 bill(s) are on hold');
      type('1000');
      expect(complete().disabled).toBeFalse();
    });
  });

  describe('counting notes and coins', () => {
    const denominationDialog = (element: HTMLElement) =>
      element.querySelector('app-denomination-dialog dialog') as HTMLDialogElement;
    const countInput = (element: HTMLElement, label: string) =>
      element.querySelector(`input[aria-label="${label} count"]`) as HTMLInputElement;
    const enter = (fixture: { detectChanges(): void }, input: HTMLInputElement, value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };

    it('opens a dialog from the calculator button', async () => {
      const { fixture, element, calculator } = await render();
      expect(denominationDialog(element).open).toBeFalse();
      calculator().click();
      await settle(fixture);
      expect(denominationDialog(element).open).toBeTrue();
    });

    it('fills the counted cash with the total when confirmed and updates the reconciliation', async () => {
      const { fixture, element, calculator, field, button } = await render();
      calculator().click();
      await settle(fixture);
      enter(fixture, countInput(element, 'Rs. 1,000 note'), '1');
      enter(fixture, countInput(element, 'Rs. 5 coin'), '2');
      button('Use this total').click();
      await settle(fixture);
      expect(field('counter-counted').value).toBe('1010.00');
      expect(denominationDialog(element).open).toBeFalse();
      expect(element.querySelector('[data-testid="counter-difference"]')?.textContent).toContain(
        'Balanced'
      );
    });

    it('leaves the counted cash unchanged when cancelled', async () => {
      const { fixture, element, calculator, field, type, button } = await render();
      type('777');
      calculator().click();
      await settle(fixture);
      enter(fixture, countInput(element, 'Rs. 100 note'), '3');
      button('Cancel').click();
      await settle(fixture);
      expect(field('counter-counted').value).toBe('777');
      expect(denominationDialog(element).open).toBeFalse();
    });

    it('moves focus into the dialog, closes with Escape and returns focus to the calculator button', async () => {
      const { fixture, element, calculator } = await render();
      calculator().focus();
      calculator().click();
      await settle(fixture);
      const dialog = denominationDialog(element);
      expect(dialog.contains(document.activeElement)).toBeTrue();
      dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
      await settle(fixture);
      expect(dialog.open).toBeFalse();
      expect(document.activeElement).toBe(calculator());
    });

    it('refuses a negative or fractional count with a message and keeps the dialog open', async () => {
      const { fixture, element, calculator, field, button } = await render();
      calculator().click();
      await settle(fixture);
      enter(fixture, countInput(element, 'Rs. 50 note'), '-2');
      button('Use this total').click();
      await settle(fixture);
      expect(denominationDialog(element).open).toBeTrue();
      expect(element.querySelector('#dd-error-50')?.textContent).toContain('whole number');
      expect(field('counter-counted').value).toBe('');
    });
  });
});
