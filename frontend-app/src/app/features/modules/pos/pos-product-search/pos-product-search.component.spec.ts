import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { ProductDataService } from '../../../../core/services/data/product-data.service';
import { RoleDataService } from '../../../../core/services/data/role-data.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { PosService } from '../../../../core/services/pos.service';
import { PosProductSearchComponent } from './pos-product-search.component';

describe('PosProductSearchComponent', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
    TestBed.inject(NotificationService).dismiss();
    clearBrowserStorage();
  });

  async function render(prepare?: () => Promise<void>) {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    await signInAs(UserRole.CASHIER);
    if (prepare) await prepare();
    const pos = TestBed.inject(PosService);
    await pos.open();
    const fixture = TestBed.createComponent(PosProductSearchComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const box = element.querySelector('#pos-search') as HTMLInputElement;
    const type = (text: string) => {
      box.value = text;
      box.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const enter = () => {
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      fixture.detectChanges();
    };
    const results = () => Array.from(element.querySelectorAll<HTMLButtonElement>('.result'));
    const message = () => TestBed.inject(NotificationService).current()?.message;
    return { fixture, element, box, type, enter, results, message, pos };
  }

  it('lists products that match part of the name, with SKU, price and stock', async () => {
    const { type, results } = await render();
    type('salbu');
    expect(results()).toHaveSize(1);
    const text = results()[0].textContent ?? '';
    expect(text).toContain('Salbutamol Inhaler 100mcg');
    expect(text).toContain('SAL-100');
    expect(text).toContain('Rs. 450.00');
    expect(text).toContain('18 in stock');
  });

  it('finds products by generic name, SKU and barcode', async () => {
    const { type, results } = await render();
    type('amoxicillin');
    expect(results()[0].textContent).toContain('AMX-500');
    type('cet-0');
    expect(results()[0].textContent).toContain('Cetirizine 10mg');
    type('4791000000011');
    expect(results()[0].textContent).toContain('Paracetamol 500mg');
  });

  it('says so when nothing matches, and shows nothing for an empty box', async () => {
    const { type, results, element } = await render();
    expect(results()).toHaveSize(0);
    type('zzzz-nothing');
    expect(results()).toHaveSize(0);
    expect(element.textContent).toContain('No product matches that.');
  });

  it('adds the picked product at its selling price and clears the box', async () => {
    const { type, results, box, fixture, pos } = await render();
    type('para');
    results()[0].click();
    fixture.detectChanges();
    expect(pos.bill().lines).toHaveSize(1);
    expect(pos.bill().lines[0].unitPriceCents).toBe(250);
    expect(box.value).toBe('');
    expect(results()).toHaveSize(0);
  });

  it('adds a second unit instead of a second line when the same product is picked again', async () => {
    const { type, results, fixture, pos } = await render();
    type('para');
    results()[0].click();
    type('para');
    results()[0].click();
    fixture.detectChanges();
    expect(pos.bill().lines).toHaveSize(1);
    expect(pos.bill().lines[0].quantity).toBe(2);
  });

  describe('scan-style Enter', () => {
    it('adds the product for an exact barcode without any selection', async () => {
      const { type, enter, pos } = await render();
      type('4791000000028');
      enter();
      expect(pos.bill().lines.map(line => line.productId)).toEqual(['prod-002']);
    });

    it('adds the product for an exact SKU in any letter case', async () => {
      const { type, enter, pos } = await render();
      type('amx-500');
      enter();
      expect(pos.bill().lines.map(line => line.productId)).toEqual(['prod-002']);
    });

    it('adds the only match when a partial search has one result', async () => {
      const { type, enter, pos } = await render();
      type('salbu');
      enter();
      expect(pos.bill().lines.map(line => line.productId)).toEqual(['prod-007']);
    });

    it('asks you to choose when there are several matches', async () => {
      const { type, enter, pos, message } = await render();
      type('500');
      enter();
      expect(pos.bill().lines).toHaveSize(0);
      expect(message()).toBe('Choose a product from the list.');
    });

    it('says when nothing matches', async () => {
      const { type, enter, message } = await render();
      type('zzz');
      enter();
      expect(message()).toBe('No product matches "zzz".');
    });

    it('does nothing for an empty box', async () => {
      const { enter, message, pos } = await render();
      enter();
      expect(message()).toBeUndefined();
      expect(pos.bill().lines).toHaveSize(0);
    });
  });

  describe('stock and expiry', () => {
    it('shows an out-of-stock product but cannot add it, and says it is out of stock', async () => {
      const { type, results, enter, pos, message } = await render();
      type('ORS-001');
      expect(results()).toHaveSize(1);
      expect(results()[0].textContent).toContain('Out of stock');
      expect(results()[0].disabled).toBeTrue();
      enter();
      expect(pos.bill().lines).toHaveSize(0);
      expect(message()).toContain('out of stock');
    });

    it('shows a product whose only stock expired as Expired and refuses it', async () => {
      const { type, results, enter, pos, message } = await render(async () => {
        const productDataService = TestBed.inject(ProductDataService);
        const fresh = (await firstValueFrom(productDataService.getById('prod-002')))!;
        await firstValueFrom(
          productDataService.save({
            ...fresh,
            batches: fresh.batches.map(batch => ({ ...batch, expiryDate: '2026-08-31' })),
          })
        );
      });
      type('AMX-500');
      expect(results()[0].textContent).toContain('Expired');
      expect(results()[0].disabled).toBeTrue();
      enter();
      expect(pos.bill().lines).toHaveSize(0);
      expect(message()).toContain('expired');
    });

    it('stops at the stock limit with a message naming the amount', async () => {
      const { type, results, fixture, pos, message } = await render();
      for (let count = 0; count < 19; count += 1) {
        type('salbu');
        results()[0].click();
        fixture.detectChanges();
      }
      expect(pos.bill().lines[0].quantity).toBe(18);
      expect(message()).toBe('Only 18 available for Salbutamol Inhaler 100mcg.');
    });
  });

  it('limits how much can be typed', async () => {
    const { box } = await render();
    expect(box.getAttribute('maxlength')).toBe('60');
  });

  it('does not break on a very long search', async () => {
    const { type, results } = await render();
    type('x'.repeat(500));
    expect(results()).toHaveSize(0);
  });

  it('cannot be used by someone who cannot sell', async () => {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    await signInAs(UserRole.CASHIER);
    await TestBed.inject(PermissionService).load();
    const roleDataService = TestBed.inject(RoleDataService);
    const matrix = await firstValueFrom(roleDataService.getMatrix());
    await firstValueFrom(
      roleDataService.saveMatrix({ ...matrix, CASHIER: { ...matrix.CASHIER, pos: 'VIEW' } })
    );
    await TestBed.inject(PosService).open();
    const fixture = TestBed.createComponent(PosProductSearchComponent);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement.querySelector('#pos-search') as HTMLInputElement).disabled
    ).toBeTrue();
  });
});
