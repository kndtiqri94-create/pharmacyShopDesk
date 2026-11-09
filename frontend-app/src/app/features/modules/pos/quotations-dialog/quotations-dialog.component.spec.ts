import { TestBed } from '@angular/core/testing';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { closeOpenDialogs, settle, testBill } from '../../../../../testing/pos-test.util';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { NotificationService } from '../../../../core/services/notification.service';
import { PosQuotationService } from '../../../../core/services/pos-quotation.service';
import { PosSaleService } from '../../../../core/services/pos-sale.service';
import { QuotationsDialogComponent } from './quotations-dialog.component';

describe('QuotationsDialogComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(() => {
    closeOpenDialogs();
    TestBed.inject(NotificationService).dismiss();
    clearBrowserStorage();
  });

  async function render(count = 2, canChange = true) {
    await signInAs(UserRole.CASHIER);
    for (let index = 0; index < count; index += 1) {
      await TestBed.inject(PosQuotationService).save(testBill());
    }
    const fixture = TestBed.createComponent(QuotationsDialogComponent);
    fixture.componentRef.setInput('canChange', canChange);
    fixture.componentRef.setInput('open', true);
    const converted: string[] = [];
    fixture.componentInstance.convertRequested.subscribe(id => converted.push(id));
    await settle(fixture);
    const element = fixture.nativeElement as HTMLElement;
    const button = (label: string) =>
      element.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
    return { fixture, element, converted, button };
  }

  it('shows an empty message when there are no quotations', async () => {
    const { element } = await render(0);
    expect(element.textContent).toContain('No quotations yet');
  });

  it('lists the number, customer, items, total and status, newest first', async () => {
    const { element } = await render();
    const rows = Array.from(element.querySelectorAll('tbody tr'));
    expect(rows).toHaveSize(2);
    expect(rows[0].textContent).toContain('QUO-0002');
    expect(rows[1].textContent).toContain('QUO-0001');
    expect(rows[0].textContent).toContain('Walk-in Customer');
    expect(rows[0].textContent).toContain('Open');
    expect(rows[0].textContent).toContain('10');
  });

  it('opens a quotation to show its lines as saved', async () => {
    const { fixture, element, button } = await render();
    button('Open QUO-0001').click();
    fixture.detectChanges();
    const detail = element.querySelector('[data-testid="quotation-detail"]')!;
    expect(detail.textContent).toContain('Paracetamol 500mg');
    expect(detail.textContent).toContain('Walk-in Customer');
  });

  it('asks to convert a quotation', async () => {
    const { converted, button } = await render();
    button('Convert QUO-0002 to invoice').click();
    expect(converted).toHaveSize(1);
  });

  it('asks before deleting and then removes it from the list', async () => {
    const { fixture, element, button } = await render();
    button('Delete QUO-0001').click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Delete QUO-0001?');
    const confirm = Array.from(element.querySelectorAll('button:not([aria-label])')).find(
      candidate => candidate.textContent?.trim() === 'Delete'
    ) as HTMLButtonElement;
    confirm.click();
    await settle(fixture);
    expect(element.textContent).not.toContain('QUO-0001');
    expect(element.textContent).toContain('QUO-0002');
  });

  it('cannot convert or delete a converted quotation', async () => {
    const { fixture, element, button } = await render(1);
    const [saved] = await TestBed.inject(PosQuotationService).list();
    await TestBed.inject(PosSaleService).save(testBill(), {
      id: saved.id,
      quotationNo: saved.quotationNo,
    });
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', true);
    await settle(fixture);
    expect(element.textContent).toContain('Converted');
    expect(button('Convert QUO-0001 to invoice').disabled).toBeTrue();
    expect(button('Delete QUO-0001').disabled).toBeTrue();
  });

  it('turns the actions off for a user who cannot sell', async () => {
    const { button } = await render(1, false);
    expect(button('Convert QUO-0001 to invoice').disabled).toBeTrue();
    expect(button('Delete QUO-0001').disabled).toBeTrue();
    expect(button('Open QUO-0001').disabled).toBeFalse();
  });
});
