import { PaymentEntries } from '../models/domain/payment-entries.model';

export function emptyPaymentEntries(): PaymentEntries {
  return {
    cash: '',
    card: '',
    online: '',
    cardLast4: '',
    onlineNote: '',
    onlineAccountId: null,
    creditSelected: false,
  };
}
