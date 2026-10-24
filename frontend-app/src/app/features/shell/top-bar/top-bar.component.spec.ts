import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../../testing/auth-test.util';
import { UserRole } from '../../../core/models/enums/user-role.enum';
import { AuthService } from '../../../core/services/auth/auth.service';
import { RoleDataService } from '../../../core/services/data/role-data.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ShellStateService } from '../../../core/services/shell-state.service';
import { ThemePreferenceService } from '../../../core/services/theme-preference.service';
import { TopBarComponent } from './top-bar.component';

describe('TopBarComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS, provideRouter([])] });
  });

  afterEach(() => {
    clearBrowserStorage();
    TestBed.inject(NotificationService).dismiss();
  });

  async function render(role: UserRole = UserRole.ADMIN) {
    await signInAs(role);
    const fixture = TestBed.createComponent(TopBarComponent);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('shows the search box, sync indicator, bell and the signed-in person', async () => {
    const { element } = await render();
    const text = element.textContent ?? '';
    expect(text).toContain('Search products, GRN, suppliers…');
    expect(text).toContain('Ctrl K');
    expect(element.querySelector('app-sync-pill output')).not.toBeNull();
    expect(element.querySelector('button[aria-label="Notifications"]')).not.toBeNull();
    expect(text).toContain('Nimal Perera');
    expect(element.querySelector('.avatar')?.textContent).toBe('NP');
  });

  it('shows the admin as Owner and other roles by their name', async () => {
    expect((await render(UserRole.ADMIN)).element.textContent).toContain('Owner');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS, provideRouter([])] });
    expect((await render(UserRole.PHARMACIST)).element.textContent).toContain('Pharmacist');
  });

  it('has a clearly labelled menu control that toggles the drawer', async () => {
    const { fixture, element } = await render();
    const menu = element.querySelector('.topbar__menu button') as HTMLButtonElement;
    expect(menu.textContent).toContain('Menu');
    expect(menu.getAttribute('aria-controls')).toBe('app-sidebar');
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    menu.click();
    fixture.detectChanges();
    expect(TestBed.inject(ShellStateService).menuOpen()).toBeTrue();
    expect(menu.getAttribute('aria-expanded')).toBe('true');
  });

  it('switches the theme', async () => {
    const { fixture, element } = await render();
    const toggle = Array.from(element.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Dark theme')
    )!;
    toggle.click();
    fixture.detectChanges();
    expect(TestBed.inject(ThemePreferenceService).preference()).toBe('DARK');
    expect(element.textContent).toContain('Light theme');
  });

  it('gives a sample-only message from the bell', async () => {
    const { element } = await render();
    (element.querySelector('button[aria-label="Notifications"]') as HTMLButtonElement).click();
    expect(TestBed.inject(NotificationService).current()?.message).toContain('sample only');
  });

  it('signs out from the sign out button', async () => {
    const { element } = await render();
    const authService = TestBed.inject(AuthService);
    const signOut = spyOn(authService, 'signOut').and.resolveTo();
    const button = Array.from(element.querySelectorAll('button')).find(candidate =>
      candidate.textContent?.includes('Sign out')
    )!;
    button.click();
    expect(signOut).toHaveBeenCalled();
  });

  it('shows no branch selector and a short page title', async () => {
    const { element } = await render();
    expect(element.querySelector('select')).toBeNull();
    expect(element.querySelector('.topbar__title')).not.toBeNull();
  });
});

@Component({ template: '', selector: 'app-blank' })
class BlankComponent {}

