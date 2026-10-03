import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { ProductStatus } from '../../../../core/models/enums/product-status.enum';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { LowStockRow } from '../../../../core/utils/dashboard-metrics.util';
import { DashboardLowStockComponent } from './dashboard-low-stock.component';

describe('DashboardLowStockComponent', () => {
  beforeEach(() => clearBrowserStorage());
  afterEach(() => clearBrowserStorage());

  const rows: LowStockRow[] = [
    {
      productId: 'p1',
      name: 'Insulin Pen',
      stock: 0,
      reorderLevel: 20,
      status: ProductStatus.OUT_OF_STOCK,
    },
    {
      productId: 'p2',
      name: 'Salbutamol',
      stock: 5,
      reorderLevel: 20,
      status: ProductStatus.LOW_STOCK,
    },
  ];

  async function render(role: UserRole) {
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS, provideRouter([])] });
    await signInAs(role);
    const fixture = TestBed.createComponent(DashboardLowStockComponent);
    fixture.componentRef.setInput('rows', rows);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('lists name, stock, reorder level and a status word per row', async () => {
    const element = await render(UserRole.ADMIN);
    const cells = Array.from(element.querySelectorAll('tbody tr')).map(row =>
      Array.from(row.querySelectorAll('td')).map(cell => cell.textContent?.trim())
    );
    expect(cells[0]).toEqual(['Insulin Pen', '0', '20', 'Out of stock']);
    expect(cells[1]).toEqual(['Salbutamol', '5', '20', 'Low stock']);
  });

  it('opens the product list filtered to low stock from View all', async () => {
    const element = await render(UserRole.ADMIN);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const button = Array.from(element.querySelectorAll('button')).find(
      item => item.textContent?.trim() === 'View all'
    ) as HTMLButtonElement;
    button.click();
    expect(navigate).toHaveBeenCalledWith(['/products'], { queryParams: { status: 'low-stock' } });
  });
});
