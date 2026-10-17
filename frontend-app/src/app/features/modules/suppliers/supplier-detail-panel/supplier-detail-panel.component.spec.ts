import { TestBed } from '@angular/core/testing';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { SUPPLIER_SEED } from '../../../../core/services/data/in-memory/seed/supplier.seed';
import { SupplierListItem } from '../../../../core/utils/supplier-list-filter.util';
import { SupplierDetailPanelComponent } from './supplier-detail-panel.component';

describe('SupplierDetailPanelComponent', () => {
  beforeEach(() => clearBrowserStorage());
  afterEach(() => clearBrowserStorage());

  async function render(item: SupplierListItem, role: UserRole = UserRole.MANAGER) {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    await signInAs(role);
    const fixture = TestBed.createComponent(SupplierDetailPanelComponent);
    fixture.componentRef.setInput('item', item);
    fixture.componentRef.setInput('activity', []);
    const events: string[] = [];
    fixture.componentInstance.recordPayment.subscribe(() => events.push('pay'));
    fixture.componentInstance.edit.subscribe(() => events.push('edit'));
    fixture.componentInstance.newOrder.subscribe(() => events.push('order'));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const button = (text: string) =>
      Array.from(element.querySelectorAll('button')).find(
        candidate => candidate.textContent?.trim() === text
      ) as HTMLButtonElement | undefined;
    return { element, events, button };
  }

  const item = (index: number, owedCents: number): SupplierListItem => ({
    supplier: SUPPLIER_SEED[index],
    owedCents,
    lastOrderDate: null,
  });

  it('shows the outstanding amount with two decimals and raises each action', async () => {
    const { element, events, button } = await render(item(0, 1_160_000));
    expect(element.querySelector('[data-testid="supplier-outstanding"]')?.textContent).toBe(
      'Rs. 11,600.00'
    );
    button('Record payment')?.click();
    button('Edit')?.click();
    button('New PO')?.click();
    expect(events).toEqual(['pay', 'edit', 'order']);
  });

  it('makes Record payment unavailable when nothing is owed', async () => {
    const { button } = await render(item(1, 0));
    expect(button('Record payment')?.disabled).toBeTrue();
  });

  it('shows an inactive supplier with its word and no way to start an order', async () => {
    const { element, button } = await render(item(4, 0));
    expect(element.textContent).toContain('Inactive');
    expect(button('New PO')?.disabled).toBeTrue();
  });

  it('shows the terms in one line and the supplier details as plain text', async () => {
    const { element } = await render(item(0, 0));
    expect(element.textContent).toContain('30 days credit · delivers in 2 days');
    expect(element.querySelector('a')).toBeNull();
  });

  it('shows no actions to someone who can only view suppliers', async () => {
    const { element } = await render(item(0, 1_160_000), UserRole.PHARMACIST);
    expect(element.querySelector('button')).toBeNull();
  });
});
