export interface PaymentEntries {
  cash: string;
  card: string;
  online: string;
  cardLast4: string;
  onlineNote: string;
  onlineAccountId: string | null;
  creditSelected: boolean;
}
