import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { UserRole } from '../../core/models/enums/user-role.enum';
import { ProductDataService } from '../../core/services/data/product-data.service';
import { SettingsDataService } from '../../core/services/data/settings-data.service';
import { NotificationService } from '../../core/services/notification.service';
import { ReloadService } from '../../core/services/reload.service';
import { SettingsService } from '../../core/services/settings.service';
import { toDraft } from '../../core/utils/settings-diff.util';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ProductFormComponent } from './products/product-form/product-form.component';
import { ProductListComponent } from './products/product-list/product-list.component';
import { ReloadUtilityComponent } from './reload-utility/reload-utility.component';
import { SettingsComponent } from './settings/settings.component';

describe('Services and settings: the same figure everywhere', () => {
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

  async function setUp(mode = 'create'): Promise<void> {
    const params = convertToParamMap({});
    TestBed.configureTestingModule({
      providers: [
        ...TEST_PROVIDERS,
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { mode }, paramMap: params, queryParamMap: params },
            queryParamMap: of(params),
          },
        },
      ],
    });
    await signInAs(UserRole.ADMIN);
  }

  async function show<T>(component: Type<T>) {
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    await settle(fixture);
    return fixture.nativeElement as HTMLElement;
  }

  async function saveSettings(changes: Record<string, string | boolean>) {
    const settings = await firstValueFrom(TestBed.inject(SettingsDataService).get());
    const result = await TestBed.inject(SettingsService).save({ ...toDraft(settings), ...changes });
    expect(result.ok).toBeTrue();
  }

  const tile = (dashboard: HTMLElement, label: string) =>
    Array.from(dashboard.querySelectorAll('app-stat-card'))
      .find(card => card.textContent?.includes(label))
      ?.textContent?.replace(/\s+/g, ' ');
  const expiringChip = (products: HTMLElement) =>
    Array.from(products.querySelectorAll('app-chips button'))
      .find(chip => chip.textContent?.includes('Expiring soon'))
      ?.textContent?.replace(/\s+/g, ' ')
      .trim();
  const attention = (dashboard: HTMLElement) =>
    dashboard.querySelector('app-dashboard-needs-attention')?.textContent?.replace(/\s+/g, ' ') ??
    '';
  const floatWarning = (reload: HTMLElement) =>
    reload.querySelector('app-reload-float-card app-alert')?.textContent?.trim() ?? null;
  const input = (scope: HTMLElement, selector: string) =>
    scope.querySelector(selector) as HTMLInputElement;

  it('uses the saved expiry window on Products and the Dashboard together, and only once saved', async () => {
    await setUp();
    expect(expiringChip(await show(ProductListComponent))).toBe('Expiring soon 1');
    const before = await show(DashboardComponent);
    expect(tile(before, 'Expiring soon')).toContain('1 batch');
    expect(tile(before, 'Expiring soon')).toContain('within the next 60 days');

    const settingsFixture = TestBed.createComponent(SettingsComponent);
    settingsFixture.detectChanges();
    await settle(settingsFixture);
    const settingsPage = settingsFixture.nativeElement as HTMLElement;
    Array.from(settingsPage.querySelectorAll('app-settings-group-list button'))
      .find(button => button.textContent?.trim() === 'Inventory alerts')
      ?.dispatchEvent(new Event('click'));
    settingsFixture.detectChanges();
    const days = input(settingsPage, '#settings-expiryAlertDays');
    days.value = '30';
    days.dispatchEvent(new Event('input'));
    settingsFixture.detectChanges();

    expect(expiringChip(await show(ProductListComponent))).toBe('Expiring soon 1');
    expect(tile(await show(DashboardComponent), 'Expiring soon')).toContain(
      'within the next 60 days'
    );

    await saveSettings({ expiryAlertDays: '30' });
    expect(expiringChip(await show(ProductListComponent))).toBe('Expiring soon 0');
    const after = await show(DashboardComponent);
    expect(tile(after, 'Expiring soon')).toContain('0 batches');
    expect(tile(after, 'Expiring soon')).toContain('within the next 30 days');
    expect(attention(after)).not.toContain('expire by');
  });

  it('pre-fills Add product with the saved default reorder level and leaves existing products alone', async () => {
    await setUp();
    const productsBefore = await firstValueFrom(TestBed.inject(ProductDataService).getAll());
    expect(input(await show(ProductFormComponent), '#product-reorderLevel').value).toBe('20');
    await saveSettings({ defaultReorderLevel: '15' });
    expect(input(await show(ProductFormComponent), '#product-reorderLevel').value).toBe('15');
    const productsAfter = await firstValueFrom(TestBed.inject(ProductDataService).getAll());
    expect(productsAfter.map(product => product.reorderLevel)).toEqual(
      productsBefore.map(product => product.reorderLevel)
    );
  });

  it('flips the float warning and the Dashboard row together when the low-float level is saved', async () => {
    await setUp();
    expect(floatWarning(await show(ReloadUtilityComponent))).toBe(
      'Float is below Rs. 10,000. Top up before the evening rush.'
    );
    expect(attention(await show(DashboardComponent))).toContain('Reload float is running low');

    await saveSettings({ lowFloatRupees: '5000' });
    expect(floatWarning(await show(ReloadUtilityComponent))).toBeNull();
    expect(attention(await show(DashboardComponent))).not.toContain('Reload float is running low');

    await saveSettings({ lowFloatRupees: '7000' });
    expect(floatWarning(await show(ReloadUtilityComponent))).toBe(
      'Float is below Rs. 7,000. Top up before the evening rush.'
    );
    expect(attention(await show(DashboardComponent))).toContain('Reload float is running low');
  });

  it('keeps the float card, the Dashboard row and the table in agreement after a top up and a reload', async () => {
    await setUp();
    const reload = TestBed.inject(ReloadService);
    expect((await reload.topUpFloat(400_000)).ok).toBeTrue();
    let page = await show(ReloadUtilityComponent);
    expect(page.querySelector('[data-testid="available-float"]')?.textContent).toBe('Rs. 10,200');
    expect(floatWarning(page)).toBeNull();
    expect(attention(await show(DashboardComponent))).not.toContain('Reload float is running low');
    expect(page.querySelectorAll('app-recent-transactions tbody tr')).toHaveSize(5);

    const sent = await reload.sendReload({
      operator: 'Hutch',
      mobile: '78 222 3344',
      customerName: '',
      amount: '500',
    });
    expect(sent.ok).toBeTrue();
    page = await show(ReloadUtilityComponent);
    expect(page.querySelector('[data-testid="available-float"]')?.textContent).toBe('Rs. 9,700');
    expect(page.querySelector('[data-testid="reloads-today"]')?.textContent).toBe('39');
    expect(page.querySelector('[data-testid="commission-today"]')?.textContent?.trim()).toBe(
      'Rs. 1,252.50'
    );
    expect(floatWarning(page)).toContain('Float is below Rs. 10,000');
    expect(attention(await show(DashboardComponent))).toContain('Reload float is running low');
    const rows = page.querySelectorAll('app-recent-transactions tbody tr');
    expect(rows).toHaveSize(6);
    expect(rows[0].textContent).toContain('Hutch');
    expect(rows[0].textContent).toContain('Success');
  });

  it('keeps the bill count on the card and the new bill row in agreement without touching float or commission', async () => {
    await setUp();
    const paid = await TestBed.inject(ReloadService).payBill({
      provider: 'Internet',
      account: 'NET-1',
      amount: '2000',
    });
    expect(paid.ok).toBeTrue();
    const page = await show(ReloadUtilityComponent);
    expect(page.querySelector('[data-testid="bills-today"]')?.textContent).toBe('10');
    expect(page.querySelector('[data-testid="available-float"]')?.textContent).toBe('Rs. 6,200');
    expect(page.querySelector('[data-testid="commission-today"]')?.textContent?.trim()).toBe(
      'Rs. 1,240.00'
    );
    expect(page.querySelector('app-recent-transactions tbody tr')?.textContent).toContain(
      'Account NET-1'
    );
  });
});
