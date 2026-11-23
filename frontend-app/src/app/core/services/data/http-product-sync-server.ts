import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import {
  ProductSyncBatchRequest,
  ProductSyncBatchResponse,
} from '../../models/domain/product-sync.model';
import { API_BASE_URL, REQUIRE_HTTPS } from '../api-config';
import { BatchFailedError, ProductSyncServer, ServerUnreachableError } from './product-sync-server';

const HTTP_TOO_MANY = 429;
const HTTP_SERVER_ERROR = 500;

function mapError(error: unknown): Error {
  if (error instanceof HttpErrorResponse) {
    const unreachable =
      error.status === 0 || error.status === HTTP_TOO_MANY || error.status >= HTTP_SERVER_ERROR;
    if (unreachable) return new ServerUnreachableError();
  }
  return new BatchFailedError();
}

@Injectable()
export class HttpProductSyncServer extends ProductSyncServer {
  private readonly httpClient = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly requireHttps = inject(REQUIRE_HTTPS);

  syncBatch(request: ProductSyncBatchRequest): Observable<ProductSyncBatchResponse> {
    if (this.requireHttps && !this.baseUrl.startsWith('https://')) {
      return throwError(() => new BatchFailedError());
    }
    return this.httpClient
      .post<ProductSyncBatchResponse>(`${this.baseUrl}/products/sync-batch`, request)
      .pipe(catchError(error => throwError(() => mapError(error))));
  }
}
