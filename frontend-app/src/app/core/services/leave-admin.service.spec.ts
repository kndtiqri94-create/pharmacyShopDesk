import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { LeaveReason } from '../models/enums/leave-reason.enum';
import { LeaveStatus } from '../models/enums/leave-status.enum';
import { ModuleKey } from '../models/enums/module-key.enum';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { balanceFor } from '../utils/leave-balance.util';
import { LeaveFormInput } from '../utils/leave-validation.util';
import { LeaveDataService } from './data/leave-data.service';
import { LEAVE_REQUEST_SEED } from './data/in-memory/seed/leave.seed';
import { LeaveAdminService } from './leave-admin.service';
import { PermissionService } from './permission.service';
import { RoleDataService } from './data/role-data.service';

const ANNUAL = 'lt-001';
const CASUAL = 'lt-003';

const validInput = (overrides: Partial<LeaveFormInput> = {}): LeaveFormInput => ({
  employeeId: 'emp-005',
  year: 2026,
  leaveTypeId: ANNUAL,
  fromDate: '2026-11-02',
  toDate: '2026-11-04',
  reason: LeaveReason.FAMILY,
  comments: ' Wedding ',
  attachment: null,
  coveringEmployeeId: '',
  approverEmployeeId: 'emp-002',
  ...overrides,
});

