import { TestBed } from '@angular/core/testing';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { setPosLevel } from '../../../testing/pos-test.util';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { PosRecordsService } from './pos-records.service';

describe('PosRecordsService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  it('loads the opening dues for a role that can view the till', async () => {
    await signInAs(UserRole.CASHIER);
    const records = await TestBed.inject(PosRecordsService).load();
    expect(records.openingDues.length).toBeGreaterThan(0);
  });

  it('returns nothing for a role whose POS access was removed', async () => {
    await signInAs(UserRole.CASHIER);
    await setPosLevel(UserRole.CASHIER, PermissionLevel.NONE);
    const records = await TestBed.inject(PosRecordsService).load();
    expect(records).toEqual({ sales: [], returns: [], duePayments: [], openingDues: [] });
  });
});
