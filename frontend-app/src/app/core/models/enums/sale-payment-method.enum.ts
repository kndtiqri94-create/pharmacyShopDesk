export const SalePaymentMethod = {
  CASH: 'CASH',
  CARD: 'CARD',
  ONLINE: 'ONLINE',
  CREDIT: 'CREDIT',
} as const;

export type SalePaymentMethod = (typeof SalePaymentMethod)[keyof typeof SalePaymentMethod];

export const ALL_SALE_PAYMENT_METHODS: readonly SalePaymentMethod[] = [
  SalePaymentMethod.CASH,
  SalePaymentMethod.CARD,
  SalePaymentMethod.ONLINE,
  SalePaymentMethod.CREDIT,
];
