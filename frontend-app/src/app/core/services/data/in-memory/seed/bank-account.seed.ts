import { BankAccount } from '../../../../models/domain/bank-account.model';

export const BANK_ACCOUNT_SEED: readonly BankAccount[] = [
  {
    id: 'bank-001',
    bank: 'Bank of Ceylon',
    branch: 'Colombo Fort',
    holderName: 'ShopDesk Pharmacy',
    accountNo: '0012345678',
    openingBalanceCents: 0,
  },
  {
    id: 'bank-002',
    bank: 'Commercial Bank of Ceylon',
    branch: 'Nugegoda',
    holderName: 'ShopDesk Pharmacy',
    accountNo: '8001234567',
    openingBalanceCents: 0,
  },
  {
    id: 'bank-003',
    bank: 'Sampath Bank',
    branch: 'Maharagama',
    holderName: 'ShopDesk Pharmacy',
    accountNo: '1002345678',
    openingBalanceCents: 0,
  },
];
