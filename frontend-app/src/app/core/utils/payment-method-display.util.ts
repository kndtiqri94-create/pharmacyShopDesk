import { PaymentMethod } from '../models/enums/payment-method.enum';

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  CREDIT: 'Credit (pay later)',
  BANK: 'Bank transfer',
};

export const PAYMENT_METHOD_OPTIONS: readonly PaymentMethod[] = [
  PaymentMethod.CREDIT,
  PaymentMethod.CASH,
  PaymentMethod.BANK,
];

export function parsePaymentMethod(value: string): PaymentMethod | null {
  return (PAYMENT_METHOD_OPTIONS as readonly string[]).includes(value)
    ? (value as PaymentMethod)
    : null;
}
