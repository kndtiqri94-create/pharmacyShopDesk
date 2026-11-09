import { TestBed } from '@angular/core/testing';
import { TEST_PROVIDERS, clearBrowserStorage } from '../../../../../testing/auth-test.util';
import { settle } from '../../../../../testing/pos-test.util';
import { DuePayment } from '../../../../core/models/domain/due-payment.model';
import { SalePaymentMethod } from '../../../../core/models/enums/sale-payment-method.enum';
import { DuePaymentReceiptComponent } from './due-payment-receipt.component';

const payment: DuePayment = {
  id: 'dpay-001',
  receiptNo: 'RCP-0001',
  customerId: 'cus-002',
  customerName: 'Sunil Rathnayake',
  amountCents: 125_000,
  method: SalePaymentMethod.CARD,
  reference: 'AB12',
  createdAt: '2026-09-21T12:30:00',
  takenByUserId: 'usr-004',
  takenBy: 'Ruwani Jayawardena',
};

describe('DuePaymentReceiptComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(() => {
    document.body.classList.remove('sd-printing-receipt');
    clearBrowserStorage();
  });

  it('shows nothing until there is a payment', async () => {
    const fixture = TestBed.createComponent(DuePaymentReceiptComponent);
    await settle(fixture, 0);
    expect(fixture.nativeElement.querySelector('.sd-receipt-sheet')).toBeNull();
  });

  it('shows the receipt number, customer, method, reference and amount', async () => {
    const fixture = TestBed.createComponent(DuePaymentReceiptComponent);
    fixture.componentRef.setInput('payment', payment);
    await settle(fixture, 0);
    const text = fixture.nativeElement.querySelector('.sd-receipt-sheet').textContent as string;
    expect(text).toContain('RCP-0001');
    expect(text).toContain('Sunil Rathnayake');
    expect(text).toContain('Card');
    expect(text).toContain('AB12');
    expect(text).toContain('Rs. 1,250');
    expect(text).toContain('Ruwani Jayawardena');
  });
});
