import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import {
  TEST_TODAY,
  closeOpenDialogs,
  counterCloseInput,
  settle,
  testCounterReport,
} from '../../../../../testing/pos-test.util';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { SalesDataService } from '../../../../core/services/data/sales-data.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PosCashService } from '../../../../core/services/pos-cash.service';
import { PosCounterService } from '../../../../core/services/pos-counter.service';
import { AddObDialogComponent } from './add-ob-dialog.component';

describe('AddObDialogComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(() => {
    closeOpenDialogs();
    TestBed.inject(NotificationService).dismiss();
    clearBrowserStorage();
  });

  async function render(existing?: string) {
    await signInAs(UserRole.CASHIER);
    if (existing) await TestBed.inject(PosCashService).saveOpening(existing, false);
    const fixture = TestBed.createComponent(AddObDialogComponent);
    fixture.componentRef.setInput('open', true);
    await settle(fixture);
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector('#add-ob-amount') as HTMLInputElement;
    const type = (value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const button = (label: string) =>
      Array.from(element.querySelectorAll('button')).find(
        candidate => candidate.textContent?.trim() === label
      )!;
    return { fixture, element, input, type, button };
  }

  it('saves the first opening balance of the day', async () => {
    const { fixture, type, button } = await render();
    type('5000');
    button('Save balance').click();
    await settle(fixture);
    const status = await TestBed.inject(PosCashService).status(TEST_TODAY);
    expect(status.opening?.amountCents).toBe(500_000);
    expect(TestBed.inject(NotificationService).current()?.message).toBe('Opening balance saved.');
  });

  it('refuses a negative or non numeric balance with a message', async () => {
    const { fixture, element, type, button } = await render();
    for (const bad of ['-5', 'abc', '']) {
      type(bad);
      button('Save balance').click();
      await settle(fixture);
      expect(element.querySelector('.field__error')).not.toBeNull();
    }
    expect((await TestBed.inject(PosCashService).status(TEST_TODAY)).opening).toBeNull();
  });

  it('shows an existing balance and asks before changing it', async () => {
    const { fixture, element, input, type, button } = await render('5000');
    expect(element.querySelector('[data-testid="existing-opening"]')?.textContent).toContain(
      '5,000'
    );
    expect(input.value).toBe('5000.00');
    type('6000');
    button('Change balance').click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Replace the opening balance?');
    expect((await TestBed.inject(PosCashService).status(TEST_TODAY)).opening?.amountCents).toBe(
      500_000
    );
    const confirm = Array.from(element.querySelectorAll('button')).filter(
      candidate => candidate.textContent?.trim() === 'Change balance'
    )[0];
    confirm.click();
    await settle(fixture);
    const status = await TestBed.inject(PosCashService).status(TEST_TODAY);
    expect(status.opening?.amountCents).toBe(600_000);
    expect(status.opening?.changeLog).toHaveSize(1);
  });

  it('is locked once the counter is closed', async () => {
    await signInAs(UserRole.CASHIER);
    await TestBed.inject(PosCounterService).close(counterCloseInput('0'));
    const fixture = TestBed.createComponent(AddObDialogComponent);
    fixture.componentRef.setInput('open', true);
    await settle(fixture);
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Today is locked');
    expect((element.querySelector('#add-ob-amount') as HTMLInputElement).disabled).toBeTrue();
  });

  describe('brought forward from the last closed day', () => {
    const closePreviousDay = (broughtForwardCents: number) =>
      firstValueFrom(
        TestBed.inject(SalesDataService).saveCounterReport(
          testCounterReport({ date: '2026-09-20', broughtForwardCents })
        )
      );

    it('pre-fills the amount and says where it came from', async () => {
      await closePreviousDay(250_000);
      const { element, input } = await render();
      expect(input.value).toBe('2500.00');
      const source = element.querySelector('[data-testid="ob-source"]')!;
      expect(source.textContent).toContain('Brought forward from 20 Sep 2026 counter close');
    });

    it('lets the user change the pre-filled amount and saves it', async () => {
      await closePreviousDay(250_000);
      const { fixture, type, button } = await render();
      type('3000');
      button('Save balance').click();
      await settle(fixture);
      const status = await TestBed.inject(PosCashService).status(TEST_TODAY);
      expect(status.opening?.amountCents).toBe(300_000);
    });

    it('leaves the closed day report as it was', async () => {
      await closePreviousDay(250_000);
      const { fixture, type, button } = await render();
      type('1');
      button('Save balance').click();
      await settle(fixture);
      const closed = await firstValueFrom(
        TestBed.inject(SalesDataService).getCounterReport('2026-09-20')
      );
      expect(closed?.broughtForwardCents).toBe(250_000);
    });

    it('shows no source text and a blank amount when no day was closed before', async () => {
      const { element, input } = await render();
      expect(input.value).toBe('');
      expect(element.querySelector('[data-testid="ob-source"]')).toBeNull();
    });

    it('stops showing the source once an opening balance is saved for today', async () => {
      await closePreviousDay(250_000);
      const { element } = await render('100');
      expect(element.querySelector('[data-testid="ob-source"]')).toBeNull();
    });
  });
});
