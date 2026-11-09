import { TestBed } from '@angular/core/testing';
import { TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { BankAccountService } from './bank-account.service';

const NEW_ACCOUNT = {
  bank: 'HSBC',
  branch: 'Kandy',
  holderName: 'ShopDesk Pharmacy',
  accountNo: '555666777',
  openingBalance: '100',
};

describe('BankAccountService', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: TEST_PROVIDERS }));

  const service = () => TestBed.inject(BankAccountService);

  it('starts with the three sample accounts, labelled and sorted by bank', async () => {
    await service().load();
    expect(
      service()
        .options()
        .map(option => option.label)
    ).toEqual([
      'Bank of Ceylon - 0012345678 (ShopDesk Pharmacy)',
      'Commercial Bank of Ceylon - 8001234567 (ShopDesk Pharmacy)',
      'Sampath Bank - 1002345678 (ShopDesk Pharmacy)',
    ]);
    expect(
      service()
        .accounts()
        .every(account => account.openingBalanceCents === 0)
    ).toBeTrue();
  });

  it('adds a valid account with the next id and lists it', async () => {
    await service().load();
    const result = await service().create(NEW_ACCOUNT);
    expect(result.ok && result.account.id).toBe('bank-004');
    expect(result.ok && result.account.openingBalanceCents).toBe(10_000);
    expect(service().accounts()).toHaveSize(4);
    expect(service().findById('bank-004')?.bank).toBe('HSBC');
  });

  it('rejects an invalid account without adding it', async () => {
    await service().load();
    const result = await service().create({ ...NEW_ACCOUNT, accountNo: '12' });
    expect(!result.ok && result.errors.accountNo).toBeDefined();
    expect(service().accounts()).toHaveSize(3);
  });

  it('rejects a duplicate bank and account number even when the screen is bypassed', async () => {
    await service().load();
    const result = await service().create({
      ...NEW_ACCOUNT,
      bank: 'Sampath Bank',
      accountNo: '1002345678',
    });
    expect(!result.ok && result.errors.accountNo).toContain('already exists');
    expect(service().accounts()).toHaveSize(3);
  });

  it('allows the same account number at a different bank', async () => {
    await service().load();
    expect((await service().create({ ...NEW_ACCOUNT, accountNo: '1002345678' })).ok).toBeTrue();
  });

  it('finds nothing for an unknown or empty id', async () => {
    await service().load();
    expect(service().findById(null)).toBeNull();
    expect(service().findById('bank-999')).toBeNull();
  });
});
