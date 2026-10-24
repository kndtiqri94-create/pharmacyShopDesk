import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { SettingsDataService } from '../../../../core/services/data/settings-data.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PosService } from '../../../../core/services/pos.service';
import { PendingApproval } from '../pending-approval.model';
import { PosBillLinesComponent } from './pos-bill-lines.component';

describe('PosBillLinesComponent', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
    TestBed.inject(NotificationService).dismiss();
    clearBrowserStorage();
  });

  async function render(options: { lineDiscountOff?: boolean } = {}) {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    await signInAs(UserRole.CASHIER);
    if (options.lineDiscountOff) {
      const settingsDataService = TestBed.inject(SettingsDataService);
      const current = await firstValueFrom(settingsDataService.get());
      await firstValueFrom(settingsDataService.save({ ...current, posLineDiscountEnabled: false }));
    }
    const pos = TestBed.inject(PosService);
    await pos.open();
    pos.addProduct('prod-001');
    pos.addProduct('prod-007');
    const fixture = TestBed.createComponent(PosBillLinesComponent);
    const approvals: PendingApproval[] = [];
    fixture.componentInstance.approvalRequested.subscribe(request => approvals.push(request));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const rows = () => Array.from(element.querySelectorAll('tbody tr'));
    const input = (row: number, label: string) =>
      rows()[row].querySelector<HTMLInputElement>(`input[aria-label^="${label}"]`)!;
    const change = (target: HTMLInputElement, value: string) => {
      target.value = value;
      target.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    const message = () => TestBed.inject(NotificationService).current()?.message;
    return { fixture, element, rows, input, change, approvals, pos, message };
  }

  it('shows exactly the columns S/N, SKU, Rep, Barcode, Sale Price, Discount %, QTY, Action and Total', async () => {
    const { element } = await render();
    const headers = Array.from(element.querySelectorAll('thead th')).map(cell =>
      cell.textContent?.replace(/\s+/g, ' ').trim()
    );
    expect(headers).toEqual([
      'S/N',
      'SKU',
      'Rep',
      'Barcode',
      'Sale Price (Rs.)',
      'Discount %',
      'QTY',
      'Action',
      'Total (Rs.)',
    ]);
  });

  it('shows each line with its serial number, codes, price and total to two decimals, right-aligned', async () => {
    const { rows } = await render();
    const first = Array.from(rows()[0].querySelectorAll('td'));
    expect(first[0].textContent?.trim()).toBe('1');
    expect(first[1].textContent?.trim()).toBe('PAR-500');
    expect(first[2].textContent?.trim()).toBe('–');
    expect(first[3].textContent?.trim()).toBe('4791000000011');
    expect(first[4].textContent?.trim()).toBe('2.50');
    expect(first[4].classList).toContain('is-right');
    expect(first[8].textContent?.trim()).toBe('2.50');
    expect(first[8].classList).toContain('is-right');
    expect(rows()[1].querySelectorAll('td')[0].textContent?.trim()).toBe('2');
    expect(rows()[1].querySelectorAll('td')[8].textContent?.trim()).toBe('450.00');
  });

  it('shows the rep recorded on the bill', async () => {
    const { fixture, rows, pos } = await render();
    pos.setRep('rep-001');
    fixture.detectChanges();
    expect(rows()[0].querySelectorAll('td')[2].textContent?.trim()).toBe('Kamal Silva');
  });

  it('says what to do when there are no items', async () => {
    const { fixture, element, pos } = await render();
    pos.removeLine('prod-001');
    pos.removeLine('prod-007');
    fixture.detectChanges();
    expect(element.textContent).toContain('No items yet');
    expect(element.textContent).toContain('Search for a product or scan a barcode');
  });

  it('scrolls sideways instead of cutting columns off', async () => {
    const { element } = await render();
    expect(element.querySelector('.sd-scroll-x')).not.toBeNull();
  });

  describe('quantity', () => {
    it('updates the line total and the bill totals straight away', async () => {
      const { fixture, input, change, rows, pos } = await render();
      change(input(0, 'Quantity of'), '4');
      fixture.detectChanges();
      expect(pos.bill().lines[0].quantity).toBe(4);
      expect(rows()[0].querySelectorAll('td')[8].textContent?.trim()).toBe('10.00');
      expect(pos.totals().subTotalCents).toBe(1000 + 45_000);
    });

    it('refuses a quantity above the stock, names the amount and puts the old number back', async () => {
      const { input, change, pos, message } = await render();
      change(input(1, 'Quantity of'), '19');
      expect(message()).toContain('Only 18 available');
      expect(pos.bill().lines[1].quantity).toBe(1);
      expect(input(1, 'Quantity of').value).toBe('1');
    });

    it('refuses quantities that are not whole numbers from 1', async () => {
      const { input, change, pos, message } = await render();
      for (const text of ['0', '-2', '1.5', 'abc', '']) {
        change(input(0, 'Quantity of'), text);
        expect(message()).withContext(text).toContain('whole quantity');
        expect(input(0, 'Quantity of').value).toBe('1');
      }
      expect(pos.bill().lines[0].quantity).toBe(1);
    });

    it('limits how much can be typed', async () => {
      const { input } = await render();
      expect(input(0, 'Quantity of').getAttribute('maxlength')).toBe('5');
    });
  });

  describe('remove', () => {
    it('removes a line and the totals follow', async () => {
      const { fixture, rows, pos, element } = await render();
      const remove = element.querySelector('button[aria-label="Remove Paracetamol 500mg"]');
      (remove as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(rows()).toHaveSize(1);
      expect(pos.bill().lines.map(line => line.productId)).toEqual(['prod-007']);
      expect(pos.totals().totalCents).toBe(45_000);
    });

    it('uses an extra large button with a visible word', async () => {
      const { element } = await render();
      const remove = element.querySelector('button[aria-label^="Remove"]') as HTMLButtonElement;
      expect(remove.getAttribute('data-size')).toBe('xl');
      expect(remove.textContent).toContain('Remove');
    });
  });

  describe('line discount', () => {
    it('starts every line at the Settings default', async () => {
      const { input } = await render();
      expect(input(0, 'Discount percent').value).toBe('0');
      expect(input(1, 'Discount percent').value).toBe('0');
      expect(input(0, 'Discount percent').disabled).toBeFalse();
    });

    it('opens the approval flow for a value other than the default and keeps the old value until approved', async () => {
      const { input, change, approvals, pos } = await render();
      change(input(0, 'Discount percent'), '10');
      expect(approvals).toEqual([
        {
          request: { scope: 'LINE', productId: 'prod-001', percent: 10 },
          billInput: null,
        },
      ]);
      expect(pos.bill().lines[0].discountPercent).toBe(0);
      expect(input(0, 'Discount percent').value).toBe('0');
    });

    it('refuses a value above the maximum with a message and no approval request', async () => {
      const { input, change, approvals, message } = await render();
      change(input(0, 'Discount percent'), '25');
      expect(approvals).toHaveSize(0);
      expect(message()).toContain('20%');
      expect(input(0, 'Discount percent').value).toBe('0');
    });

    it('needs no approval for the default value', async () => {
      const { input, change, approvals } = await render();
      change(input(0, 'Discount percent'), '0');
      expect(approvals).toHaveSize(0);
    });

    it('cannot be edited when line discount is off in Settings', async () => {
      const { input } = await render({ lineDiscountOff: true });
      expect(input(0, 'Discount percent').disabled).toBeTrue();
      expect(input(1, 'Discount percent').disabled).toBeTrue();
    });

    it('limits how much can be typed', async () => {
      const { input } = await render();
      expect(input(0, 'Discount percent').getAttribute('maxlength')).toBe('6');
    });
  });
});
