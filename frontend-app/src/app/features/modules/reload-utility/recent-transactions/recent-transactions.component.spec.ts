import { TestBed } from '@angular/core/testing';
import { ReloadTransaction } from '../../../../core/models/domain/reload-transaction.model';
import { ReloadStatus } from '../../../../core/models/enums/reload-status.enum';
import { ReloadTransactionType } from '../../../../core/models/enums/reload-transaction-type.enum';
import { NotificationService } from '../../../../core/services/notification.service';
import { RecentTransactionsComponent } from './recent-transactions.component';

describe('RecentTransactionsComponent', () => {
  const row = (id: number, overrides: Partial<ReloadTransaction> = {}): ReloadTransaction => ({
    id: `rt-${id}`,
    occurredAt: '2026-09-21T09:12:00',
    provider: 'Dialog',
    type: ReloadTransactionType.RELOAD,
    reference: '077 123 4567',
    amountCents: 50_000,
    commissionCents: 1250,
    status: ReloadStatus.SUCCESS,
    ...overrides,
  });

  function render(transactions: readonly ReloadTransaction[]) {
    const fixture = TestBed.createComponent(RecentTransactionsComponent);
    fixture.componentRef.setInput('transactions', transactions);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => TestBed.inject(NotificationService).dismiss());

  it('shows the title, the six columns and one row per transaction', () => {
    const { element } = render([
      row(1),
      row(2, { provider: 'Internet', type: ReloadTransactionType.BILL_PAYMENT }),
    ]);
    expect(element.querySelector('h2')?.textContent).toBe('Recent transactions');
    expect(Array.from(element.querySelectorAll('th')).map(h => h.textContent?.trim())).toEqual([
      'Time',
      'Provider',
      'Number or account',
      'Amount (Rs.)',
      'Commission (Rs.)',
      'Status',
    ]);
    expect(element.querySelectorAll('tbody tr')).toHaveSize(2);
    const first = element.querySelector('tbody tr')!.textContent!.replace(/\s+/g, ' ');
    expect(first).toContain('09:12');
    expect(first).toContain('Dialog');
    expect(first).toContain('Reload');
    expect(first).toContain('077 123 4567');
    expect(first).toContain('500.00');
    expect(first).toContain('12.50');
    expect(element.querySelectorAll('tbody tr')[1].textContent).toContain('Bill payment');
  });

  it('shows the status in words', () => {
    const { element } = render([
      row(1),
      row(2, { status: ReloadStatus.PENDING }),
      row(3, { status: ReloadStatus.FAILED }),
    ]);
    const words = Array.from(element.querySelectorAll('app-badge')).map(b => b.textContent?.trim());
    expect(words).toEqual(['Success', 'Pending', 'Failed']);
  });

  it('shows the empty message when there are no transactions', () => {
    const { element } = render([]);
    expect(element.textContent).toContain('No transactions yet');
    expect(element.querySelector('table')).toBeNull();
  });

  it('answers Export with a sample-only message', () => {
    const { element } = render([row(1)]);
    const exportButton = Array.from(element.querySelectorAll('button')).find(
      b => b.textContent?.trim() === 'Export'
    )!;
    exportButton.click();
    expect(TestBed.inject(NotificationService).current()?.message).toBe(
      'Export is sample only for now and does nothing yet.'
    );
  });
});
