import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideRouter } from '@angular/router';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../../testing/auth-test.util';
import { UserRole } from '../../../core/models/enums/user-role.enum';
import { SettingsDataService } from '../../../core/services/data/settings-data.service';
import { SettingsService } from '../../../core/services/settings.service';
import { toDraft } from '../../../core/utils/settings-diff.util';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS, provideRouter([])] });
  });

  afterEach(clearBrowserStorage);

  async function render(role: UserRole) {
    await signInAs(role);
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const labels = Array.from(element.querySelectorAll('.nav-link__label')).map(node =>
      node.textContent?.trim()
    );
    const groups = Array.from(element.querySelectorAll('.group__label')).map(node =>
      node.textContent?.trim()
    );
    return { fixture, element, labels, groups };
  }

  it('shows the brand block and footer text', async () => {
    const { element } = await render(UserRole.ADMIN);
    const text = element.textContent ?? '';
    expect(text).toContain('ShopDesk');
    expect(text).toContain('Main Shop');
    expect(text).toContain('ShopDesk 1.0 · Offline ready');
    expect(element.querySelector('.brand__tile')?.textContent).toBe('S');
  });

  it('lists exactly nine modules in the five groups for the admin', async () => {
    const { labels, groups } = await render(UserRole.ADMIN);
    expect(groups).toEqual(['OVERVIEW', 'INVENTORY', 'PEOPLE', 'SERVICES', 'SYSTEM']);
    expect(labels).toEqual([
      'Dashboard',
      'Products',
      'GRN',
      'Purchase orders',
      'Suppliers',
      'Employees',
      'Users',
      'Reload & Utility',
      'Settings',
    ]);
  });

  it('never lists Payroll in the sidebar, even for roles that can open it', async () => {
    for (const role of [UserRole.ADMIN, UserRole.MANAGER]) {
      const { labels, element } = await render(role);
      expect(labels).not.toContain('Payroll');
      const hrefs = Array.from(element.querySelectorAll('a.nav-link')).map(link =>
        link.getAttribute('href')
      );
      expect(hrefs).not.toContain('/employees/payroll');
    }
  });

  it('hides modules the role has no access to', async () => {
    const manager = await render(UserRole.MANAGER);
    expect(manager.labels).not.toContain('Users');
    expect(manager.labels).not.toContain('Settings');
    expect(manager.labels).toContain('Employees');
  });

  it('shows only products and reload for the cashier and drops empty groups', async () => {
    const { labels, groups } = await render(UserRole.CASHIER);
    expect(labels).toEqual(['Products', 'Reload & Utility']);
    expect(groups).toEqual(['INVENTORY', 'SERVICES']);
  });

  it('shows count badges on Products and GRN', async () => {
    const { element } = await render(UserRole.ADMIN);
    const links = Array.from(element.querySelectorAll('a.nav-link'));
    const countFor = (label: string) =>
      links.find(link => link.textContent?.includes(label))?.querySelector('.nav-link__count')
        ?.textContent;
    expect(countFor('Products')).toBe('3');
    expect(countFor('GRN')).toBe('1');
    expect(countFor('Suppliers')).toBeUndefined();
  });

  it('builds links to each module path and offers no second navigation row', async () => {
    const { element } = await render(UserRole.ADMIN);
    const hrefs = Array.from(element.querySelectorAll('a.nav-link')).map(link =>
      link.getAttribute('href')
    );
    expect(hrefs).toHaveSize(9);
    expect(hrefs).toContain('/purchase-orders');
    expect(element.querySelectorAll('nav')).toHaveSize(1);
  });

  it('is open as a drawer only when asked', async () => {
    const { fixture, element } = await render(UserRole.ADMIN);
    expect(element.querySelector('.sidebar')?.classList).not.toContain('sidebar--open');
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('drawerMode', true);
    fixture.detectChanges();
    expect(element.querySelector('.sidebar')?.classList).toContain('sidebar--open');
  });

  it('hides and shows the low-stock count as soon as the setting is saved, without leaving the page', async () => {
    const { fixture, element } = await render(UserRole.ADMIN);
    const productsCount = () =>
      Array.from(element.querySelectorAll('a.nav-link'))
        .find(link => link.textContent?.includes('Products'))
        ?.querySelector('.nav-link__count')?.textContent;
    expect(productsCount()).toBe('3');
    const settings = await firstValueFrom(TestBed.inject(SettingsDataService).get());
    const service = TestBed.inject(SettingsService);

    expect(
      (await service.save({ ...toDraft(settings), showLowStockCountInSidebar: false })).ok
    ).toBeTrue();
    fixture.detectChanges();
    expect(productsCount()).toBeUndefined();

    expect(
      (await service.save({ ...toDraft(settings), showLowStockCountInSidebar: true })).ok
    ).toBeTrue();
    fixture.detectChanges();
    expect(productsCount()).toBe('3');
  });
});
