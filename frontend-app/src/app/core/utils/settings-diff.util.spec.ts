import { SETTINGS_SEED } from '../services/data/in-memory/seed/settings.seed';
import { fromDraft, isSettingsDirty, toDraft } from './settings-diff.util';
import { validateSettings } from './settings-validation.util';

describe('settings diff', () => {
  it('turns cents into rupees for the draft', () => {
    const draft = toDraft(SETTINGS_SEED);
    expect(draft.lowFloatRupees).toBe('10000');
    expect(draft.expiryAlertDays).toBe('60');
    expect(draft.defaultReorderLevel).toBe('20');
    expect(draft.shopName).toBe('ShopDesk');
  });

  it('is not dirty until something changes, and clean again when changed back', () => {
    const draft = toDraft(SETTINGS_SEED);
    expect(isSettingsDirty(draft, SETTINGS_SEED)).toBeFalse();
    expect(isSettingsDirty({ ...draft, expiryAlertDays: '30' }, SETTINGS_SEED)).toBeTrue();
    expect(isSettingsDirty({ ...draft, blockExpiredSales: false }, SETTINGS_SEED)).toBeTrue();
    expect(isSettingsDirty({ ...draft, address: `${draft.address} ` }, SETTINGS_SEED)).toBeTrue();
    expect(
      isSettingsDirty(
        { ...draft, expiryAlertDays: '30' },
        { ...SETTINGS_SEED, expiryAlertDays: 30 }
      )
    ).toBeFalse();
  });

  it('round trips rupees and cents and keeps the branch label', () => {
    const draft = { ...toDraft(SETTINGS_SEED), lowFloatRupees: '12500', expiryAlertDays: '30' };
    const values = validateSettings(draft).values!;
    const saved = fromDraft(values, SETTINGS_SEED);
    expect(saved.lowFloatCents).toBe(1_250_000);
    expect(saved.expiryAlertDays).toBe(30);
    expect(saved.branchLabel).toBe('Main Shop');
    expect(toDraft(saved)).toEqual(draft);
  });

  it('carries the point of sale settings through the draft and back', () => {
    const draft = {
      ...toDraft(SETTINGS_SEED),
      posDefaultDiscountPercent: '5',
      posMaxDiscountPercent: '15.5',
      posLineDiscountEnabled: false,
      posHideSidebar: false,
    };
    const saved = fromDraft(validateSettings(draft).values!, SETTINGS_SEED);
    expect(saved.posDefaultDiscountPercent).toBe(5);
    expect(saved.posMaxDiscountPercent).toBe(15.5);
    expect(saved.posLineDiscountEnabled).toBeFalse();
    expect(saved.posBillDiscountEnabled).toBeTrue();
    expect(saved.posHideSidebar).toBeFalse();
    expect(toDraft(saved)).toEqual(draft);
    expect(isSettingsDirty(draft, SETTINGS_SEED)).toBeTrue();
  });

  it('falls back to the POS sample values for settings saved before POS existed', () => {
    const older: Partial<typeof SETTINGS_SEED> = { ...SETTINGS_SEED };
    delete older.posMaxDiscountPercent;
    delete older.posDefaultDiscountPercent;
    delete older.posHideSidebar;
    const draft = toDraft(older as typeof SETTINGS_SEED);
    expect(draft.posMaxDiscountPercent).toBe('20');
    expect(draft.posDefaultDiscountPercent).toBe('0');
    expect(draft.posHideSidebar).toBeTrue();
  });

  it('does not change the settings it is given', () => {
    const before = structuredClone(SETTINGS_SEED);
    fromDraft(validateSettings(toDraft(SETTINGS_SEED)).values!, SETTINGS_SEED);
    expect(SETTINGS_SEED).toEqual(before);
  });
});
