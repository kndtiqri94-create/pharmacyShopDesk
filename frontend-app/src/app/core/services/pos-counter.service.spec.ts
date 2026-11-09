import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import {
  TEST_TODAY,
  counterCloseInput,
  setPosLevel,
  testBill,
} from '../../../testing/pos-test.util';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { UserStatus } from '../models/enums/user-status.enum';
import { ClockService } from './clock.service';
import { UserDataService } from './data/user-data.service';
import { PosCashService } from './pos-cash.service';
import {
  COUNTER_REGISTER_NAME,
  PosCounterService,
  SUPERVISOR_INVALID_MESSAGE,
} from './pos-counter.service';
import { PosSaleService } from './pos-sale.service';
import { DAY_LOCKED_MESSAGE } from './pos-write-guard.service';

const ADMIN_ID = 'usr-001';
const MANAGER_ID = 'usr-002';
const PHARMACIST_ID = 'usr-003';
const CASHIER_ID = 'usr-004';

describe('PosCounterService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const service = () => TestBed.inject(PosCounterService);

  async function prepareDay(): Promise<void> {
    await TestBed.inject(PosCashService).saveOpening('1000', false);
    await TestBed.inject(PosSaleService).save(
      testBill({ payments: { ...testBill().payments, cash: '20' } })
    );
  }

  async function disableManager(): Promise<void> {
    const users = TestBed.inject(UserDataService);
    const manager = (await firstValueFrom(users.getById(MANAGER_ID)))!;
    await firstValueFrom(users.save({ ...manager, status: UserStatus.DISABLED }));
  }

  it('previews today with no report before the counter is closed', async () => {
    await signInAs(UserRole.CASHIER);
    const preview = await service().preview();
    expect(preview.date).toBe(TEST_TODAY);
    expect(preview.report).toBeNull();
  });

  it('closes once and says the day is locked the second time', async () => {
    await signInAs(UserRole.CASHIER);
    expect((await service().close(counterCloseInput('0'))).ok).toBeTrue();
    const again = await service().close(counterCloseInput('0'));
    expect(!again.ok && again.message).toBe(DAY_LOCKED_MESSAGE);
  });

  describe('preview', () => {
    it('shows the signed in cashier, the register and the POS sales total', async () => {
      await signInAs(UserRole.CASHIER);
      await prepareDay();
      const preview = await service().preview();
      expect(preview.cashierName).toBe('Ruwani Jayawardena');
      expect(preview.register).toBe(COUNTER_REGISTER_NAME);
      expect(preview.totalSalesCents).toBe(1000);
      expect(preview.expectedCents).toBe(100_000 + 1000);
    });

    it('starts at the first activity of the day and is empty when there is none', async () => {
      await signInAs(UserRole.CASHIER);
      expect((await service().preview()).startTime).toBeNull();
      await TestBed.inject(PosCashService).saveOpening('1000', false);
      const preview = await service().preview();
      expect(preview.startTime?.startsWith(TEST_TODAY)).toBeTrue();
    });

    it('lists only active Admin and Manager users as supervisors, with no other detail', async () => {
      await signInAs(UserRole.CASHIER);
      const preview = await service().preview();
      expect(preview.supervisors.map(item => item.id)).toEqual([ADMIN_ID, MANAGER_ID]);
      for (const supervisor of preview.supervisors) {
        expect(Object.keys(supervisor).sort()).toEqual(['displayName', 'id', 'role']);
      }
    });

    it('leaves out a disabled manager', async () => {
      await signInAs(UserRole.CASHIER);
      await disableManager();
      const preview = await service().preview();
      expect(preview.supervisors.map(item => item.id)).toEqual([ADMIN_ID]);
    });
  });

  describe('close', () => {
    it('records the shift summary, handover, supervisor, balance forward and end time', async () => {
      await signInAs(UserRole.CASHIER);
      await prepareDay();
      const result = await service().close(
        counterCloseInput('1000', {
          handoverText: '400',
          supervisorUserId: MANAGER_ID,
          broughtForwardText: '500',
        })
      );
      expect(result.ok).toBeTrue();
      if (!result.ok) return;
      const report = result.report;
      expect(report.register).toBe(COUNTER_REGISTER_NAME);
      expect(report.totalSalesCents).toBe(1000);
      expect(report.handoverCents).toBe(40_000);
      expect(report.supervisorUserId).toBe(MANAGER_ID);
      expect(report.supervisorName).toBe('Kamal Silva');
      expect(report.broughtForwardCents).toBe(50_000);
      expect(report.unaccountedCents).toBe(10_000);
      expect(report.closedByUserId).toBe(CASHIER_ID);
      expect(report.startTime?.startsWith(TEST_TODAY)).toBeTrue();
      expect(report.endTime).toBe(report.closedAt);
      expect(report.endTime.startsWith(TEST_TODAY)).toBeTrue();
    });

    it('sets the end time from the clock at the moment of closing', async () => {
      await signInAs(UserRole.CASHIER);
      spyOn(TestBed.inject(ClockService), 'now').and.returnValue(`${TEST_TODAY}T21:07:09`);
      const result = await service().close(counterCloseInput('0'));
      expect(result.ok && result.report.endTime).toBe(`${TEST_TODAY}T21:07:09`);
    });

    it('defaults the balance brought forward to the count less the handover', async () => {
      await signInAs(UserRole.CASHIER);
      const result = await service().close(
        counterCloseInput('1000', { handoverText: '250', supervisorUserId: ADMIN_ID })
      );
      expect(result.ok && result.report.broughtForwardCents).toBe(75_000);
      expect(result.ok && result.report.unaccountedCents).toBe(0);
    });

    it('stores no supervisor when there is no handover', async () => {
      await signInAs(UserRole.CASHIER);
      const result = await service().close(
        counterCloseInput('100', { supervisorUserId: MANAGER_ID })
      );
      expect(result.ok && result.report.supervisorUserId).toBeNull();
      expect(result.ok && result.report.supervisorName).toBeNull();
    });

    it('does not let the handover change Expected Cash, the difference or the outcome', async () => {
      await signInAs(UserRole.CASHIER);
      await prepareDay();
      const result = await service().close(
        counterCloseInput('1010', { handoverText: '1010', supervisorUserId: ADMIN_ID })
      );
      expect(result.ok && result.report.expectedCents).toBe(101_000);
      expect(result.ok && result.report.differenceCents).toBe(0);
    });

    it('counts POS sales only in the total and the expected cash', async () => {
      await signInAs(UserRole.CASHIER);
      await prepareDay();
      const result = await service().close(counterCloseInput('1010'));
      expect(result.ok && result.report.totalSalesCents).toBe(1000);
      expect(result.ok && result.report.expectedCents).toBe(101_000);
    });

    it('refuses a handover above zero with no supervisor', async () => {
      await signInAs(UserRole.CASHIER);
      const result = await service().close(counterCloseInput('1000', { handoverText: '1' }));
      expect(result.ok).toBeFalse();
      expect((await service().preview()).report).toBeNull();
    });

    it('refuses a supervisor who is a Cashier or a Pharmacist, or an unknown id', async () => {
      await signInAs(UserRole.CASHIER);
      for (const supervisorUserId of [CASHIER_ID, PHARMACIST_ID, 'usr-999']) {
        const result = await service().close(
          counterCloseInput('1000', { handoverText: '100', supervisorUserId })
        );
        expect(!result.ok && result.message)
          .withContext(supervisorUserId)
          .toBe(SUPERVISOR_INVALID_MESSAGE);
      }
      expect((await service().preview()).report).toBeNull();
    });

    it('refuses a disabled supervisor', async () => {
      await signInAs(UserRole.CASHIER);
      await disableManager();
      const result = await service().close(
        counterCloseInput('1000', { handoverText: '100', supervisorUserId: MANAGER_ID })
      );
      expect(!result.ok && result.message).toBe(SUPERVISOR_INVALID_MESSAGE);
    });

    it('refuses bad amounts without closing', async () => {
      await signInAs(UserRole.CASHIER);
      const withSupervisor = { supervisorUserId: ADMIN_ID };
      const bad = [
        counterCloseInput('-1'),
        counterCloseInput('abc'),
        counterCloseInput('NaN'),
        counterCloseInput('1.234'),
        counterCloseInput('9'.repeat(30)),
        counterCloseInput('100', { ...withSupervisor, handoverText: '-5' }),
        counterCloseInput('100', { ...withSupervisor, handoverText: '100.01' }),
        counterCloseInput('100', { broughtForwardText: '100.01' }),
        counterCloseInput('100', {
          ...withSupervisor,
          handoverText: '50',
          broughtForwardText: '50.01',
        }),
        counterCloseInput('100', { broughtForwardText: '-1' }),
      ];
      for (const input of bad) {
        expect((await service().close(input)).ok)
          .withContext(JSON.stringify(input))
          .toBeFalse();
      }
      expect((await service().preview()).report).toBeNull();
    });

    it('accepts a balance brought forward at the bound', async () => {
      await signInAs(UserRole.CASHIER);
      const result = await service().close(
        counterCloseInput('100', {
          handoverText: '40',
          supervisorUserId: ADMIN_ID,
          broughtForwardText: '60',
        })
      );
      expect(result.ok).toBeTrue();
    });

    it('needs the confirm step', async () => {
      await signInAs(UserRole.CASHIER);
      const result = await service().close(counterCloseInput('0', { confirmed: false }));
      expect(result.ok).toBeFalse();
      expect((await service().preview()).report).toBeNull();
    });

    it('refuses a user who can only view the till', async () => {
      await signInAs(UserRole.CASHIER);
      await setPosLevel(UserRole.CASHIER, PermissionLevel.VIEW);
      const result = await service().close(counterCloseInput('0'));
      expect(!result.ok && result.reason).toBe('denied');
    });

    it('refuses a user with no till access', async () => {
      await signInAs(UserRole.CASHIER);
      await setPosLevel(UserRole.CASHIER, PermissionLevel.NONE);
      const result = await service().close(counterCloseInput('0'));
      expect(!result.ok && result.reason).toBe('denied');
    });

    it('refuses when nobody is signed in', async () => {
      const result = await service().close(counterCloseInput('0'));
      expect(!result.ok && result.reason).toBe('denied');
    });

    it('works from fresh figures, so an old preview cannot be used', async () => {
      await signInAs(UserRole.CASHIER);
      const stale = await service().preview();
      await prepareDay();
      const result = await service().close(counterCloseInput('1010'));
      expect(stale.expectedCents).toBe(0);
      expect(result.ok && result.report.expectedCents).toBe(101_000);
      expect(result.ok && result.report.differenceCents).toBe(0);
    });
  });
});
