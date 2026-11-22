export interface SupplierPaymentAllocation {
  grnId: string;
  amountCents: number;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  paidDate: string;
  amountCents: number;
  allocations: SupplierPaymentAllocation[];
  recordedBy: string;
}
