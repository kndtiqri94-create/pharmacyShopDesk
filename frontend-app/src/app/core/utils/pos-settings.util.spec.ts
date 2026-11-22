import { SETTINGS_SEED } from '../services/data/in-memory/seed/settings.seed';
import { POS_SETTINGS_DEFAULTS, toPosSettings } from './pos-settings.util';

describe('toPosSettings', () => {
  it('reads the five point of sale settings from the saved settings', () => {
    expect(toPosSettings(SETTINGS_SEED)).toEqual({
      lineDiscountEnabled: true,
      billDiscountEnabled: true,
      defaultDiscountPercent: 0,
      maxDiscountPercent: 20,
      hideSidebarOnOpen: true,
    });
  });

  it('falls back to the sample defaults for an older settings object', () => {
    expect(toPosSettings({ shopName: 'Old' })).toEqual(POS_SETTINGS_DEFAULTS);
    expect(toPosSettings(null)).toEqual(POS_SETTINGS_DEFAULTS);
  });

  it('ignores values that are not a percentage from 0 to 100', () => {
    const result = toPosSettings({
      posMaxDiscountPercent: Number.NaN,
      posDefaultDiscountPercent: -5,
    });
    expect(result.maxDiscountPercent).toBe(20);
    expect(result.defaultDiscountPercent).toBe(0);
    expect(toPosSettings({ posMaxDiscountPercent: 150 }).maxDiscountPercent).toBe(20);
  });

  it('never lets the default sit above the maximum', () => {
    const result = toPosSettings({ posMaxDiscountPercent: 10, posDefaultDiscountPercent: 15 });
    expect(result.defaultDiscountPercent).toBe(10);
  });

  it('keeps explicit off switches', () => {
    const result = toPosSettings({
      posLineDiscountEnabled: false,
      posBillDiscountEnabled: false,
      posHideSidebar: false,
    });
    expect(result.lineDiscountEnabled).toBeFalse();
    expect(result.billDiscountEnabled).toBeFalse();
    expect(result.hideSidebarOnOpen).toBeFalse();
  });
});
