import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, TEST_PROVIDERS } from '../../../../testing/auth-test.util';
import { UserRole } from '../../models/enums/user-role.enum';
import { UserStatus } from '../../models/enums/user-status.enum';
import { UserDataService } from '../data/user-data.service';
import { MOCK_AUTH_ENABLED } from './auth.tokens';
import { AuthService } from './auth.service';
import { MOCK_CREDENTIALS } from './mock-credentials';
import { SessionCredentialStore } from './session-credential-store.service';
import { SESSION_STORAGE_KEY } from './session-storage.service';

describe('AuthService', () => {
  const ownerCredential = MOCK_CREDENTIALS[0];

  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const service = () => TestBed.inject(AuthService);

  it('signs in with a valid sample username and password', async () => {
    const result = await service().signIn(
      ownerCredential.username,
      ownerCredential.password,
      false
    );
    expect(result.success).toBeTrue();
    expect(service().isSignedIn()).toBeTrue();
    expect(service().currentUser()?.role).toBe(UserRole.ADMIN);
  });

  it('accepts the username in any letter case with surrounding spaces', async () => {
    const result = await service().signIn(' NIMAL ', ownerCredential.password, false);
    expect(result.success).toBeTrue();
  });

  it('fails with the same reason for a wrong password and an unknown user', async () => {
    const wrongPassword = await service().signIn('nimal', 'wrong-password', false);
    const unknownUser = await service().signIn('ghost', 'wrong-password', false);
    expect(wrongPassword).toEqual({ success: false, reason: 'invalid' });
    expect(unknownUser).toEqual(wrongPassword);
    expect(service().isSignedIn()).toBeFalse();
  });

  it('does not accept one user name with another user password', async () => {
    const result = await service().signIn('nimal', MOCK_CREDENTIALS[1].password, false);
    expect(result.success).toBeFalse();
  });

  it('rejects empty fields without checking credentials', async () => {
    expect(await service().signIn('', 'x', false)).toEqual({ success: false, reason: 'empty' });
    expect(await service().signIn('nimal', '', false)).toEqual({ success: false, reason: 'empty' });
    expect(await service().signIn('   ', 'x', false)).toEqual({ success: false, reason: 'empty' });
  });

  it('rejects over-long values instead of trimming them to a match', async () => {
    const longPassword = `${ownerCredential.password}${'x'.repeat(200)}`;
    expect((await service().signIn('nimal', longPassword, false)).success).toBeFalse();
    expect((await service().signIn('n'.repeat(500), 'x', false)).success).toBeFalse();
  });

  it('stores only the user id, never the password or the role', async () => {
    await service().signIn(ownerCredential.username, ownerCredential.password, false);
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    expect(stored).toBe('usr-001');
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(ownerCredential.password);
    expect(JSON.stringify({ ...localStorage })).not.toContain(ownerCredential.password);
  });

  it('uses local storage only when keep me signed in is chosen', async () => {
    await service().signIn(ownerCredential.username, ownerCredential.password, true);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBe('usr-001');
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('restores the user from the stored id on reload', async () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'usr-003');
    await service().restoreSession();
    expect(service().currentUser()?.role).toBe(UserRole.PHARMACIST);
  });

  it('never trusts a role written to storage', async () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'usr-004');
    sessionStorage.setItem('shopdesk.role', 'ADMIN');
    await service().restoreSession();
    expect(service().currentUser()?.role).toBe(UserRole.CASHIER);
  });

  it('stays signed out and clears storage when the stored id is unknown', async () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'usr-999');
    await service().restoreSession();
    expect(service().isSignedIn()).toBeFalse();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('signs out, clears the session and goes to sign in', async () => {
    await service().signIn(ownerCredential.username, ownerCredential.password, true);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    await service().signOut();
    expect(service().isSignedIn()).toBeFalse();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/sign-in'], { replaceUrl: true });
  });

  it('keeps working after five failed attempts', async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await service().signIn('nimal', 'wrong', false);
    }
    const result = await service().signIn(
      ownerCredential.username,
      ownerCredential.password,
      false
    );
    expect(result.success).toBeTrue();
  });
});

