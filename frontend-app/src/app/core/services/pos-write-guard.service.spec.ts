import { TestBed } from '@angular/core/testing';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { setPosLevel } from '../../../testing/pos-test.util';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { PosWriteGuard } from './pos-write-guard.service';

describe('PosWriteGuard', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const guard = () => TestBed.inject(PosWriteGuard);

  it('refuses when nobody is signed in', async () => {
    const result = await guard().run('scope', 'No access.', async () => 'done');
    expect(result).toEqual({ ok: false, reason: 'denied', message: 'No access.' });
  });

  it('refuses a user who can only view the till, without running the work', async () => {
    await signInAs(UserRole.CASHIER);
    await setPosLevel(UserRole.CASHIER, PermissionLevel.VIEW);
    let ran = false;
    const result = await guard().run('scope', 'No access.', async () => {
      ran = true;
      return 'done';
    });
    expect(ran).toBeFalse();
    expect(result).toEqual({ ok: false, reason: 'denied', message: 'No access.' });
  });

  it('hands the signed-in user to the work', async () => {
    await signInAs(UserRole.CASHIER);
    const result = await guard().run('scope', 'No access.', async user => user.displayName);
    expect(result).toBe('Ruwani Jayawardena');
  });

  it('refuses a second run of the same scope while the first is in flight, and frees it after', async () => {
    await signInAs(UserRole.CASHIER);
    let release: () => void = () => undefined;
    const first = guard().run(
      'scope',
      'No access.',
      () => new Promise<string>(resolve => (release = () => resolve('first')))
    );
    const second = await guard().run('scope', 'No access.', async () => 'second');
    expect(second).toEqual(jasmine.objectContaining({ ok: false, reason: 'busy' }));
    const other = await guard().run('other-scope', 'No access.', async () => 'other');
    expect(other).toBe('other');
    release();
    expect(await first).toBe('first');
    expect(await guard().run('scope', 'No access.', async () => 'again')).toBe('again');
  });

  it('frees the scope when the work throws', async () => {
    await signInAs(UserRole.CASHIER);
    await guard()
      .run('scope', 'No access.', async () => {
        throw new Error('boom');
      })
      .catch(() => undefined);
    expect(await guard().run('scope', 'No access.', async () => 'ok')).toBe('ok');
  });
});
