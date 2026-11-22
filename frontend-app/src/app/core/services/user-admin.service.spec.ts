import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { ModuleKey } from '../models/enums/module-key.enum';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { UserStatus } from '../models/enums/user-status.enum';
import { UserFormInput } from '../utils/user-validation.util';
import { AuthService } from './auth/auth.service';
import { EmployeeDataService } from './data/employee-data.service';
import { GrnDataService } from './data/grn-data.service';
import { RoleDataService } from './data/role-data.service';
import { UserDataService } from './data/user-data.service';
import { PermissionService } from './permission.service';
import { UserAdminService } from './user-admin.service';

const input: UserFormInput = {
  employeeId: 'emp-005',
  username: 'Suresh',
  role: 'CASHIER',
  password: 'Welcome-1',
  pin: '1234',
  mustChangePassword: true,
};

describe('UserAdminService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const service = () => TestBed.inject(UserAdminService);
  const users = () => firstValueFrom(TestBed.inject(UserDataService).getAll());
  const employee = (id: string) => firstValueFrom(TestBed.inject(EmployeeDataService).getById(id));

  it('creates an Active user, links the employee and stores no password on the user', async () => {
    await signInAs(UserRole.ADMIN);
    const result = await service().createUser(input);
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.user).toEqual({
      id: 'usr-005',
      username: 'suresh',
      displayName: 'Suresh Kumar',
      initials: 'SK',
      role: UserRole.CASHIER,
      employeeId: 'emp-005',
      status: UserStatus.ACTIVE,
      lastSignIn: '',
    });
    expect((await employee('emp-005'))?.userId).toBe('usr-005');
    expect(JSON.stringify(await users())).not.toContain('Welcome-1');
    expect(JSON.stringify(await users())).not.toContain('1234');
  });

  it('lets the new user sign in with the temporary password in this session only', async () => {
    await signInAs(UserRole.ADMIN);
    await service().createUser(input);
    await TestBed.inject(AuthService)
      .signOut()
      .catch(() => undefined);
    const result = await TestBed.inject(AuthService).signIn('suresh', 'Welcome-1', false);
    expect(result.success).toBeTrue();
    expect(JSON.stringify({ ...sessionStorage, ...localStorage })).not.toContain('Welcome-1');
  });

  it('refuses a duplicate username, an employee who already has a sign-in and bad input', async () => {
    await signInAs(UserRole.ADMIN);
    const duplicate = await service().createUser({ ...input, username: ' NIMAL ' });
    expect(duplicate.ok).toBeFalse();
    if (!duplicate.ok) expect(duplicate.errors['username']).toContain('already used');
    const linked = await service().createUser({ ...input, employeeId: 'emp-002' });
    expect(linked.ok).toBeFalse();
    const short = await service().createUser({ ...input, password: 'short', pin: '12' });
    expect(short.ok).toBeFalse();
    if (!short.ok) expect(short.firstErrorField).toBe('password');
    expect(await users()).toHaveSize(4);
  });

  it('cannot create two users for the same employee', async () => {
    await signInAs(UserRole.ADMIN);
    expect((await service().createUser(input)).ok).toBeTrue();
    const second = await service().createUser({ ...input, username: 'other' });
    expect(second.ok).toBeFalse();
    expect(await users()).toHaveSize(5);
  });

  it('changes the role of another user and keeps the link and username', async () => {
    await signInAs(UserRole.ADMIN);
    const result = await service().changeRole('usr-004', UserRole.PHARMACIST);
    expect(result.ok).toBeTrue();
    const saved = (await users()).find(user => user.id === 'usr-004')!;
    expect(saved.role).toBe(UserRole.PHARMACIST);
    expect(saved.username).toBe('ruwani');
    expect(saved.employeeId).toBe('emp-004');
  });

  it('rejects changing your own role, an unknown role and an unknown user', async () => {
    await signInAs(UserRole.ADMIN);
    expect(await service().changeRole('usr-001', UserRole.CASHIER)).toEqual({
      ok: false,
      reason: 'own-account',
    });
    expect(await service().changeRole('usr-004', 'OWNER')).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(await service().changeRole('usr-999', UserRole.CASHIER)).toEqual({
      ok: false,
      reason: 'not-found',
    });
    expect((await users()).find(user => user.id === 'usr-001')?.role).toBe(UserRole.ADMIN);
  });

  it('disables and enables another user and keeps their history', async () => {
    await signInAs(UserRole.ADMIN);
    const grnsBefore = await firstValueFrom(TestBed.inject(GrnDataService).getAll());
    const disabled = await service().setDisabled('usr-003', true);
    expect(disabled.ok && disabled.user.status).toBe(UserStatus.DISABLED);
    expect(await users()).toHaveSize(4);
    expect(await firstValueFrom(TestBed.inject(GrnDataService).getAll())).toEqual(grnsBefore);
    expect(grnsBefore.some(grn => grn.receivedBy === 'Dilani Fernando')).toBeTrue();
    const enabled = await service().setDisabled('usr-003', false);
    expect(enabled.ok && enabled.user.status).toBe(UserStatus.ACTIVE);
  });

  it('refuses to disable the signed-in person', async () => {
    await signInAs(UserRole.ADMIN);
    expect(await service().setDisabled('usr-001', true)).toEqual({
      ok: false,
      reason: 'own-account',
    });
    expect((await users()).find(user => user.id === 'usr-001')?.status).toBe(UserStatus.ACTIVE);
  });

  it('refuses everything for anyone who is not an Admin', async () => {
    for (const role of [UserRole.MANAGER, UserRole.PHARMACIST, UserRole.CASHIER]) {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
      await signInAs(role);
      expect((await service().createUser(input)).ok)
        .withContext(role)
        .toBeFalse();
      expect(await service().changeRole('usr-004', UserRole.MANAGER)).toEqual({
        ok: false,
        reason: 'denied',
      });
      expect(await service().setDisabled('usr-004', true)).toEqual({ ok: false, reason: 'denied' });
      expect(await users()).toHaveSize(4);
    }
  });

  describe('when a non-Admin has been given Full access to Users', () => {
    beforeEach(async () => {
      const permissions = TestBed.inject(PermissionService);
      await permissions.load();
      const roleData = TestBed.inject(RoleDataService);
      const matrix = await firstValueFrom(roleData.getMatrix());
      await firstValueFrom(
        roleData.saveMatrix({
          ...matrix,
          [UserRole.MANAGER]: {
            ...matrix[UserRole.MANAGER],
            [ModuleKey.USERS]: PermissionLevel.FULL,
          },
        })
      );
      await permissions.load();
      await signInAs(UserRole.MANAGER);
    });

    it('cannot create an Admin but can create other roles', async () => {
      const admin = await service().createUser({ ...input, role: UserRole.ADMIN });
      expect(admin.ok).toBeFalse();
      if (!admin.ok) expect(admin.reason).toBe('denied');
      expect(await users()).toHaveSize(4);
      expect((await service().createUser(input)).ok).toBeTrue();
    });

    it('cannot make anyone an Admin', async () => {
      expect(await service().changeRole('usr-004', UserRole.ADMIN)).toEqual({
        ok: false,
        reason: 'denied',
      });
      expect((await users()).find(user => user.id === 'usr-004')?.role).not.toBe(UserRole.ADMIN);
    });

    it('cannot change the role of or disable an existing Admin', async () => {
      expect(await service().changeRole('usr-001', UserRole.CASHIER)).toEqual({
        ok: false,
        reason: 'denied',
      });
      expect(await service().setDisabled('usr-001', true)).toEqual({
        ok: false,
        reason: 'denied',
      });
      const admin = (await users()).find(user => user.id === 'usr-001')!;
      expect(admin.role).toBe(UserRole.ADMIN);
      expect(admin.status).toBe(UserStatus.ACTIVE);
    });

    it('can still manage non-Admin users', async () => {
      expect((await service().changeRole('usr-004', UserRole.PHARMACIST)).ok).toBeTrue();
      expect((await service().setDisabled('usr-004', true)).ok).toBeTrue();
    });
  });

  it('lets an Admin assign Admin and change or disable another Admin', async () => {
    await signInAs(UserRole.ADMIN);
    expect((await service().createUser({ ...input, role: UserRole.ADMIN })).ok).toBeTrue();
    const promoted = await service().changeRole('usr-004', UserRole.ADMIN);
    expect(promoted.ok).toBeTrue();
    expect((await service().changeRole('usr-004', UserRole.CASHIER)).ok).toBeTrue();
    await service().changeRole('usr-004', UserRole.ADMIN);
    expect((await service().setDisabled('usr-004', true)).ok).toBeTrue();
  });

  it('ignores a second create while one is in flight', async () => {
    await signInAs(UserRole.ADMIN);
    const [first, second] = await Promise.all([
      service().createUser(input),
      service().createUser(input),
    ]);
    expect([first.ok, second.ok]).toEqual([true, false]);
    expect(await users()).toHaveSize(5);
  });

  it('refuses everything when nobody is signed in', async () => {
    expect((await service().createUser(input)).ok).toBeFalse();
    expect(await service().setDisabled('usr-004', true)).toEqual({ ok: false, reason: 'denied' });
  });
});
