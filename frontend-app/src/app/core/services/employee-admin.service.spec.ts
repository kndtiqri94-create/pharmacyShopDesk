import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { EmployeeStatus } from '../models/enums/employee-status.enum';
import { ModuleKey } from '../models/enums/module-key.enum';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { emptyEmployeeDraft, toDraft } from '../utils/employee-diff.util';
import { EmployeeFormInput } from '../utils/employee-validation.util';
import { EmployeeAdminService, EmployeeRemoval } from './employee-admin.service';
import { EMPLOYEE_SEED } from './data/in-memory/seed/employee.seed';
import { EmployeeDataService } from './data/employee-data.service';
import { RoleDataService } from './data/role-data.service';
import { PermissionService } from './permission.service';

const validInput = (): EmployeeFormInput => ({
  ...emptyEmployeeDraft('Main Pharmacy'),
  title: 'Mr.',
  code: 'EMP-050',
  firstName: 'Kasun',
  middleName: 'B',
  lastName: 'Silva',
  mobile: '771234567',
});

describe('EmployeeAdminService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const service = () => TestBed.inject(EmployeeAdminService);
  const all = () => firstValueFrom(TestBed.inject(EmployeeDataService).getAll());
  const seedDraft = (id: string) => toDraft(EMPLOYEE_SEED.find(item => item.id === id)!);

  it('creates an employee with a service-set id, created-at, derived name and no user link', async () => {
    await signInAs(UserRole.ADMIN);
    const result = await service().create({
      ...validInput(),
      ...({ id: 'emp-001', userId: 'usr-001', createdAt: '1999-01-01' } as object),
    });
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.employee.id).not.toBe('emp-001');
    expect(result.employee.userId).toBeNull();
    expect(result.employee.createdAt).toContain('2026-09-21T');
    expect(result.employee.name).toBe('Kasun B Silva');
    expect(result.employee.phone).toBe('771234567');
    expect(await all()).toHaveSize(EMPLOYEE_SEED.length + 1);
  });

  it('refuses create and update for every role without write access', async () => {
    for (const role of [UserRole.MANAGER, UserRole.PHARMACIST, UserRole.CASHIER]) {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
      await signInAs(role);
      const created = await service().create(validInput());
      expect(created.ok).withContext(role).toBeFalse();
      if (!created.ok) expect(created.reason).toBe('denied');
      const updated = await service().update('emp-005', seedDraft('emp-005'));
      expect(updated.ok).toBeFalse();
      expect(await service().remove('emp-006')).toEqual({ ok: false, reason: 'denied' });
      expect(await all()).toHaveSize(EMPLOYEE_SEED.length);
    }
  });

  it('refuses everything when nobody is signed in', async () => {
    expect((await service().create(validInput())).ok).toBeFalse();
    expect(await service().remove('emp-006')).toEqual({ ok: false, reason: 'denied' });
  });

  it('honours a changed permission matrix', async () => {
    const permissions = TestBed.inject(PermissionService);
    await permissions.load();
    const roleData = TestBed.inject(RoleDataService);
    const matrix = await firstValueFrom(roleData.getMatrix());
    await firstValueFrom(
      roleData.saveMatrix({
        ...matrix,
        [UserRole.MANAGER]: {
          ...matrix[UserRole.MANAGER],
          [ModuleKey.EMPLOYEES]: PermissionLevel.FULL,
        },
      })
    );
    await permissions.load();
    await signInAs(UserRole.MANAGER);
    expect((await service().create(validInput())).ok).toBeTrue();
  });

  it('saves nothing and reports the first error field for invalid input', async () => {
    await signInAs(UserRole.ADMIN);
    const result = await service().create({ ...validInput(), title: '', mobile: '12' });
    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.reason).toBe('invalid');
      expect(result.firstErrorField).toBe('title');
      expect(result.errors['mobile']).toBeDefined();
    }
    expect(await all()).toHaveSize(EMPLOYEE_SEED.length);
  });

  it('rejects a duplicate code (any case) against freshly read data but accepts own code', async () => {
    await signInAs(UserRole.ADMIN);
    expect((await service().create(validInput())).ok).toBeTrue();
    const duplicate = await service().create({ ...validInput(), code: 'emp-050' });
    expect(duplicate.ok).toBeFalse();
    if (!duplicate.ok) expect(duplicate.firstErrorField).toBe('code');
    const own = await service().update('emp-005', { ...seedDraft('emp-005'), firstName: 'Suri' });
    expect(own.ok).toBeTrue();
    const clash = await service().update('emp-005', { ...seedDraft('emp-005'), code: ' EMP-006 ' });
    expect(clash.ok).toBeFalse();
  });

  it('updates keeping id, created-at and user link and ignores tampered values', async () => {
    await signInAs(UserRole.ADMIN);
    const before = EMPLOYEE_SEED.find(item => item.id === 'emp-002')!;
    const result = await service().update('emp-002', {
      ...seedDraft('emp-002'),
      lastName: 'Renamed',
      createUserAccount: false,
      ...({ userId: null, id: 'x', createdAt: '2000-01-01' } as object),
    });
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.employee.id).toBe('emp-002');
    expect(result.employee.createdAt).toBe(before.createdAt);
    expect(result.employee.userId).toBe(before.userId);
    expect(result.employee.createUserAccount).toBeTrue();
    expect(result.employee.name).toContain('Renamed');
  });

  it('never links a user through create or update', async () => {
    await signInAs(UserRole.ADMIN);
    const created = await service().create({ ...validInput(), createUserAccount: true });
    expect(created.ok && created.employee.userId).toBeNull();
    const updated = await service().update('emp-005', {
      ...seedDraft('emp-005'),
      createUserAccount: true,
    });
    expect(updated.ok && updated.employee.userId).toBeNull();
  });

  it('reports not-found for an unknown id', async () => {
    await signInAs(UserRole.ADMIN);
    const result = await service().update('emp-999', validInput());
    expect(result.ok).toBeFalse();
    if (!result.ok) expect(result.reason).toBe('not-found');
    expect(await service().remove('emp-999')).toEqual({ ok: false, reason: 'not-found' });
  });

  it('removes an employee without history', async () => {
    await signInAs(UserRole.ADMIN);
    const result = await service().remove('emp-006');
    expect(result.ok && result.outcome).toBe(EmployeeRemoval.REMOVED);
    expect((await all()).some(item => item.id === 'emp-006')).toBeFalse();
  });

  it('deactivates instead of removing an employee with a linked user', async () => {
    await signInAs(UserRole.ADMIN);
    const result = await service().remove('emp-002');
    expect(result.ok && result.outcome).toBe(EmployeeRemoval.DEACTIVATED);
    const kept = (await all()).find(item => item.id === 'emp-002');
    expect(kept?.status).toBe(EmployeeStatus.INACTIVE);
    expect(kept?.userId).toBe('usr-002');
  });

  it('ignores a second call while one is in flight', async () => {
    await signInAs(UserRole.ADMIN);
    const [first, second] = await Promise.all([
      service().create(validInput()),
      service().create(validInput()),
    ]);
    expect([first.ok, second.ok]).toEqual([true, false]);
    if (!second.ok) expect(second.reason).toBe('busy');
    expect(await all()).toHaveSize(EMPLOYEE_SEED.length + 1);
  });
});
