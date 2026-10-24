import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../../testing/auth-test.util';
import { routes } from '../../../app.routes';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';
import { UserRole } from '../../../core/models/enums/user-role.enum';
import { RoleDataService } from '../../../core/services/data/role-data.service';
import { SettingsDataService } from '../../../core/services/data/settings-data.service';
import { PermissionService } from '../../../core/services/permission.service';
import { PosService } from '../../../core/services/pos.service';
import { ShellStateService } from '../../../core/services/shell-state.service';

describe('AppShellComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS, provideRouter(routes)] });
  });

  afterEach(clearBrowserStorage);

  async function openShell(role: UserRole, url: string) {
    await signInAs(role);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    harness.detectChanges();
    const element = (harness.fixture.nativeElement as HTMLElement).querySelector(
      'app-shell'
    ) as HTMLElement;
    return { harness, element };
  }

  it('wraps pages in the sidebar, top bar and one main area, with no footer bar', async () => {
    const { element } = await openShell(UserRole.ADMIN, '/suppliers');
    expect(element.querySelector('app-sidebar')).not.toBeNull();
    expect(element.querySelector('app-top-bar')).not.toBeNull();
    expect(element.querySelectorAll('main')).toHaveSize(1);
    const footersOutsidePage = Array.from(element.querySelectorAll('footer')).filter(
      footer => !footer.closest('main')
    );
    expect(footersOutsidePage).toHaveSize(0);
    expect(element.querySelector('select')).toBeNull();
  });

  it('shows a module page inside the frame', async () => {
    const { element } = await openShell(UserRole.ADMIN, '/settings');
    const main = element.querySelector('main') as HTMLElement;
    expect(main.querySelector('h1')?.textContent).toBe('Settings');
    expect(main.textContent).toContain('One shop, one place to change how it runs.');
    expect(main.textContent).not.toContain('coming soon');
  });

  it('closes the menu when the page changes', async () => {
    const { harness } = await openShell(UserRole.ADMIN, '/suppliers');
    const state = TestBed.inject(ShellStateService);
    state.openMenu();
    expect(state.menuOpen()).toBeTrue();
    await harness.navigateByUrl('/grn');
    expect(state.menuOpen()).toBeFalse();
  });

  it('closes the menu with the Escape key', async () => {
    const { harness } = await openShell(UserRole.ADMIN, '/suppliers');
    const state = TestBed.inject(ShellStateService);
    state.openMenu();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    harness.detectChanges();
    expect(state.menuOpen()).toBeFalse();
  });

  it('moves a user off a module when the matrix removes their access during the session', async () => {
    const { harness } = await openShell(UserRole.CASHIER, '/reload-utility');
    const roleDataService = TestBed.inject(RoleDataService);
    const matrix = await firstValueFrom(roleDataService.getMatrix());
    await firstValueFrom(
      roleDataService.saveMatrix({
        ...matrix,
        CASHIER: { ...matrix.CASHIER, [ModuleKey.RELOAD_UTILITY]: 'NONE' },
      })
    );
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/access-denied');
  });

  it('shows the access denied message with a way back to a module the role can use', async () => {
    const { element } = await openShell(UserRole.CASHIER, '/settings');
    const main = element.querySelector('main') as HTMLElement;
    expect(main.textContent).toContain("You don't have access to this area");
    expect(main.querySelector('button')?.textContent).toContain('Go to a page you can use');
    expect(main.textContent).not.toContain('coming soon');
  });
});