describe('LeaveAdminService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const service = () => TestBed.inject(LeaveAdminService);
  const requests = () => firstValueFrom(TestBed.inject(LeaveDataService).getRequests());
  const balance = async (employeeId: string, typeId: string) => {
    const data = TestBed.inject(LeaveDataService);
    return balanceFor(
      employeeId,
      typeId,
      2026,
      await firstValueFrom(data.getEntitlements()),
      await requests()
    );
  };
  const fresh = (role: UserRole) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    return signInAs(role);
  };

  describe('apply', () => {
    it('creates a Pending request with service-set fields', async () => {
      await signInAs(UserRole.ADMIN);
      const result = await service().apply(validInput());
      expect(result.ok).toBeTrue();
      if (!result.ok) return;
      expect(result.request.status).toBe(LeaveStatus.PENDING);
      expect(result.request.days).toBe(3);
      expect(result.request.comments).toBe('Wedding');
      expect(result.request.createdAt).toContain('2026-09-21T');
      expect(result.request.decidedAt).toBeNull();
      expect(result.request.approverComment).toBe('');
      expect(await requests()).toHaveSize(LEAVE_REQUEST_SEED.length + 1);
      expect((await balance('emp-005', ANNUAL)).pending).toBe(3);
    });

    it('ignores tampered status, days, id and timestamps', async () => {
      await signInAs(UserRole.ADMIN);
      const tampered = {
        ...validInput(),
        id: 'leave-001',
        status: LeaveStatus.APPROVED,
        days: 99,
        createdAt: '1999-01-01',
        decidedAt: '1999-01-02',
        approverComment: 'sneaky',
      } as LeaveFormInput;
      const result = await service().apply(tampered);
      expect(result.ok).toBeTrue();
      if (!result.ok) return;
      expect(result.request.id).not.toBe('leave-001');
      expect(result.request.status).toBe(LeaveStatus.PENDING);
      expect(result.request.days).toBe(3);
      expect(result.request.createdAt).toContain('2026-09-21T');
      expect(result.request.decidedAt).toBeNull();
      expect(result.request.approverComment).toBe('');
      expect((await requests()).find(item => item.id === 'leave-001')!.status).toBe(
        LeaveStatus.APPROVED
      );
    });

    it('refuses every role without write access', async () => {
      for (const role of [UserRole.MANAGER, UserRole.PHARMACIST, UserRole.CASHIER]) {
        await fresh(role);
        const result = await service().apply(validInput());
        expect(result.ok).withContext(role).toBeFalse();
        if (!result.ok) expect(result.reason).toBe('denied');
        expect(await requests()).toHaveSize(LEAVE_REQUEST_SEED.length);
      }
    });

    it('refuses when nobody is signed in', async () => {
      const result = await service().apply(validInput());
      expect(result.ok).toBeFalse();
      if (!result.ok) expect(result.reason).toBe('denied');
      expect((await service().cancel('leave-002')).ok).toBeFalse();
      expect((await service().decide('leave-002', 'APPROVE', '')).ok).toBeFalse();
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
      expect((await service().apply(validInput())).ok).toBeTrue();
    });

    it('saves nothing and reports the first error field for invalid input', async () => {
      await signInAs(UserRole.ADMIN);
      const result = await service().apply(
        validInput({ leaveTypeId: '', fromDate: '2026-02-31', reason: '' })
      );
      expect(result.ok).toBeFalse();
      if (!result.ok) {
        expect(result.reason).toBe('invalid');
        expect(result.firstErrorField).toBe('leaveTypeId');
        expect(result.errors['fromDate']).toBeDefined();
        expect(result.errors['leaveTypeId']).toBeDefined();
      }
      expect(await requests()).toHaveSize(LEAVE_REQUEST_SEED.length);
    });

    it('catches a stale overlap using freshly read requests', async () => {
      await signInAs(UserRole.ADMIN);
      expect((await service().apply(validInput())).ok).toBeTrue();
      const again = await service().apply(
        validInput({ fromDate: '2026-11-04', toDate: '2026-11-06' })
      );
      expect(again.ok).toBeFalse();
      if (!again.ok) {
        expect(again.reason).toBe('invalid');
        expect(again.firstErrorField).toBe('fromDate');
      }
      expect(await requests()).toHaveSize(LEAVE_REQUEST_SEED.length + 1);
    });

    it('catches a stale balance using freshly read requests', async () => {
      await signInAs(UserRole.ADMIN);
      const first = validInput({
        leaveTypeId: CASUAL,
        fromDate: '2026-11-02',
        toDate: '2026-11-06',
      });
      expect((await service().apply(first)).ok).toBeTrue();
      const second = await service().apply(
        validInput({ leaveTypeId: CASUAL, fromDate: '2026-11-09', toDate: '2026-11-11' })
      );
      expect(second.ok).toBeFalse();
      if (!second.ok) expect(second.errors['toDate']).toContain('Only 2.00 days');
    });

    it('blocks a second submit while one is in flight', async () => {
      await signInAs(UserRole.ADMIN);
      const [first, second] = await Promise.all([
        service().apply(validInput()),
        service().apply(validInput({ fromDate: '2026-12-01', toDate: '2026-12-01' })),
      ]);
      expect(first.ok).toBeTrue();
      expect(second.ok).toBeFalse();
      if (!second.ok) expect(second.reason).toBe('busy');
      expect(await requests()).toHaveSize(LEAVE_REQUEST_SEED.length + 1);
      expect(
        (await service().apply(validInput({ fromDate: '2026-12-01', toDate: '2026-12-01' }))).ok
      ).toBeTrue();
    });
  });

  describe('decide', () => {
    it('approve moves the days from Pending to Utilized', async () => {
      await signInAs(UserRole.MANAGER);
      const before = await balance('emp-003', ANNUAL);
      const result = await service().decide('leave-002', 'APPROVE', ' Enjoy ');
      expect(result.ok).toBeTrue();
      if (!result.ok) return;
      expect(result.request.status).toBe(LeaveStatus.APPROVED);
      expect(result.request.approverComment).toBe('Enjoy');
      expect(result.request.decidedAt).toContain('2026-09-21T');
      const after = await balance('emp-003', ANNUAL);
      expect(after.pending).toBe(before.pending - 3);
      expect(after.utilized).toBe(before.utilized + 3);
      expect(after.balance).toBe(before.balance);
    });

    it('reject releases the days', async () => {
      await signInAs(UserRole.MANAGER);
      const before = await balance('emp-003', ANNUAL);
      const result = await service().decide('leave-002', 'REJECT', 'Short staffed');
      expect(result.ok).toBeTrue();
      if (!result.ok) return;
      expect(result.request.status).toBe(LeaveStatus.REJECTED);
      const after = await balance('emp-003', ANNUAL);
      expect(after.pending).toBe(before.pending - 3);
      expect(after.utilized).toBe(before.utilized);
      expect(after.balance).toBe(before.balance + 3);
    });

    it('lets an Admin decide a request assigned to someone else', async () => {
      await signInAs(UserRole.ADMIN);
      expect((await service().decide('leave-002', 'APPROVE', '')).ok).toBeTrue();
    });

    it('rejects a wrong actor', async () => {
      for (const role of [UserRole.PHARMACIST, UserRole.CASHIER]) {
        await fresh(role);
        const result = await service().decide('leave-002', 'APPROVE', '');
        expect(result.ok).withContext(role).toBeFalse();
        if (!result.ok) expect(result.reason).toBe('not-allowed');
        const stored = (await requests()).find(item => item.id === 'leave-002')!;
        expect(stored.status).toBe(LeaveStatus.PENDING);
      }
    });

    it('rejects a Manager who is not the assigned approver', async () => {
      await signInAs(UserRole.ADMIN);
      const created = await service().apply(validInput({ approverEmployeeId: 'emp-001' }));
      expect(created.ok).toBeTrue();
      if (!created.ok) return;
      await signInAs(UserRole.MANAGER);
      const result = await service().decide(created.request.id, 'APPROVE', '');
      expect(result.ok).toBeFalse();
      if (!result.ok) expect(result.reason).toBe('not-allowed');
    });

    it('rejects an applicant deciding their own request, even an Admin', async () => {
      await signInAs(UserRole.ADMIN);
      const created = await service().apply(
        validInput({ employeeId: 'emp-001', approverEmployeeId: 'emp-002' })
      );
      expect(created.ok).toBeTrue();
      if (!created.ok) return;
      const result = await service().decide(created.request.id, 'APPROVE', '');
      expect(result.ok).toBeFalse();
      if (!result.ok) expect(result.reason).toBe('not-allowed');
    });

    it('rejects deciding an already decided request', async () => {
      await signInAs(UserRole.MANAGER);
      expect((await service().decide('leave-002', 'APPROVE', '')).ok).toBeTrue();
      const again = await service().decide('leave-002', 'REJECT', '');
      expect(again.ok).toBeFalse();
      if (!again.ok) expect(again.reason).toBe('not-allowed');
      const seeded = await service().decide('leave-004', 'APPROVE', '');
      expect(seeded.ok).toBeFalse();
      expect((await requests()).find(item => item.id === 'leave-002')!.status).toBe(
        LeaveStatus.APPROVED
      );
    });

    it('reports not-found and an oversized comment without saving', async () => {
      await signInAs(UserRole.MANAGER);
      const missing = await service().decide('nope', 'APPROVE', '');
      expect(missing.ok).toBeFalse();
      if (!missing.ok) expect(missing.reason).toBe('not-found');
      const long = await service().decide('leave-002', 'APPROVE', 'x'.repeat(251));
      expect(long.ok).toBeFalse();
      if (!long.ok) {
        expect(long.reason).toBe('invalid');
        expect(long.firstErrorField).toBe('approverComment');
      }
      expect((await requests()).find(item => item.id === 'leave-002')!.status).toBe(
        LeaveStatus.PENDING
      );
    });

    it('rejects an unknown decision value', async () => {
      await signInAs(UserRole.ADMIN);
      const result = await service().decide('leave-002', 'DELETE' as 'APPROVE', '');
      expect(result.ok).toBeFalse();
      if (!result.ok) expect(result.reason).toBe('invalid');
    });
  });

  describe('cancel', () => {
    it('cancels a Pending request and releases its days', async () => {
      await signInAs(UserRole.ADMIN);
      const before = await balance('emp-003', ANNUAL);
      const result = await service().cancel('leave-002');
      expect(result.ok).toBeTrue();
      if (!result.ok) return;
      expect(result.request.status).toBe(LeaveStatus.CANCELLED);
      expect(result.request.decidedAt).toContain('2026-09-21T');
      expect((await balance('emp-003', ANNUAL)).balance).toBe(before.balance + 3);
    });

    it('cancels an Approved request that has not started', async () => {
      await signInAs(UserRole.ADMIN);
      const result = await service().cancel('leave-009');
      expect(result.ok).toBeTrue();
    });

    it('rejects cancelling an Approved request that has started', async () => {
      await signInAs(UserRole.ADMIN);
      const result = await service().cancel('leave-001');
      expect(result.ok).toBeFalse();
      if (!result.ok) expect(result.reason).toBe('not-allowed');
      expect((await requests()).find(item => item.id === 'leave-001')!.status).toBe(
        LeaveStatus.APPROVED
      );
    });

    it('treats terminal requests as final', async () => {
      await signInAs(UserRole.ADMIN);
      for (const id of ['leave-004', 'leave-005']) {
        const result = await service().cancel(id);
        expect(result.ok).withContext(id).toBeFalse();
        if (!result.ok) expect(result.reason).toBe('not-allowed');
      }
      const missing = await service().cancel('nope');
      expect(missing.ok).toBeFalse();
      if (!missing.ok) expect(missing.reason).toBe('not-found');
    });

    it('rejects non-Admin roles', async () => {
      for (const role of [UserRole.MANAGER, UserRole.PHARMACIST, UserRole.CASHIER]) {
        await fresh(role);
        const result = await service().cancel('leave-002');
        expect(result.ok).withContext(role).toBeFalse();
        if (!result.ok) expect(result.reason).toBe('denied');
        expect((await requests()).find(item => item.id === 'leave-002')!.status).toBe(
          LeaveStatus.PENDING
        );
      }
    });
  });

  describe('applyApprovedDay', () => {
    const input = { employeeId: 'emp-005', date: '2026-09-22' };

    it('saves an approved one-day request with a service-derived approver', async () => {
      await signInAs(UserRole.ADMIN);
      const result = await service().applyApprovedDay(input);
      expect(result.ok).toBeTrue();
      if (!result.ok) return;
      expect(result.request.status).toBe(LeaveStatus.APPROVED);
      expect(result.request.approverEmployeeId).not.toBe('emp-005');
      expect(result.request.decidedAt).not.toBeNull();
      expect(result.request.comments).toBe('Added from Payroll');
    });

    it('rejects non-Admin roles and signed-out callers', async () => {
      for (const role of [UserRole.MANAGER, UserRole.PHARMACIST, UserRole.CASHIER]) {
        await fresh(role);
        const result = await service().applyApprovedDay(input);
        expect(result.ok).withContext(role).toBeFalse();
        if (!result.ok) expect(result.reason).toBe('denied');
      }
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
      expect((await service().applyApprovedDay(input)).ok).toBeFalse();
    });

    it('applies the leave rules and saves nothing when invalid', async () => {
      await signInAs(UserRole.ADMIN);
      const before = (await requests()).length;
      const result = await service().applyApprovedDay({ ...input, date: '2026-02-31' });
      expect(result.ok).toBeFalse();
      expect(await requests()).toHaveSize(before);
    });
  });
});
