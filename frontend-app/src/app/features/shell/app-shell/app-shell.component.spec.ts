import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../../testing/auth-test.util';
import { routes } from '../../../app.routes';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';
import { UserRole } from '../../../core/models/enums/user-role.enum';
import { RoleDataService } from '../../../core/services/data/role-data.service';
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
    return { harness, element: document.body.querySelector('app-shell') as HTMLElement };
  }

  it('wraps pages in the sidebar, top bar and one main area, with no footer bar', async () => {
    const { element } = await openShell(UserRole.ADMIN, '/products');
    expect(element.querySelector('app-sidebar')).not.toBeNull();
    expect(element.querySelector('app-top-bar')).not.toBeNull();
    expect(element.querySelectorAll('main')).toHaveSize(1);
    expect(element.querySelector('footer')).toBeNull();
    expect(element.querySelector('select')).toBeNull();
  });

  it('shows the placeholder for a module that is not built yet inside the frame', async () => {
    const { element } = await openShell(UserRole.ADMIN, '/suppliers');
    const main = element.querySelector('main') as HTMLElement;
    expect(main.querySelector('h1')?.textContent).toBe('Suppliers');
    expect(main.textContent).toContain('coming soon');
  });

  it('closes the menu when the page changes', async () => {
    const { harness } = await openShell(UserRole.ADMIN, '/products');
    const state = TestBed.inject(ShellStateService);
    state.openMenu();
    expect(state.menuOpen()).toBeTrue();
    await harness.navigateByUrl('/grn');
    expect(state.menuOpen()).toBeFalse();
  });

  it('closes the menu with the Escape key', async () => {
    const { harness } = await openShell(UserRole.ADMIN, '/products');
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
