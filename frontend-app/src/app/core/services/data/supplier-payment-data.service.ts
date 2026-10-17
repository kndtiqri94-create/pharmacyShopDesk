import { Observable } from 'rxjs';
import { SupplierPayment } from '../../models/domain/supplier-payment.model';

export abstract class SupplierPaymentDataService {
  abstract getAll(): Observable<readonly SupplierPayment[]>;
  abstract save(payment: SupplierPayment): Observable<SupplierPayment>;
}
