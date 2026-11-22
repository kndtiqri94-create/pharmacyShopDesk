import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { closeOpenDialogs, settle } from '../../../../../testing/pos-test.util';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { ProductDataService } from '../../../../core/services/data/product-data.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { getStockOnHand } from '../../../../core/utils/stock-status.util';
import { UpdateProductsDialogComponent } from './update-products-dialog.component';

describe('UpdateProductsDialogComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(() => {
    closeOpenDialogs();
    TestBed.inject(NotificationService).dismiss();
    clearBrowserStorage();
  });

  async function render(canChange = true) {
    await signInAs(UserRole.CASHIER);
    const fixture = TestBed.createComponent(UpdateProductsDialogComponent);
    let updates = 0;
    fixture.componentInstance.productUpdated.subscribe(() => (updates += 1));
    fixture.componentRef.setInput('canChange', canChange);
    fixture.componentRef.setInput('open', true);
    await settle(fixture);
    const element = fixture.nativeElement as HTMLElement;
    const type = (id: string, value: string) => {
      const input = element.querySelector(`#${id}`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    const button = (label: string) =>
      Array.from(element.querySelectorAll('button')).find(
        candidate => candidate.textContent?.trim() === label
      )!;
    const edit = async (query: string, name: string) => {
      type('update-search', query);
      await settle(fixture);
      (element.querySelector(`button[aria-label="Edit ${name}"]`) as HTMLButtonElement).click();
      fixture.detectChanges();
    };
    const product = async () =>
      (await firstValueFrom(TestBed.inject(ProductDataService).getById('prod-001')))!;
    return { fixture, element, type, button, edit, product, updates: () => updates };
  }

  it('finds a product by SKU and shows its current price and stock to edit', async () => {
    const { element, edit } = await render();
    await edit('PAR-500', 'Paracetamol 500mg');
    expect((element.querySelector('#update-price') as HTMLInputElement).value).toBe('2.50');
    expect((element.querySelector('#update-stock') as HTMLInputElement).value).toBe('3600');
  });

  it('shows old and new values before saving, and changes nothing until confirmed', async () => {
    const { fixture, element, type, button, edit, product } = await render();
    await edit('PAR-500', 'Paracetamol 500mg');
    type('update-price', '3');
    type('update-stock', '3000');
    button('Review change').click();
    fixture.detectChanges();
    const confirm = element.querySelector('[data-testid="update-confirm"]')!;
    expect(confirm.textContent).toContain('Rs. 2.50 to Rs. 3');
    expect(confirm.textContent).toContain('3600 to 3000');
    expect((await product()).priceCents).toBe(250);
  });

  it('saves after confirmation and tells the till so it can re-check the bill', async () => {
    const { fixture, type, button, edit, product, updates } = await render();
    await edit('PAR-500', 'Paracetamol 500mg');
    type('update-price', '3');
    button('Review change').click();
    fixture.detectChanges();
    button('Save change').click();
    await settle(fixture);
    expect((await product()).priceCents).toBe(300);
    expect(getStockOnHand(await product())).toBe(3600);
    expect(updates()).toBe(1);
  });

  it('refuses a negative price or a fractional stock figure with a message', async () => {
    const { fixture, element, type, button, edit, product } = await render();
    await edit('PAR-500', 'Paracetamol 500mg');
    type('update-price', '-1');
    button('Review change').click();
    fixture.detectChanges();
    expect(element.querySelector('.field__error')).not.toBeNull();
    type('update-price', '3');
    type('update-stock', '2.5');
    button('Review change').click();
    fixture.detectChanges();
    expect(element.querySelector('[data-testid="update-confirm"]')).toBeNull();
    expect((await product()).priceCents).toBe(250);
  });

  it('says nothing changed when the values are left alone', async () => {
    const { fixture, element, button, edit } = await render();
    await edit('PAR-500', 'Paracetamol 500mg');
    button('Review change').click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Nothing changed');
    expect(element.querySelector('[data-testid="update-confirm"]')).toBeNull();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('cannot edit for a user who cannot sell', async () => {
    const { fixture, element, type } = await render(false);
    type('update-search', 'PAR-500');
    await settle(fixture);
    const edit = element.querySelector(
      'button[aria-label="Edit Paracetamol 500mg"]'
    ) as HTMLButtonElement;
    expect(edit.disabled).toBeTrue();
  });
});
