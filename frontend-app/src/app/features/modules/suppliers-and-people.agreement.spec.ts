import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { UserRole } from '../../core/models/enums/user-role.enum';
import { NotificationService } from '../../core/services/notification.service';
import { SupplierPaymentService } from '../../core/services/supplier-payment.service';
import { UserAdminService } from '../../core/services/user-admin.service';
import { EmployeesComponent } from './employees/employees.component';
import { GrnListComponent } from './grn/grn-list/grn-list.component';
import { PurchaseOrderFormComponent } from './purchase-orders/purchase-order-form/purchase-order-form.component';
import { SuppliersComponent } from './suppliers/suppliers.component';
import { UsersComponent } from './users/users.component';

describe('Suppliers and people: the same figure everywhere', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
    clearBrowserStorage();
    TestBed.inject(NotificationService).dismiss();
  });

  interface Detectable {
    detectChanges(): void;
  }

  async function settle(fixture: Detectable): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 30));
    fixture.detectChanges();
  }

  function configure(query: Record<string, string> = {}): void {
    const params = convertToParamMap(query);
    TestBed.configureTestingModule({
      providers: [
        ...TEST_PROVIDERS,
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { mode: 'create' },
              paramMap: convertToParamMap({}),
              queryParamMap: params,
            },
            queryParamMap: of(params),
          },
        },
      ],
    });
  }

  async function show<T>(component: Type<T>) {
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    await settle(fixture);
    return fixture.nativeElement as HTMLElement;
  }

  it('agrees on what is owed after a payment across Suppliers, the GRN tile and the order side card', async () => {
    configure({ supplier: 'sup-001' });
    await signInAs(UserRole.MANAGER);
    const before = await show(SuppliersComponent);
    expect(before.querySelector('[data-testid="supplier-outstanding"]')?.textContent).toBe(
      'Rs. 11,600.00'
    );
    const paid = await TestBed.inject(SupplierPaymentService).recordPayment('sup-001', 600_000);
    expect(paid.ok).toBeTrue();

    const suppliers = await show(SuppliersComponent);
    expect(suppliers.querySelector('[data-testid="supplier-outstanding"]')?.textContent).toBe(
      'Rs. 5,600.00'
    );
    expect(suppliers.querySelector('tbody tr td:nth-child(2)')?.textContent?.trim()).toBe(
      '5,600.00'
    );
    expect(suppliers.querySelector('app-page-header')?.textContent).toContain(
      'Rs. 8,400 outstanding'
    );

    const grnList = await show(GrnListComponent);
    const unpaidTile = Array.from(grnList.querySelectorAll('app-stat-card')).find(tile =>
      tile.textContent?.includes('Unpaid to suppliers')
    );
    expect(unpaidTile?.textContent).toContain('Rs. 8,400');
    expect(unpaidTile?.textContent).toContain('3 invoices · oldest 12 days');
    const statuses = Array.from(grnList.querySelectorAll('tbody tr')).map(row =>
      row.textContent?.replace(/\s+/g, ' ').trim()
    );
    expect(statuses.find(text => text?.includes('GRN-0205'))).toContain('Paid');
    expect(statuses.find(text => text?.includes('GRN-0206'))).toContain('Part paid');
    expect(statuses.find(text => text?.includes('GRN-0208'))).toContain('Unpaid');

    const orderForm = await show(PurchaseOrderFormComponent);
    expect(orderForm.querySelector('[data-testid="supplier-owed"]')?.textContent?.trim()).toBe(
      'You owe them Rs. 5,600.00'
    );
  });

  it('keeps Employees in step with users created and disabled in Users', async () => {
    configure();
    await signInAs(UserRole.ADMIN);
    const tileText = (element: HTMLElement) =>
      Array.from(element.querySelectorAll('app-stat-card'))
        .find(tile => tile.textContent?.includes('Can log in'))
        ?.textContent?.replace(/\s+/g, ' ');
    const loginOf = (element: HTMLElement, name: string) => {
      const row = Array.from(element.querySelectorAll('app-users-card tbody tr')).find(candidate =>
        candidate.textContent?.includes(name)
      );
      const role = row?.querySelector('td:nth-child(2)')?.textContent?.trim();
      const status = row?.querySelector('td:nth-child(4)')?.textContent?.trim();
      return status === 'Disabled' ? `${role} · Disabled` : role;
    };
    expect(tileText(await show(EmployeesComponent))).toContain('4');

    const created = await TestBed.inject(UserAdminService).createUser({
      employeeId: 'emp-005',
      username: 'suresh',
      role: 'CASHIER',
      password: 'Welcome-1',
      pin: '',
      mustChangePassword: true,
    });
    expect(created.ok).toBeTrue();
    const afterCreate = await show(EmployeesComponent);
    expect(tileText(afterCreate)).toContain('Can log in5');
    expect(loginOf(await show(UsersComponent), 'Suresh Kumar')).toBe('Cashier');

    await TestBed.inject(UserAdminService).setDisabled('usr-005', true);
    const afterDisable = await show(EmployeesComponent);
    expect(tileText(afterDisable)).toContain('Can log in4');
    expect(loginOf(await show(UsersComponent), 'Suresh Kumar')).toBe('Cashier · Disabled');
  });
});
