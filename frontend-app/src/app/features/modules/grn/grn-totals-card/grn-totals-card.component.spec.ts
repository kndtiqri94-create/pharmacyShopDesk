import { FormControl } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { GrnTotals } from '../../../../core/utils/grn-totals.util';
import { GrnTotalsCardComponent } from './grn-totals-card.component';

describe('GrnTotalsCardComponent', () => {
  const totals: GrnTotals = {
    lineCount: 2,
    unitCount: 15,
    subTotalCents: 150_000,
    discountCents: 10_000,
    totalCents: 140_000,
    paidCents: 40_000,
    balanceCents: 100_000,
  };

  function render(discountError: string | null = null): HTMLElement {
    const fixture = TestBed.createComponent(GrnTotalsCardComponent);
    fixture.componentRef.setInput('totals', totals);
    fixture.componentRef.setInput('discountControl', new FormControl('100', { nonNullable: true }));
    fixture.componentRef.setInput('discountError', discountError);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function text(element: HTMLElement, testId: string): string {
    return element.querySelector(`[data-testid="${testId}"]`)?.textContent?.trim() ?? '';
  }

  it('summarises the lines and units', () => {
    expect(text(render(), 'totals-summary')).toBe('2 lines · 15 units');
  });

  it('shows the total and the balance due after payment', () => {
    const element = render();
    expect(text(element, 'totals-total')).toBe('Rs. 1,400');
    expect(text(element, 'totals-balance')).toBe('Rs. 1,000');
  });

  it('binds the discount input to its control', () => {
    expect(render().querySelector<HTMLInputElement>('input')?.value).toBe('100');
  });

  it('shows the discount error', () => {
    const element = render('Enter the discount as an amount');
    expect(element.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'Enter the discount as an amount'
    );
  });
});
