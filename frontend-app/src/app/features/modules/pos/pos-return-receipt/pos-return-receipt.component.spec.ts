import { TestBed } from '@angular/core/testing';
import { TEST_PROVIDERS, clearBrowserStorage } from '../../../../../testing/auth-test.util';
import { settle, testReturn } from '../../../../../testing/pos-test.util';
import { ReturnSettlement } from '../../../../core/models/enums/return-settlement.enum';
import { PosReturnReceiptComponent } from './pos-return-receipt.component';

describe('PosReturnReceiptComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(() => {
    document.body.classList.remove('sd-printing-receipt');
    clearBrowserStorage();
  });

  it('shows nothing until there is a return', async () => {
    const fixture = TestBed.createComponent(PosReturnReceiptComponent);
    await settle(fixture, 0);
    expect(fixture.nativeElement.querySelector('.sd-receipt-sheet')).toBeNull();
    expect(document.body.classList.contains('sd-printing-receipt')).toBeFalse();
  });

  it('shows the returned items, amount, refund and numbers', async () => {
    const fixture = TestBed.createComponent(PosReturnReceiptComponent);
    fixture.componentRef.setInput('saleReturn', testReturn());
    await settle(fixture, 0);
    const text = fixture.nativeElement.querySelector('.sd-receipt-sheet').textContent as string;
    expect(text).toContain('RET-0001');
    expect(text).toContain('INV-0001');
    expect(text).toContain('Paracetamol 500mg');
    expect(text).toContain('Rs. 5');
    expect(text).toContain('Cash refund');
    expect(text).toContain('Ruwani Jayawardena');
    expect(document.body.classList.contains('sd-printing-receipt')).toBeTrue();
  });

  it('shows customer credit when that was chosen', async () => {
    const fixture = TestBed.createComponent(PosReturnReceiptComponent);
    fixture.componentRef.setInput(
      'saleReturn',
      testReturn({ settlement: ReturnSettlement.CUSTOMER_CREDIT, customerName: 'Sunil Rathnayake' })
    );
    await settle(fixture, 0);
    expect(fixture.nativeElement.textContent).toContain('Customer credit');
  });

  it('prints with the browser and closes without writing a new document', async () => {
    const fixture = TestBed.createComponent(PosReturnReceiptComponent);
    fixture.componentRef.setInput('saleReturn', testReturn());
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => (closed += 1));
    await settle(fixture, 0);
    const print = spyOn(window, 'print');
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    ) as HTMLButtonElement[];
    buttons.find(button => button.textContent?.includes('Print'))!.click();
    expect(print).toHaveBeenCalled();
    buttons.find(button => button.textContent?.trim() === 'Close')!.click();
    expect(closed).toBe(1);
  });
});
