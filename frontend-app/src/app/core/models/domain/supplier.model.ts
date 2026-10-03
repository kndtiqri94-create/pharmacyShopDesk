export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  sinceYear: number;
  creditDays: number;
  deliveryDays: string;
  active: boolean;
  outstandingCents: number;
}
