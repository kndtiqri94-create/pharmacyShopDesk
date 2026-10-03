import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { clearBrowserStorage, TEST_PROVIDERS } from '../../../../testing/auth-test.util';
import { isValidButtonLabel } from '../../../core/utils/content-rules.util';
import { AuthService } from '../../../core/services/auth/auth.service';
import { MOCK_AUTH_ENABLED } from '../../../core/services/auth/auth.tokens';
import { NotificationService } from '../../../core/services/notification.service';
import {
  PASSWORD_REQUIRED_MESSAGE,
  SIGN_IN_FAILED_MESSAGE,
  SignInComponent,
  USERNAME_REQUIRED_MESSAGE,
} from './sign-in.component';

describe('SignInComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS, provideRouter([])] });
  });

  afterEach(() => {
    clearBrowserStorage();
    TestBed.inject(NotificationService).dismiss();
  });

  function render() {
    const fixture = TestBed.createComponent(SignInComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const username = element.querySelector('#signin-username') as HTMLInputElement;
    const password = element.querySelector('#signin-password') as HTMLInputElement;
    const submit = async (user: string, pass: string) => {
      username.value = user;
      username.dispatchEvent(new Event('input'));
      password.value = pass;
      password.dispatchEvent(new Event('input'));
      (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      await fixture.whenStable();
      fixture.detectChanges();
    };
    return { fixture, element, username, password, submit };
  }

  const buttonByText = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll('button')).find(button =>
      button.textContent?.includes(text)
    ) as HTMLButtonElement;

  it('shows the card with brand, welcome text and every control from the design', () => {
    const { element } = render();
    const text = element.textContent ?? '';
    expect(element.querySelector('h1')?.textContent).toBe('Welcome back');
    expect(text).toContain('Sign in to continue to ShopDesk.');
    expect(text).toContain('Username or email');
    expect(text).toContain('Password');
    expect(text).toContain('Forgot password?');
    expect(text).toContain('Keep me signed in on this device');
    expect(text).toContain('Log in');
    expect(text).toContain('Show on-screen keyboard');
    expect(text).toContain('Works offline · last synced today 09:12');
    expect(text).toContain('ShopDesk');
    expect(text).toContain('Main Shop');
  });

  it('uses a large full-width primary Log in button and an outline keyboard button', () => {
    const { element } = render();
    const login = buttonByText(element, 'Log in');
    expect(login.getAttribute('data-variant')).toBe('primary');
    expect(login.getAttribute('data-size')).toBe('lg');
    expect(login.type).toBe('submit');
    expect(login.closest('app-button')?.classList).toContain('is-block');
    expect(buttonByText(element, 'Show on-screen keyboard').getAttribute('data-variant')).toBe(
      'default'
    );
  });

  it('follows the content rules for button labels', () => {
    const { element } = render();
    for (const label of ['Log in', 'Show on-screen keyboard']) {
      expect(isValidButtonLabel(label)).toBeTrue();
      expect(buttonByText(element, label)).toBeDefined();
    }
  });

  it('hides the password by default and toggles it with an accessible control', () => {
    const { fixture, element, password } = render();
    expect(password.type).toBe('password');
    const reveal = element.querySelector('.signin__reveal') as HTMLButtonElement;
    expect(reveal.getAttribute('aria-label')).toBe('Show password');
    reveal.click();
    fixture.detectChanges();
    expect(password.type).toBe('text');
    expect(reveal.getAttribute('aria-label')).toBe('Hide password');
    reveal.click();
    fixture.detectChanges();
    expect(password.type).toBe('password');
  });

  it('shows what to enter when both fields are empty', async () => {
    const { element, submit } = render();
    await submit('', '');
    const text = element.textContent ?? '';
    expect(text).toContain(USERNAME_REQUIRED_MESSAGE);
    expect(text).toContain(PASSWORD_REQUIRED_MESSAGE);
  });

  it('signs in with a valid sample login and goes to the first allowed module', async () => {
    const { submit } = render();
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    await submit('nimal', 'Owner@2026');
    expect(TestBed.inject(AuthService).isSignedIn()).toBeTrue();
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('shows one generic error under the password field and clears the password on failure', async () => {
    const { element, password, submit } = render();
    await submit('nimal', 'wrong');
    const error = element.querySelector('.field__error');
    expect(error?.textContent).toBe(SIGN_IN_FAILED_MESSAGE);
    expect(password.closest('app-field')?.contains(error)).toBeTrue();
    expect(password.value).toBe('');
    expect(TestBed.inject(AuthService).isSignedIn()).toBeFalse();
  });

  it('gives the same message for an unknown username and never reveals it exists', async () => {
    const { element, submit } = render();
    await submit('ghost', 'wrong');
    expect(element.querySelector('.field__error')?.textContent).toBe(SIGN_IN_FAILED_MESSAGE);
    expect(element.textContent).not.toContain('Unknown');
    expect(element.textContent).not.toContain('does not exist');
  });

  it('clears the error when the user types a new password', async () => {
    const { fixture, element, password, submit } = render();
    await submit('nimal', 'wrong');
    password.value = 'x';
    password.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(element.querySelector('.field__error')).toBeNull();
  });

  it('limits both inputs to 100 characters', () => {
    const { username, password } = render();
    expect(username.maxLength).toBe(100);
    expect(password.maxLength).toBe(100);
  });

  it('gives a sample-only message for forgot password and the on-screen keyboard', () => {
    const { element } = render();
    const notifications = TestBed.inject(NotificationService);
    buttonByText(element, 'Forgot password?').click();
    expect(notifications.current()?.message).toContain('sample only');
    notifications.dismiss();
    buttonByText(element, 'Show on-screen keyboard').click();
    expect(notifications.current()?.message).toContain('sample only');
  });

  it('labels every field and keeps the keep-signed-in choice off by default', () => {
    const { element } = render();
    for (const id of ['signin-username', 'signin-password', 'signin-keep']) {
      expect(element.querySelector(`label[for="${id}"]`))
        .withContext(id)
        .not.toBeNull();
    }
    expect((element.querySelector('#signin-keep') as HTMLInputElement).checked).toBeFalse();
  });

  it('renders a card that fits narrow screens', () => {
    const { element } = render();
    expect(element.querySelector('.signin__card')).not.toBeNull();
  });
});

describe('SignInComponent when sign-in is not configured', () => {
  it('explains it and disables Log in', () => {
    clearBrowserStorage();
    TestBed.configureTestingModule({
      providers: [
        ...TEST_PROVIDERS,
        provideRouter([]),
        { provide: MOCK_AUTH_ENABLED, useValue: false },
      ],
    });
    const fixture = TestBed.createComponent(SignInComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Sign-in is not set up');
    const login = Array.from(element.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Log in')
    ) as HTMLButtonElement;
    expect(login.disabled).toBeTrue();
  });
});
