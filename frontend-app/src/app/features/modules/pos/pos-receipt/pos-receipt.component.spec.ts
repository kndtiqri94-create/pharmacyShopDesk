import { TestBed } from '@angular/core/testing';
import { TEST_PROVIDERS } from '../../../../../testing/auth-test.util';
import { Sale } from '../../../../core/models/domain/sale.model';
import { PosReceiptComponent } from './pos-receipt.component';

const SALE: Sale = {
  id: 'sale-001',
  invoiceNo: 'INV-0007',
  date: '2026-09-21',
  createdAt: '2026-09-21T10:35:00',
  cashierUserId: 'usr-004',
  cashierName: 'Ruwani Jayawardena',
  customerId: 'cus-002',
  customerName: 'Sunil Rathnayake',
  repId: 'rep-002',
  repName: 'Dilani Fernando',
  lines: [
    {
      productId: 'prod-001',
      sku: 'PAR-500',
      name: 'Paracetamol 500mg',
      barcode: '4791000000011',
      unitPriceCents: 250,
      discountPercent: 10,
      quantity: 4,
      totalCents: 900,
      batchAllocations: [],
    },
  ],
  payments: [
    { method: 'CASH', amountCents: 300, reference: '' },
    { method: 'CARD', amountCents: 200, reference: 'AUTH-77' },
    { method: 'CREDIT', amountCents: 400, reference: '' },
  ],
  subTotalCents: 900,
  discountCents: 0,
  totalCents: 900,
  paidCents: 500,
  creditCents: 400,
  changeCents: 0,
  profitCents: 200,
  discountApprovals: [
    {
      scope: 'LINE',
      productId: 'prod-001',
      percent: 10,
      approverUserId: 'usr-001',
      approverName: 'Nimal Perera',
      approvedAt: '2026-09-21T10:30:00',
    },
  ],
};

describe('PosReceiptComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: TEST_PROVIDERS }));

  afterEach(() => document.body.classList.remove('sd-printing-receipt'));

  function render(sale: Sale | null = SALE) {
    const fixture = TestBed.createComponent(PosReceiptComponent);
    fixture.componentRef.setInput('sale', sale);
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => (closed += 1));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const totals = () =>
      Object.fromEntries(
        Array.from(element.querySelectorAll('.receipt__totals > div')).map(row => [
          row.querySelector('dt')?.textContent?.replace(/\s+/g, ' ').trim(),
          row.querySelector('dd')?.textContent?.trim(),
        ])
      );
    return { fixture, element, closed: () => closed, totals };
  }

  it('shows nothing until there is a saved sale', () => {
    const { element } = render(null);
    expect(element.querySelector('.sd-receipt-sheet')).toBeNull();
    expect(document.body.classList).not.toContain('sd-printing-receipt');
  });

  it('shows the invoice number, items, discount, total and payments', () => {
    const { element, totals } = render();
    const text = element.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(element.querySelector('[data-testid="receipt-invoice"]')?.textContent).toBe('INV-0007');
    expect(text).toContain('Paracetamol 500mg');
    expect(totals()).toEqual({
      'Sub total': 'Rs. 9.00',
      Discount: 'Rs. 0.00',
      Total: 'Rs. 9.00',
      Cash: 'Rs. 3.00',
      'Card (AUTH-77)': 'Rs. 2.00',
      Credit: 'Rs. 4.00',
      'Credit due': 'Rs. 4.00',
    });
    expect(text).toContain('Sunil Rathnayake');
    expect(text).toContain('Ruwani Jayawardena');
    expect(text).toContain('21 Sep 2026 10:35');
  });

  it('shows the shop name from Settings', async () => {
    const { fixture, element } = render();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector('h2')?.textContent).toContain('ShopDesk');
  });

  it('shows Change when the customer gave more cash than the total', () => {
    const { totals } = render({
      ...SALE,
      payments: [{ method: 'CASH', amountCents: 1000, reference: '' }],
      paidCents: 1000,
      creditCents: 0,
      changeCents: 100,
    });
    expect(totals()['Change']).toBe('Rs. 1.00');
    expect(Object.keys(totals())).not.toContain('Credit due');
  });

  it('does not show who approved a discount on the customer copy', () => {
    const { element } = render();
    expect(element.textContent).not.toContain('Nimal Perera');
    expect(element.textContent).not.toContain('approved');
  });

  describe('printing', () => {
    it('prints through the browser without opening or writing another window', () => {
      const print = spyOn(window, 'print');
      const open = spyOn(window, 'open');
      const { element } = render();
      const button = Array.from(element.querySelectorAll('button')).find(candidate =>
        candidate.textContent?.includes('Print receipt')
      )!;
      button.click();
      expect(print).toHaveBeenCalledTimes(1);
      expect(open).not.toHaveBeenCalled();
    });

    it('marks the page for the print stylesheet only while the receipt is open', () => {
      const { fixture } = render();
      expect(document.body.classList).toContain('sd-printing-receipt');
      fixture.componentRef.setInput('sale', null);
      fixture.detectChanges();
      expect(document.body.classList).not.toContain('sd-printing-receipt');
    });

    it('removes the mark when it is destroyed', () => {
      const { fixture } = render();
      fixture.destroy();
      expect(document.body.classList).not.toContain('sd-printing-receipt');
    });
  });

  describe('closing', () => {
    it('closes from the Close button', () => {
      const { element, closed } = render();
      const close = Array.from(element.querySelectorAll('button')).find(
        candidate => candidate.textContent?.trim() === 'Close'
      )!;
      close.click();
      expect(closed()).toBe(1);
    });

    it('closes with Esc', () => {
      const { element, closed } = render();
      element
        .querySelector('.sd-receipt-overlay')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(closed()).toBe(1);
    });

    it('is a labelled modal dialog', () => {
      const { element } = render();
      const overlay = element.querySelector('.sd-receipt-overlay') as HTMLElement;
      expect(overlay.getAttribute('role')).toBe('dialog');
      expect(overlay.getAttribute('aria-modal')).toBe('true');
      expect(overlay.getAttribute('aria-labelledby')).toBe(element.querySelector('h2')?.id ?? '');
    });
  });
});
