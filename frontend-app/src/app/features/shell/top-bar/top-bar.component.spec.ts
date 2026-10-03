import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../../testing/auth-test.util';
import { UserRole } from '../../../core/models/enums/user-role.enum';
import { AuthService } from '../../../core/services/auth/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
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
