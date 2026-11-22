import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { DiscountApproval } from '../models/domain/discount-approval.model';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { UserStatus } from '../models/enums/user-status.enum';
import { AuthService } from './auth/auth.service';
import { MOCK_CREDENTIALS } from './auth/mock-credentials';
import { RoleDataService } from './data/role-data.service';
import { UserDataService } from './data/user-data.service';
import { PermissionService } from './permission.service';
import { PosDiscountApprovalService } from './pos-discount-approval.service';

const OWNER = MOCK_CREDENTIALS[0];
const MANAGER = MOCK_CREDENTIALS[1];
const PHARMACIST = MOCK_CREDENTIALS[2];
const CASHIER = MOCK_CREDENTIALS[3];
const LINE_CHANGE = { scope: 'LINE', productId: 'prod-001', percent: 10 } as const;

describe('PosDiscountApprovalService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const service = () => TestBed.inject(PosDiscountApprovalService);

  async function approvedBy(username: string, password: string): Promise<DiscountApproval> {
    const result = await service().approve(LINE_CHANGE, username, password);
    if (!result.ok) throw new Error('Expected an approval');
    return result.approval;
  }

  async function setPosLevel(role: UserRole, level: PermissionLevel): Promise<void> {
    await TestBed.inject(PermissionService).load();
    const roleData = TestBed.inject(RoleDataService);
    const matrix = await firstValueFrom(roleData.getMatrix());
    await firstValueFrom(
      roleData.saveMatrix({ ...matrix, [role]: { ...matrix[role], pos: level } })
    );
  }

  describe('who can approve', () => {
    it('accepts an active Admin and records the approver name and time', async () => {
      await signInAs(UserRole.CASHIER);
      const approval = await approvedBy(OWNER.username, OWNER.password);
      expect(approval.approverName).toBe('Nimal Perera');
      expect(approval.approverUserId).toBe('usr-001');
      expect(approval.approvedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      expect(approval.scope).toBe('LINE');
      expect(approval.productId).toBe('prod-001');
      expect(approval.percent).toBe(10);
    });

    it('still asks a signed-in Admin for credentials', async () => {
      await signInAs(UserRole.ADMIN);
      expect(await service().approve(LINE_CHANGE, '', '')).toEqual({
        ok: false,
        reason: 'not-accepted',
      });
      expect(await service().approve(LINE_CHANGE, OWNER.username, 'wrong')).toEqual({
        ok: false,
        reason: 'not-accepted',
      });
    });

    it('rejects a Manager, a Pharmacist and a Cashier with the active Admin message', async () => {
      await signInAs(UserRole.CASHIER);
      for (const credential of [MANAGER, PHARMACIST, CASHIER]) {
        expect(
          await service().approve(LINE_CHANGE, credential.username, credential.password)
        ).toEqual({
          ok: false,
          reason: 'not-admin',
        });
      }
    });

    it('rejects an Admin whose account is disabled', async () => {
      await signInAs(UserRole.CASHIER);
      const userDataService = TestBed.inject(UserDataService);
      const admin = (await firstValueFrom(userDataService.getById('usr-001')))!;
      await firstValueFrom(userDataService.save({ ...admin, status: UserStatus.DISABLED }));
      expect(await service().approve(LINE_CHANGE, OWNER.username, OWNER.password)).toEqual({
        ok: false,
        reason: 'not-admin',
      });
    });

    it('rejects a user who was changed from Admin to another role during the session', async () => {
      await signInAs(UserRole.CASHIER);
      const userDataService = TestBed.inject(UserDataService);
      const admin = (await firstValueFrom(userDataService.getById('usr-001')))!;
      await firstValueFrom(userDataService.save({ ...admin, role: UserRole.MANAGER }));
      expect((await service().approve(LINE_CHANGE, OWNER.username, OWNER.password)).ok).toBeFalse();
    });

    it('rejects wrong passwords, unknown users, mixed pairs and over-long input', async () => {
      await signInAs(UserRole.CASHIER);
      const attempts: [string, string][] = [
        [OWNER.username, 'wrong'],
        ['ghost', OWNER.password],
        [OWNER.username, MANAGER.password],
        [OWNER.username, `${OWNER.password}${'x'.repeat(200)}`],
        ['n'.repeat(500), OWNER.password],
      ];
      for (const [username, password] of attempts) {
        expect(await service().approve(LINE_CHANGE, username, password)).toEqual({
          ok: false,
          reason: 'not-accepted',
        });
      }
    });

    it('keeps working after many failed attempts', async () => {
      await signInAs(UserRole.CASHIER);
      for (let attempt = 0; attempt < 6; attempt += 1) {
        await service().approve(LINE_CHANGE, OWNER.username, 'wrong');
      }
      expect((await service().approve(LINE_CHANGE, OWNER.username, OWNER.password)).ok).toBeTrue();
    });
  });

  describe('who can ask', () => {
    it('denies anyone who is signed out', async () => {
      expect(await service().approve(LINE_CHANGE, OWNER.username, OWNER.password)).toEqual({
        ok: false,
        reason: 'denied',
      });
    });

    it('denies a user with view-only or no POS access', async () => {
      await signInAs(UserRole.CASHIER);
      await setPosLevel(UserRole.CASHIER, PermissionLevel.VIEW);
      expect((await service().approve(LINE_CHANGE, OWNER.username, OWNER.password)).ok).toBeFalse();
      await setPosLevel(UserRole.CASHIER, PermissionLevel.NONE);
      expect(await service().approve(LINE_CHANGE, OWNER.username, OWNER.password)).toEqual({
        ok: false,
        reason: 'denied',
      });
    });

    it('turns away a second request while one is being checked', async () => {
      await signInAs(UserRole.CASHIER);
      const [first, second] = await Promise.all([
        service().approve(LINE_CHANGE, OWNER.username, OWNER.password),
        service().approve(LINE_CHANGE, OWNER.username, OWNER.password),
      ]);
      expect(first.ok).toBeTrue();
      expect(second).toEqual({ ok: false, reason: 'busy' });
    });
  });

  describe('credentials stay private', () => {
    it('does not change who is signed in', async () => {
      await signInAs(UserRole.CASHIER);
      await approvedBy(OWNER.username, OWNER.password);
      expect(TestBed.inject(AuthService).currentUser()?.id).toBe('usr-004');
    });

    it('keeps the password out of the approval, the service and storage', async () => {
      await signInAs(UserRole.CASHIER);
      const approval = await approvedBy(OWNER.username, OWNER.password);
      expect(JSON.stringify(approval)).not.toContain(OWNER.password);
      const held = Object.values(service() as unknown as Record<string, unknown>).map(value =>
        typeof value === 'string' ? value : ''
      );
      expect(held.join('')).not.toContain(OWNER.password);
      expect(JSON.stringify({ ...sessionStorage, ...localStorage })).not.toContain(OWNER.password);
    });

    it('returns a frozen approval', async () => {
      await signInAs(UserRole.CASHIER);
      expect(Object.isFrozen(await approvedBy(OWNER.username, OWNER.password))).toBeTrue();
    });
  });

  describe('redeeming an approval', () => {
    it('accepts the matching change once and refuses it the second time', async () => {
      await signInAs(UserRole.CASHIER);
      const approval = await approvedBy(OWNER.username, OWNER.password);
      expect(service().redeem(approval, 'LINE', 'prod-001', 10)).toBeTrue();
      expect(service().redeem(approval, 'LINE', 'prod-001', 10)).toBeFalse();
    });

    it('refuses a different scope, product or value and keeps the approval usable', async () => {
      await signInAs(UserRole.CASHIER);
      const approval = await approvedBy(OWNER.username, OWNER.password);
      expect(service().redeem(approval, 'BILL', 'prod-001', 10)).toBeFalse();
      expect(service().redeem(approval, 'LINE', 'prod-002', 10)).toBeFalse();
      expect(service().redeem(approval, 'LINE', 'prod-001', 15)).toBeFalse();
      expect(service().redeem(approval, 'LINE', 'prod-001', 10)).toBeTrue();
    });

    it('refuses a missing approval and a forged copy that was never issued', async () => {
      await signInAs(UserRole.CASHIER);
      const approval = await approvedBy(OWNER.username, OWNER.password);
      expect(service().redeem(null, 'LINE', 'prod-001', 10)).toBeFalse();
      expect(service().redeem({ ...approval }, 'LINE', 'prod-001', 10)).toBeFalse();
    });
  });
});