describe('AppShellComponent with the till', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS, provideRouter(routes)] });
  });

  afterEach(clearBrowserStorage);

  async function openShell(role: UserRole, url: string) {
    await signInAs(role);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await new Promise(resolve => setTimeout(resolve, 60));
    harness.detectChanges();
    const element = (harness.fixture.nativeElement as HTMLElement).querySelector(
      'app-shell'
    ) as HTMLElement;
    return { harness, element };
  }

  async function setPos(role: UserRole, level: 'FULL' | 'VIEW' | 'NONE') {
    await TestBed.inject(PermissionService).load();
    const roleDataService = TestBed.inject(RoleDataService);
    const matrix = await firstValueFrom(roleDataService.getMatrix());
    await firstValueFrom(
      roleDataService.saveMatrix({ ...matrix, [role]: { ...matrix[role], pos: level } })
    );
  }

  it('shows the blue POS button at the top of every page', async () => {
    const { element } = await openShell(UserRole.MANAGER, '/suppliers');
    expect(element.querySelector('app-top-bar .pos-pill')?.textContent?.trim()).toBe('POS');
  });

  it('opens the till full width inside the frame and hides the sidebar when Settings says so', async () => {
    const { element } = await openShell(UserRole.CASHIER, '/pos');
    expect(element.querySelector('main app-pos')).not.toBeNull();
    expect(TestBed.inject(ShellStateService).sidebarHidden()).toBeTrue();
    expect(element.querySelector('app-top-bar .pos-pill--active')).not.toBeNull();
  });

  it('can still open the sidebar with the normal menu control while it is hidden', async () => {
    const { harness, element } = await openShell(UserRole.CASHIER, '/pos');
    const state = TestBed.inject(ShellStateService);
    const menu = element.querySelector('.topbar__menu button') as HTMLButtonElement;
    expect(menu).not.toBeNull();
    menu.click();
    harness.detectChanges();
    expect(state.menuOpen()).toBeTrue();
    expect(element.querySelector('app-sidebar .sidebar--open')).not.toBeNull();
    expect(element.querySelector('.shell__backdrop')).not.toBeNull();
  });

  it('brings the sidebar back when you leave the till', async () => {
    const { harness } = await openShell(UserRole.CASHIER, '/pos');
    await harness.navigateByUrl('/products');
    harness.detectChanges();
    expect(TestBed.inject(ShellStateService).sidebarHidden()).toBeFalse();
  });

  it('keeps the sidebar when the Settings option is off', async () => {
    const settingsDataService = TestBed.inject(SettingsDataService);
    const current = await firstValueFrom(settingsDataService.get());
    await firstValueFrom(settingsDataService.save({ ...current, posHideSidebar: false }));
    await openShell(UserRole.CASHIER, '/pos');
    expect(TestBed.inject(ShellStateService).sidebarHidden()).toBeFalse();
  });

  it('shows no POS button, and a clear no access message at the till address, without POS access', async () => {
    await signInAs(UserRole.CASHIER);
    await setPos(UserRole.CASHIER, 'NONE');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/pos');
    harness.detectChanges();
    const element = (harness.fixture.nativeElement as HTMLElement).querySelector(
      'app-shell'
    ) as HTMLElement;
    expect(TestBed.inject(Router).url).toBe('/access-denied');
    expect(element.querySelector('.pos-pill')).toBeNull();
    expect(element.querySelector('main')?.textContent).toContain('You do not have access to POS');
    expect(element.querySelector('main app-pos')).toBeNull();
  });

  it('shows the general no access message for other areas, not the POS one', async () => {
    const { element } = await openShell(UserRole.CASHIER, '/settings');
    const text = element.querySelector('main')?.textContent ?? '';
    expect(text).toContain("You don't have access to this area");
    expect(text).not.toContain('POS');
  });

  it('moves a user off the till when POS access is removed during the session', async () => {
    const { harness } = await openShell(UserRole.CASHIER, '/pos');
    await setPos(UserRole.CASHIER, 'NONE');
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/access-denied');
    expect(TestBed.inject(ShellStateService).sidebarHidden()).toBeFalse();
  });

  it('asks before leaving the till with unsaved items and stays when you say so', async () => {
    const { harness, element } = await openShell(UserRole.CASHIER, '/pos');
    TestBed.inject(PosService).addProduct('prod-001');
    harness.detectChanges();
    const navigation = harness.navigateByUrl('/products');
    await new Promise(resolve => setTimeout(resolve, 30));
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/pos');
    const stay = Array.from(element.querySelectorAll('button')).find(candidate =>
      candidate.textContent?.trim().startsWith('Stay on the till')
    ) as HTMLButtonElement;
    stay.click();
    await navigation;
    expect(TestBed.inject(Router).url).toBe('/pos');
  });

  it('leaves the till and clears the bill when you confirm', async () => {
    const { harness, element } = await openShell(UserRole.CASHIER, '/pos');
    TestBed.inject(PosService).addProduct('prod-001');
    harness.detectChanges();
    const navigation = harness.navigateByUrl('/products');
    await new Promise(resolve => setTimeout(resolve, 30));
    harness.detectChanges();
    const leave = Array.from(element.querySelectorAll('button')).find(candidate =>
      candidate.textContent?.trim().startsWith('Leave and clear')
    ) as HTMLButtonElement;
    leave.click();
    await navigation;
    expect(TestBed.inject(Router).url).toBe('/products');
    expect(TestBed.inject(PosService).bill().lines).toEqual([]);
  });
});
