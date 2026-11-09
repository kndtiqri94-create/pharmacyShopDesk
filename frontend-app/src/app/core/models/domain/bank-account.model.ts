export interface BankAccount {
  id: string;
  bank: string;
  branch: string;
  holderName: string;
  accountNo: string;
  openingBalanceCents: number;
}

export interface BankAccountSnapshot {
  bank: string;
  accountNo: string;
  holderName: string;
}
