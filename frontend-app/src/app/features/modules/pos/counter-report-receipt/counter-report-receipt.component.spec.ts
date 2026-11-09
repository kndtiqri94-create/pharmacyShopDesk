import { TestBed } from '@angular/core/testing';
import { TEST_PROVIDERS, clearBrowserStorage } from '../../../../../testing/auth-test.util';
import { settle, testCounterReport } from '../../../../../testing/pos-test.util';
import { CounterReport } from '../../../../core/models/domain/counter-report.model';
import { CounterReportReceiptComponent } from './counter-report-receipt.component';

const report: CounterReport = testCounterReport({
  date: '2026-09-21',
  openingCents: 100_000,
  cashInCents: 50_000,
  cashOutCents: 10_000,
  expectedCents: 140_000,
  countedCents: 139_000,
  differenceCents: -1000,
  totalSalesCents: 62_500,
  handoverCents: 30_000,
  supervisorUserId: 'usr-002',
  supervisorName: 'Kamal Silva',
  broughtForwardCents: 100_000,
  unaccountedCents: 9_000,
  note: 'Coins missing',
  closedByUserId: 'usr-004',
  closedBy: 'Ruwani Jayawardena',
  startTime: '2026-09-21T08:05:00',
  endTime: '2026-09-21T18:00:00',
  closedAt: '2026-09-21T18:00:00',
});

describe('CounterReportReceiptComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(() => {
    document.body.classList.remove('sd-printing-receipt');
    clearBrowserStorage();
  });

  async function render(value: CounterReport | null) {
    const fixture = TestBed.createComponent(CounterReportReceiptComponent);
    fixture.componentRef.setInput('report', value);
    await settle(fixture, 0);
    const sheet = fixture.nativeElement.querySelector('.sd-receipt-sheet') as HTMLElement | null;
    return { fixture, text: sheet?.textContent ?? '', sheet };
  }

  it('shows nothing until there is a report', async () => {
    const { sheet } = await render(null);
    expect(sheet).toBeNull();
  });

  it('shows every figure, the difference in words, who closed it and the note', async () => {
    const { text } = await render(report);
    expect(text).toContain('Rs. 1,000');
    expect(text).toContain('Rs. 1,400');
    expect(text).toContain('Rs. 1,390');
    expect(text).toContain('Short');
    expect(text).toContain('Ruwani Jayawardena');
    expect(text).toContain('Coins missing');
  });

  it('shows the handover, supervisor, brought forward balance and the unaccounted cash in words', async () => {
    const { text } = await render(report);
    expect(text).toContain('Cash handed to supervisor');
    expect(text).toContain('Rs. 300.00');
    expect(text).toContain('Kamal Silva');
    expect(text).toContain('Balance brought forward');
    expect(text).toContain('Not accounted for');
    expect(text).toContain('Rs. 90.00');
  });

  it('shows the register, start time, end time and total sales', async () => {
    const { text } = await render(report);
    expect(text).toContain('Counter 1');
    expect(text).toContain('08:05');
    expect(text).toContain('18:00');
    expect(text).toContain('Total Sales');
    expect(text).toContain('Rs. 625.00');
  });

  it('leaves out the supervisor line and the unaccounted line when there is nothing to show', async () => {
    const { text } = await render(
      testCounterReport({ handoverCents: 0, supervisorUserId: null, supervisorName: null })
    );
    expect(text).not.toContain('Supervisor');
    expect(text).not.toContain('Not accounted for');
  });

  it('says there was no activity when there is no start time', async () => {
    const { text } = await render(testCounterReport({ startTime: null }));
    expect(text).toContain('No activity');
  });

  it('has no Reload Commission wording and no Sinhala', async () => {
    const { text } = await render(report);
    expect(text).not.toContain('Reload');
    expect(/[඀-෿]/.test(text)).toBeFalse();
  });
});