describe('AuthService when sign-in is not configured', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({
      providers: [...TEST_PROVIDERS, { provide: MOCK_AUTH_ENABLED, useValue: false }],
    });
  });

  it('refuses sample logins and reports it is not configured', async () => {
    const service = TestBed.inject(AuthService);
    expect(service.isConfigured).toBeFalse();
    const result = await service.signIn('nimal', 'Owner@2026', false);
    expect(result).toEqual({ success: false, reason: 'not-configured' });
    expect(service.isSignedIn()).toBeFalse();
  });

  it('ignores and clears a forged stored session id', async () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'usr-001');
    localStorage.setItem(SESSION_STORAGE_KEY, 'usr-001');
    const service = TestBed.inject(AuthService);
    await service.restoreSession();
    expect(service.isSignedIn()).toBeFalse();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});

describe('AuthService restoreSession when sign-in is configured', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({
      providers: [...TEST_PROVIDERS, { provide: MOCK_AUTH_ENABLED, useValue: true }],
    });
  });

  afterEach(clearBrowserStorage);

  it('restores a valid stored id only when sign-in is configured', async () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'usr-001');
    const service = TestBed.inject(AuthService);
    await service.restoreSession();
    expect(service.currentUser()?.id).toBe('usr-001');
  });
});

describe('AuthService with users created in this session', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const createSession = async () => {
    const userDataService = TestBed.inject(UserDataService);
    const user = await firstValueFrom(
      userDataService.save({
        id: 'usr-005',
        username: 'suresh',
        displayName: 'Suresh Kumar',
        initials: 'SK',
        role: UserRole.CASHIER,
        employeeId: 'emp-005',
        status: UserStatus.ACTIVE,
        lastSignIn: '',
      })
    );
    TestBed.inject(SessionCredentialStore).register(user.username, {
      userId: user.id,
      password: 'Welcome-1',
      pin: null,
      mustChangePassword: true,
    });
    return userDataService;
  };

  it('signs a new user in with the temporary password', async () => {
    await createSession();
    const result = await TestBed.inject(AuthService).signIn('Suresh', 'Welcome-1', false);
    expect(result.success).toBeTrue();
  });

  it('keeps the same failure for a wrong password on a new user', async () => {
    await createSession();
    const result = await TestBed.inject(AuthService).signIn('suresh', 'Welcome-2', false);
    expect(result).toEqual({ success: false, reason: 'invalid' });
  });

  it('refuses a disabled user with its own reason, but only when the password is right', async () => {
    const userDataService = await createSession();
    const user = (await firstValueFrom(userDataService.getById('usr-005')))!;
    await firstValueFrom(userDataService.save({ ...user, status: UserStatus.DISABLED }));
    const service = TestBed.inject(AuthService);
    expect(await service.signIn('suresh', 'Welcome-1', false)).toEqual({
      success: false,
      reason: 'disabled',
    });
    expect(await service.signIn('suresh', 'wrong-password', false)).toEqual({
      success: false,
      reason: 'invalid',
    });
    expect(service.isSignedIn()).toBeFalse();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('refuses a disabled sample user and does not restore a disabled stored session', async () => {
    const userDataService = TestBed.inject(UserDataService);
    const user = (await firstValueFrom(userDataService.getById('usr-004')))!;
    await firstValueFrom(userDataService.save({ ...user, status: UserStatus.DISABLED }));
    const service = TestBed.inject(AuthService);
    const cashier = MOCK_CREDENTIALS[3];
    expect(await service.signIn(cashier.username, cashier.password, false)).toEqual({
      success: false,
      reason: 'disabled',
    });
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'usr-004');
    await service.restoreSession();
    expect(service.isSignedIn()).toBeFalse();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});
