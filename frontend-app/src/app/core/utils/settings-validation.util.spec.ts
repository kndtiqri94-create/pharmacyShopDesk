import { SETTINGS_SEED } from '../services/data/in-memory/seed/settings.seed';
import { toDraft } from './settings-diff.util';
import {
  SETTINGS_FIELD_GROUP,
  SETTINGS_FIELD_ORDER,
  SETTINGS_GROUPS,
  SettingsDraft,
  looksLikeEmail,
  validateSettings,
} from './settings-validation.util';

describe('validateSettings', () => {
  const valid = (): SettingsDraft => toDraft(SETTINGS_SEED);

  it('accepts the sample settings and returns numbers', () => {
    const result = validateSettings(valid());
    expect(result.errors).toEqual({});
    expect(result.firstErrorField).toBeNull();
    expect(result.values?.expiryAlertDays).toBe(60);
    expect(result.values?.defaultReorderLevel).toBe(20);
    expect(result.values?.lowFloatRupees).toBe(10_000);
  });

  it('trims text fields', () => {
    const result = validateSettings({
      ...valid(),
      shopName: '  Corner Pharmacy  ',
      phone: ' 011 ',
    });
    expect(result.values?.shopName).toBe('Corner Pharmacy');
    expect(result.values?.phone).toBe('011');
  });

  it('requires a shop name', () => {
    for (const shopName of ['', '    ']) {
      const result = validateSettings({ ...valid(), shopName });
      expect(result.values).toBeNull();
      expect(result.errors.shopName).toBe('Enter the shop name');
      expect(result.firstErrorField).toBe('shopName');
    }
  });

  it('limits the length of every text field', () => {
    const limits = { shopName: 80, registrationNo: 40, address: 200, phone: 30, email: 120 };
    for (const [key, max] of Object.entries(limits)) {
      const tooLong = validateSettings({ ...valid(), [key]: 'a'.repeat(max + 1) });
      expect(tooLong.errors[key as keyof typeof limits])
        .withContext(key)
        .toContain(`${max} characters`);
    }
    expect(validateSettings({ ...valid(), address: 'a'.repeat(200) }).values).not.toBeNull();
  });

  it('allows an empty email but rejects one that does not look like an email', () => {
    expect(validateSettings({ ...valid(), email: '' }).values).not.toBeNull();
    expect(validateSettings({ ...valid(), email: ' name@example.com ' }).values?.email).toBe(
      'name@example.com'
    );
    for (const email of ['name', 'name@', '@example.com', 'a@b', 'a b@example.com', 'a@@b.com']) {
      expect(validateSettings({ ...valid(), email }).errors.email)
        .withContext(email)
        .toBeDefined();
    }
  });

  it('keeps the expiry window to whole days from 1 to 365', () => {
    for (const value of ['1', '365']) {
      expect(validateSettings({ ...valid(), expiryAlertDays: value }).values).not.toBeNull();
    }
    for (const value of ['', '0', '366', '-1', '30.5', 'abc', '1e2', '  ', '99999999999']) {
      expect(validateSettings({ ...valid(), expiryAlertDays: value }).errors.expiryAlertDays)
        .withContext(value)
        .toBe('Enter a whole number of days from 1 to 365');
    }
  });

  it('keeps the default reorder level to whole units from 1 to 10,000', () => {
    for (const value of ['1', '10000']) {
      expect(validateSettings({ ...valid(), defaultReorderLevel: value }).values).not.toBeNull();
    }
    for (const value of ['', '0', '10001', '-5', '2.5', 'x']) {
      expect(
        validateSettings({ ...valid(), defaultReorderLevel: value }).errors.defaultReorderLevel
      )
        .withContext(value)
        .toBeDefined();
    }
  });

  it('keeps the low-float level to whole rupees from 0 to 1,000,000', () => {
    for (const value of ['0', '1000000']) {
      expect(validateSettings({ ...valid(), lowFloatRupees: value }).values).not.toBeNull();
    }
    for (const value of ['', '-1', '1000001', '10.5', 'abc', '1e6']) {
      expect(validateSettings({ ...valid(), lowFloatRupees: value }).errors.lowFloatRupees)
        .withContext(value)
        .toBeDefined();
    }
  });

  it('points at the first problem in page order and reports every problem', () => {
    const result = validateSettings({
      ...valid(),
      email: 'nope',
      expiryAlertDays: '0',
      lowFloatRupees: '-1',
    });
    expect(result.firstErrorField).toBe('email');
    expect(Object.keys(result.errors).sort()).toEqual([
      'email',
      'expiryAlertDays',
      'lowFloatRupees',
    ]);
    expect(validateSettings({ ...valid(), shopName: '', email: 'nope' }).firstErrorField).toBe(
      'shopName'
    );
  });

  it('keeps the toggles as chosen', () => {
    const result = validateSettings({
      ...valid(),
      sellEarliestExpiringFirst: false,
      blockExpiredSales: false,
      showLowStockCountInSidebar: false,
    });
    expect(result.values?.sellEarliestExpiringFirst).toBeFalse();
    expect(result.values?.blockExpiredSales).toBeFalse();
    expect(result.values?.showLowStockCountInSidebar).toBeFalse();
  });

  it('places every field in a group', () => {
    const groupIds: string[] = SETTINGS_GROUPS.map(group => group.id);
    for (const key of SETTINGS_FIELD_ORDER) expect(groupIds).toContain(SETTINGS_FIELD_GROUP[key]);
    expect(SETTINGS_GROUPS.map(group => group.label)).toEqual([
      'Shop profile',
      'Currency & region',
      'Inventory alerts',
      'Point of sale',
      'Backup & sync',
    ]);
  });

  describe('point of sale settings', () => {
    it('accepts the sample values and returns numbers and switches', () => {
      const result = validateSettings(valid());
      expect(result.values?.posDefaultDiscountPercent).toBe(0);
      expect(result.values?.posMaxDiscountPercent).toBe(20);
      expect(result.values?.posLineDiscountEnabled).toBeTrue();
      expect(result.values?.posBillDiscountEnabled).toBeTrue();
      expect(result.values?.posHideSidebar).toBeTrue();
    });

    it('accepts two decimals and the edges 0 and 100', () => {
      const edges = validateSettings({
        ...valid(),
        posDefaultDiscountPercent: '0',
        posMaxDiscountPercent: '100',
      });
      expect(edges.values?.posMaxDiscountPercent).toBe(100);
      const decimals = validateSettings({
        ...valid(),
        posDefaultDiscountPercent: '2.5',
        posMaxDiscountPercent: '12.25',
      });
      expect(decimals.values?.posMaxDiscountPercent).toBe(12.25);
    });

    it('refuses negative, above 100, not a number and too many decimals', () => {
      for (const bad of ['-1', '100.01', '101', 'abc', '', '  ', '1.234', '1e2']) {
        const result = validateSettings({ ...valid(), posMaxDiscountPercent: bad });
        expect(result.values).withContext(bad).toBeNull();
        expect(result.errors.posMaxDiscountPercent).withContext(bad).toContain('0 to 100');
        const other = validateSettings({ ...valid(), posDefaultDiscountPercent: bad });
        expect(other.errors.posDefaultDiscountPercent).withContext(bad).toContain('0 to 100');
      }
    });

    it('refuses a default above the maximum and names the maximum', () => {
      const result = validateSettings({
        ...valid(),
        posDefaultDiscountPercent: '25',
        posMaxDiscountPercent: '20',
      });
      expect(result.values).toBeNull();
      expect(result.errors.posDefaultDiscountPercent).toContain('maximum (20%)');
      expect(result.firstErrorField).toBe('posDefaultDiscountPercent');
    });

    it('allows a default equal to the maximum', () => {
      const result = validateSettings({
        ...valid(),
        posDefaultDiscountPercent: '20',
        posMaxDiscountPercent: '20',
      });
      expect(result.values).not.toBeNull();
    });
  });
});

describe('looksLikeEmail', () => {
  it('accepts ordinary addresses', () => {
    expect(looksLikeEmail('hello@shopdesk.example')).toBeTrue();
    expect(looksLikeEmail('a.b+c@mail.co.lk')).toBeTrue();
  });

  it('rejects malformed addresses', () => {
    for (const text of ['', 'a', 'a@b', 'a@.com', 'a@b.', 'a@b..c', '@b.com', 'a@b.com@c.com']) {
      expect(looksLikeEmail(text)).withContext(text).toBeFalse();
    }
  });
});
