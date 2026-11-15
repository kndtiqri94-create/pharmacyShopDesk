import { Observable } from 'rxjs';
import {
  ProductSyncBatchRequest,
  ProductSyncBatchResponse,
} from '../../models/domain/product-sync.model';

export class ServerUnreachableError extends Error {
  constructor() {
    super('The product server could not be reached.');
    this.name = 'ServerUnreachableError';
  }
}

export class BatchFailedError extends Error {
  constructor() {
    super('The product server could not process the batch.');
    this.name = 'BatchFailedError';
  }
}

export abstract class ProductSyncServer {
  abstract syncBatch(request: ProductSyncBatchRequest): Observable<ProductSyncBatchResponse>;
}
