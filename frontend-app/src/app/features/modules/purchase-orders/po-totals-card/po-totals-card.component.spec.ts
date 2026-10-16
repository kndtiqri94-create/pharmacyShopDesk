import { FormControl } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { formatDate } from '../../../../core/utils/date.util';
import { PurchaseOrderTotals } from '../../../../core/utils/purchase-order-totals.util';
import { PoTotalsCardComponent } from './po-totals-card.component';

describe('PoTotalsCardComponent', () => {
  const totals: PurchaseOrderTotals = {
    lineCount: 1,
    unitCount: 20,
    subTotalCents: 100_000,
    deliveryCents: 5_000,
    totalCents: 105_000,
  };

  function render(expectedDate: string, deliveryError: string | null = null): HTMLElement {
    const fixture = TestBed.createComponent(PoTotalsCardComponent);
    fixture.componentRef.setInput('totals', totals);
    fixture.componentRef.setInput('expectedDate', expectedDate);
    fixture.componentRef.setInput('deliveryControl', new FormControl('50', { nonNullable: true }));
    fixture.componentRef.setInput('deliveryError', deliveryError);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function text(element: HTMLElement, testId: string): string {
    const content = element.querySelector(`[data-testid="${testId}"]`)?.textContent ?? '';
    return content.replace(/\s+/g, ' ').trim();
  }

  it('shows the sub-total and total', () => {
    const element = render('');
    expect(text(element, 'totals-subtotal')).toBe('Rs. 1,000');
    expect(text(element, 'totals-total')).toBe('Rs. 1,050');
  });

  it('summarises lines and units with the expected date', () => {
    expect(text(render('2026-09-30'), 'totals-summary')).toBe(
      `1 line · 20 units · Expected ${formatDate('2026-09-30')}`
    );
  });

  it('says the expected date is not set when it is empty', () => {
    expect(text(render(''), 'totals-summary')).toContain('Expected Not set yet');
  });

  it('binds the delivery input and shows its error', () => {
    const element = render('', 'Enter the delivery charge as an amount');
    expect(element.querySelector<HTMLInputElement>('input')?.value).toBe('50');
    expect(element.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'Enter the delivery charge as an amount'
    );
  });
});