describe('TopBarComponent POS button', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({
      providers: [
        ...TEST_PROVIDERS,
        provideRouter([
          { path: 'pos', component: BlankComponent },
          { path: 'products', component: BlankComponent },
        ]),
      ],
    });
  });

  afterEach(clearBrowserStorage);

  async function render(role: UserRole = UserRole.ADMIN, posLevel?: 'VIEW' | 'NONE') {
    await signInAs(role);
    if (posLevel) {
      await TestBed.inject(PermissionService).load();
      const roleDataService = TestBed.inject(RoleDataService);
      const matrix = await firstValueFrom(roleDataService.getMatrix());
      await firstValueFrom(
        roleDataService.saveMatrix({ ...matrix, [role]: { ...matrix[role], pos: posLevel } })
      );
    }
    const fixture = TestBed.createComponent(TopBarComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const pill = () => element.querySelector<HTMLButtonElement>('.pos-pill');
    return { fixture, element, pill };
  }

  it('shows a POS button before the avatar for every role with POS access', async () => {
    for (const role of [UserRole.ADMIN, UserRole.MANAGER, UserRole.PHARMACIST, UserRole.CASHIER]) {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [...TEST_PROVIDERS, provideRouter([{ path: 'pos', component: BlankComponent }])],
      });
      const { pill, element } = await render(role);
      expect(pill()).withContext(role).not.toBeNull();
      expect(pill()?.textContent?.trim()).toBe('POS');
      const user = element.querySelector('.topbar__user') as HTMLElement;
      const children = Array.from(user.children);
      expect(children.indexOf(pill() as Element)).toBeLessThan(
        children.indexOf(element.querySelector('app-avatar') as Element)
      );
    }
  });

  it('is a real button, so Enter and Space both open the till, named POS for a screen reader', async () => {
    const { pill } = await render();
    expect(pill()?.tagName).toBe('BUTTON');
    expect(pill()?.getAttribute('type')).toBe('button');
    expect(pill()?.textContent?.trim()).toBe('POS');
    expect(pill()?.getAttribute('aria-label')).toBeNull();
    expect(pill()?.querySelector('app-icon svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('opens the till when clicked', async () => {
    const { pill } = await render(UserRole.CASHIER);
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    pill()!.click();
    expect(navigate).toHaveBeenCalledWith('/pos');
  });

  it('is not shown to a role without POS access', async () => {
    const { pill } = await render(UserRole.CASHIER, 'NONE');
    expect(pill()).toBeNull();
  });

  it('is still shown, so the till can be opened to look at, with view-only POS access', async () => {
    const { pill } = await render(UserRole.CASHIER, 'VIEW');
    expect(pill()).not.toBeNull();
  });

  it('disappears when POS access is removed during the session', async () => {
    const { fixture, pill } = await render(UserRole.CASHIER);
    expect(pill()).not.toBeNull();
    const roleDataService = TestBed.inject(RoleDataService);
    const matrix = await firstValueFrom(roleDataService.getMatrix());
    await firstValueFrom(
      roleDataService.saveMatrix({ ...matrix, CASHIER: { ...matrix.CASHIER, pos: 'NONE' } })
    );
    fixture.detectChanges();
    expect(pill()).toBeNull();
  });

  it('shows an active look with a current page cue, not by colour alone, while the till is open', async () => {
    const { fixture, pill } = await render();
    expect(pill()?.classList).not.toContain('pos-pill--active');
    expect(pill()?.getAttribute('aria-current')).toBeNull();
    await TestBed.inject(Router).navigateByUrl('/pos');
    fixture.detectChanges();
    expect(pill()?.classList).toContain('pos-pill--active');
    expect(pill()?.getAttribute('aria-current')).toBe('page');
    await TestBed.inject(Router).navigateByUrl('/products');
    fixture.detectChanges();
    expect(pill()?.getAttribute('aria-current')).toBeNull();
  });

  it('keeps the menu control available at every width while the till hides the sidebar', async () => {
    const { fixture, element } = await render();
    const menu = element.querySelector('.topbar__menu') as HTMLElement;
    expect(menu.classList).not.toContain('topbar__menu--always');
    TestBed.inject(ShellStateService).setSidebarHidden(true);
    fixture.detectChanges();
    expect(menu.classList).toContain('topbar__menu--always');
  });
});
