import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ProductSyncBatchRequest } from '../../models/domain/product-sync.model';
import { API_BASE_URL, REQUIRE_HTTPS } from '../api-config';
import { HttpProductSyncServer } from './http-product-sync-server';
import { BatchFailedError, ServerUnreachableError } from './product-sync-server';

const REQUEST: ProductSyncBatchRequest = {
  batchNumber: 1,
  totalBatches: 1,
  records: [],
  appMatchKeys: [],
};

describe('HttpProductSyncServer', () => {
  let controller: HttpTestingController;

  function setup(baseUrl = 'https://api.example.test/api/v1') {
    TestBed.configureTestingModule({
      providers: [
        HttpProductSyncServer,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: baseUrl },
        { provide: REQUIRE_HTTPS, useValue: true },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
    return TestBed.inject(HttpProductSyncServer);
  }

  it('posts one batch to the documented route and returns the answer unchanged', async () => {
    const server = setup();
    const pending = firstValueFrom(server.syncBatch(REQUEST));
    const request = controller.expectOne('https://api.example.test/api/v1/products/sync-batch');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(REQUEST);
    const answer = { batchNumber: 1, records: [], serverOnlyRecords: [] };
    request.flush(answer);
    expect(await pending).toEqual(answer);
  });

  it('maps a lost connection, 429 and 5xx to unreachable', async () => {
    for (const status of [0, 429, 500, 503]) {
      TestBed.resetTestingModule();
      const server = setup();
      const pending = firstValueFrom(server.syncBatch(REQUEST));
      controller
        .expectOne(() => true)
        .error(new ProgressEvent('error'), { status, statusText: 'x' });
      await expectAsync(pending).toBeRejectedWithError(ServerUnreachableError);
    }
  });

  it('maps every other refusal, including 401, 422 and 400, to a failed batch', async () => {
    for (const status of [400, 401, 422]) {
      TestBed.resetTestingModule();
      const server = setup();
      const pending = firstValueFrom(server.syncBatch(REQUEST));
      controller.expectOne(() => true).flush({ error: { code: 'x' } }, { status, statusText: 'x' });
      await expectAsync(pending).toBeRejectedWithError(BatchFailedError);
    }
  });

  it('will not call a plain http address when https is required', async () => {
    const server = setup('http://api.example.test/api/v1');
    await expectAsync(firstValueFrom(server.syncBatch(REQUEST))).toBeRejectedWithError(
      BatchFailedError
    );
    controller.expectNone(() => true);
  });
});
