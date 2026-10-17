import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { UserRole } from '../models/enums/user-role.enum';
import { toDraft } from '../utils/settings-diff.util';
import { SettingsDataService } from './data/settings-data.service';
import { SyncDataService } from './data/sync-data.service';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const service = () => TestBed.inject(SettingsService);
  const saved = () => firstValueFrom(TestBed.inject(SettingsDataService).get());
  const syncStatus = () => firstValueFrom(TestBed.inject(SyncDataService).getStatus());

  it('saves a valid draft as a whole, keeps the branch label and announces the change', async () => {
    await signInAs(UserRole.ADMIN);
    const draft = {
      ...toDraft(await saved()),
      shopName: 'Corner Pharmacy',
      expiryAlertDays: '30',
      defaultReorderLevel: '15',
      lowFloatRupees: '12500',
      showLowStockCountInSidebar: false,
    };
    expect(service().changed()).toBe(0);
    const result = await service().save(draft);
    expect(result.ok).toBeTrue();
    const after = await saved();
    expect(after.shopName).toBe('Corner Pharmacy');
    expect(after.expiryAlertDays).toBe(30);
    expect(after.defaultReorderLevel).toBe(15);
    expect(after.lowFloatCents).toBe(1_250_000);
    expect(after.showLowStockCountInSidebar).toBeFalse();
    expect(after.branchLabel).toBe('Main Shop');
    expect(service().changed()).toBe(1);
  });

  it('saves nothing at all when any field is invalid, and does not announce a change', async () => {
    await signInAs(UserRole.ADMIN);
    const before = await saved();
    const draft = { ...toDraft(before), shopName: 'New name', expiryAlertDays: '400' };
    const result = await service().save(draft);
    expect(result).toEqual(
      jasmine.objectContaining({ ok: false, reason: 'invalid', firstErrorField: 'expiryAlertDays' })
    );
    expect(await saved()).toEqual(before);
    expect(service().changed()).toBe(0);
  });

  it('refuses Manager, Pharmacist and Cashier without changing anything', async () => {
    for (const role of [UserRole.MANAGER, UserRole.PHARMACIST, UserRole.CASHIER]) {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
      clearBrowserStorage();
      await signInAs(role);
      const before = await saved();
      const result = await service().save({ ...toDraft(before), shopName: 'Changed' });
      expect(result).toEqual(jasmine.objectContaining({ ok: false, reason: 'denied' }));
      expect(await service().setAutoSync(false)).toEqual({ ok: false, reason: 'denied' });
      expect(await saved()).toEqual(before);
      expect((await syncStatus()).autoSyncEnabled).toBeTrue();
      expect(service().changed()).toBe(0);
    }
  });

  it('refuses everything when nobody is signed in', async () => {
    const before = await saved();
    const result = await service().save({ ...toDraft(before), shopName: 'Changed' });
    expect(result).toEqual(jasmine.objectContaining({ ok: false, reason: 'denied' }));
  });

  it('rejects the second of two quick saves', async () => {
    await signInAs(UserRole.ADMIN);
    const draft = toDraft(await saved());
    const [first, second] = await Promise.all([service().save(draft), service().save(draft)]);
    expect(first.ok).toBeTrue();
    expect(second).toEqual(jasmine.objectContaining({ ok: false, reason: 'busy' }));
  });

  it('turns automatic sync off and on without touching the saved settings or announcing a change', async () => {
    await signInAs(UserRole.ADMIN);
    const before = await saved();
    expect(await service().setAutoSync(false)).toEqual({ ok: true, enabled: false });
    expect((await syncStatus()).autoSyncEnabled).toBeFalse();
    expect(await service().setAutoSync(true)).toEqual({ ok: true, enabled: true });
    expect((await syncStatus()).autoSyncEnabled).toBeTrue();
    expect(await saved()).toEqual(before);
    expect(service().changed()).toBe(0);
  });
});
