import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../../testing/auth-test.util';
import { UserRole } from '../../../core/models/enums/user-role.enum';
import { ProductDataService } from '../../../core/services/data/product-data.service';
import { NotificationService } from '../../../core/services/notification.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS, provideRouter([])] });
  });

  afterEach(() => {
    clearBrowserStorage();
    TestBed.inject(NotificationService).dismiss();
  });

  async function render(role: UserRole) {
    await signInAs(role);
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  const buttonByText = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll('button')).find(
      button => button.textContent?.trim() === text
    ) as HTMLButtonElement;

  it('greets the signed-in person by first name with the date and shop name', async () => {
    const { element } = await render(UserRole.ADMIN);
    expect(element.querySelector('h1')?.textContent).toBe('Good morning, Nimal');
    expect(element.querySelector('app-page-header')?.textContent).toContain(
      '21 Sep 2026 · Main Shop'
    );
  });

  it('has an outline Daily report button and the only primary button, New GRN', async () => {
    const { element } = await render(UserRole.ADMIN);
    const primary = element.querySelectorAll('button[data-variant="primary"]');
    expect(primary).toHaveSize(1);
    expect(primary[0].textContent).toContain('New GRN');
    expect(buttonByText(element, 'Daily report').getAttribute('data-variant')).toBe('default');
  });

  it('gives a sample-only message from Daily report and nothing else changes', async () => {
    const { fixture, element } = await render(UserRole.ADMIN);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    buttonByText(element, 'Daily report').click();
    fixture.detectChanges();
    expect(TestBed.inject(NotificationService).current()?.message).toContain('sample only');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the stock-in area from New GRN', async () => {
    const { element } = await render(UserRole.ADMIN);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    buttonByText(element, 'New GRN').click();
    expect(navigate).toHaveBeenCalledWith(['/grn']);
  });

  it('shows four tiles in order with figures that match the product list counts', async () => {
    const { element } = await render(UserRole.ADMIN);
    const tiles = Array.from(element.querySelectorAll('app-stat-card'));
    expect(tiles.map(tile => tile.querySelector('.stat__label')?.textContent)).toEqual([
      "Today's sales",
      "Today's profit",
      'Low stock',
      'Expiring soon',
    ]);
    expect(tiles[0].textContent).toContain('Rs. 84,250');
    expect(tiles[0].textContent).toContain('+12.4% vs last Monday');
    expect(tiles[1].textContent).toContain('Rs. 19,840');
    expect(tiles[1].textContent).toContain('23.5% margin on 63 bills');
    expect(tiles[2].textContent).toContain('3 items');
    expect(tiles[2].textContent).toContain('1 out of stock');
    expect(tiles[3].textContent).toContain('1 batch');
    expect(tiles[3].textContent).toContain('within the next 60 days');
  });

  it('reflects product changes made in the session when the Dashboard is opened again', async () => {
    await signInAs(UserRole.ADMIN);
    const products = TestBed.inject(ProductDataService);
    const ors = (await firstValueFrom(products.getById('prod-006')))!;
    await firstValueFrom(products.save({ ...ors, stockOnHand: 500 }));
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const tile = fixture.nativeElement.querySelectorAll('app-stat-card')[2] as HTMLElement;
    expect(tile.textContent).toContain('2 items');
    expect(tile.textContent).toContain('0 out of stock');
  });

  it('lists what needs attention with exactly one action button per row', async () => {
    const { element } = await render(UserRole.ADMIN);
    const rows = Array.from(element.querySelectorAll('app-dashboard-needs-attention li'));
    expect(rows).toHaveSize(4);
    expect(rows.every(row => row.querySelectorAll('button').length === 1)).toBeTrue();
    expect(rows.map(row => row.querySelector('button')?.textContent?.trim())).toEqual([
      'Create PO',
      'Review',
      'Open',
      'Top up',
    ]);
    expect(rows[0].textContent).toContain('Reorder 3 low-stock items');
    expect(rows[1].textContent).toContain('1 batch expire by 20 Nov');
  });

  it('sends Review to the product list with the expiring filter', async () => {
    const { element } = await render(UserRole.ADMIN);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    buttonByText(element, 'Review').click();
    expect(navigate).toHaveBeenCalledWith(['/products'], {
      queryParams: { status: 'expiring-soon' },
    });
    buttonByText(element, 'Top up').click();
    expect(navigate).toHaveBeenCalledWith(['/reload-utility'], { queryParams: undefined });
  });

  it('disables actions that create or change data for a Pharmacist and keeps navigation working', async () => {
    const { element } = await render(UserRole.PHARMACIST);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    expect(buttonByText(element, 'Create PO').disabled).toBeTrue();
    expect(buttonByText(element, 'Top up').disabled).toBeTrue();
    expect(buttonByText(element, 'Review').disabled).toBeFalse();
    expect(buttonByText(element, 'Open').disabled).toBeFalse();
    buttonByText(element, 'Open').click();
    expect(navigate).toHaveBeenCalledWith(['/purchase-orders'], { queryParams: undefined });
  });

  it('shows the most urgent low-stock products first with a word status and right-aligned numbers', async () => {
    const { element } = await render(UserRole.ADMIN);
    const rows = Array.from(element.querySelectorAll('app-dashboard-low-stock tbody tr'));
    expect(rows.map(row => row.querySelector('td')?.textContent?.trim())).toEqual([
      'ORS Sachet',
      'Cetirizine 10mg',
      'Metformin 500mg',
    ]);
    expect(rows[0].textContent).toContain('Out of stock');
    expect(rows[1].textContent).toContain('Low stock');
    expect(rows[0].querySelectorAll('td.is-right')).toHaveSize(2);
  });

  it('opens the product list filtered to low stock from View all', async () => {
    const { element } = await render(UserRole.ADMIN);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    buttonByText(element, 'View all').click();
    expect(navigate).toHaveBeenCalledWith(['/products'], { queryParams: { status: 'low-stock' } });
  });

  it('shows best sellers with the unit count written as a number and a bar each', async () => {
    const { element } = await render(UserRole.ADMIN);
    const rows = Array.from(element.querySelectorAll('app-dashboard-best-sellers li'));
    expect(rows).toHaveSize(4);
    expect(rows[0].textContent).toContain('Paracetamol 500mg');
    expect(rows[0].textContent).toContain('412');
    const bars = element.querySelectorAll('app-dashboard-best-sellers progress');
    expect(bars).toHaveSize(4);
    expect((bars[0] as HTMLProgressElement).value).toBe(412);
    expect((bars[0] as HTMLProgressElement).max).toBe(412);
  });
});
