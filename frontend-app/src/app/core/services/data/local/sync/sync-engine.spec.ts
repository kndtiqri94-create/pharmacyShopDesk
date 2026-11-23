import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  LocalTestEnvironment,
  createLocalTestEnvironment,
} from '../../../../../../testing/local-data-test.util';
import { testSale } from '../../../../../../testing/pos-test.util';
import { Supplier } from '../../../../models/domain/supplier.model';
import { SYNC_INTERVAL_MS } from '../../../api-config';
import { ConnectivityService } from '../../../connectivity.service';
import { ProductDataService } from '../../product-data.service';
import { SalesDataService } from '../../sales-data.service';
import { SupplierDataService } from '../../supplier-data.service';
import { SyncDataService } from '../../sync-data.service';
import { LocalDatabaseProvider } from '../local-database.provider';
import { LocalDbEvents } from '../local-db-events.service';
import { META_KEYS, readMeta } from '../local-meta';
import { OutboxService } from './outbox.service';
import { SyncEngineService } from './sync-engine.service';

const SUPPLIER: Supplier = {
  id: 'sup-1',
  name: 'Alpha',
  contactPerson: 'A',
  phone: '1',
  email: 'a@example.com',
  sinceYear: 2020,
  creditDays: 1,
  deliveryDays: 'Mon',
  active: true,
};

const PAUSE_MS = 10;
const WAIT_ROUNDS = 300;

interface PushBody {
  deviceCode: string;
  changes: { changeId: string; entity: string; id: string; op: string; baseSeq?: number | null }[];
}

describe('sync engine', () => {
  let environment: LocalTestEnvironment;
  let http: HttpTestingController;

  const engine = () => TestBed.inject(SyncEngineService);
  const provider = () => TestBed.inject(LocalDatabaseProvider);
  const outbox = () => TestBed.inject(OutboxService);
  const suppliers = () => TestBed.inject(SupplierDataService);
  const events = () => TestBed.inject(LocalDbEvents).list();
  const pause = (ms = PAUSE_MS) => new Promise(resolve => setTimeout(resolve, ms));

  async function nextRequest(part: string): Promise<TestRequest> {
    for (let round = 0; round < WAIT_ROUNDS; round++) {
      const found = http.match(request => request.url.includes(part));
      if (found.length > 0) return found[0];
      await pause();
    }
    throw new Error(`No request to ${part}`);
  }

  const accept = (request: TestRequest) =>
    request.flush({
      results: (request.request.body as PushBody).changes.map(change => ({
        changeId: change.changeId,
        status: 'accepted',
      })),
    });

  const emptyPull = (request: TestRequest, nextCursor = 0) =>
    request.flush({ changes: [], nextCursor, hasMore: false });

  async function exchange(trigger: 'manual' | 'product-update' = 'manual') {
    const run = engine().runNow(trigger);
    accept(await nextRequest('/sync/push'));
    emptyPull(await nextRequest('/sync/pull'));
    return run;
  }

  async function saveSuppliers(count: number): Promise<void> {
    for (let index = 1; index <= count; index++) {
      await firstValueFrom(
        suppliers().save({ ...SUPPLIER, id: `sup-${index}`, name: `S${index}` })
      );
    }
  }

  function startApp(extra: object[] = []): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [...environment.providers(), ...extra] });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(ConnectivityService);
  }

  beforeEach(async () => {
    environment = createLocalTestEnvironment('shopdesk-engine', { realBrowserStore: true });
    startApp();
    await provider().setDeviceCode('T1');
  });

  afterEach(async () => {
    engine().stop();
    for (const request of http.match(() => true)) {
      request.error(new ProgressEvent('error'), { status: 0 });
    }
    await pause(30);
    TestBed.resetTestingModule();
    await environment.cleanup();
  });

  describe('pushing', () => {
    it('sends waiting changes in the order they were made, then collects server changes (AC-3, D4)', async () => {
      await saveSuppliers(3);
      const queued = await provider().run(db => db.outbox.orderBy('seq').toArray());
      const run = engine().runNow('manual');
      const push = await nextRequest('/sync/push');
      const body = push.request.body as PushBody;
      expect(body.deviceCode).toBe('T1');
      expect(body.changes.map(change => change.id)).toEqual(['sup-1', 'sup-2', 'sup-3']);
      expect(body.changes.map(change => change.changeId)).toEqual(queued.map(row => row.changeId));
      expect(body.changes.every(change => change.baseSeq === null)).toBeTrue();
      accept(push);
      emptyPull(await nextRequest('/sync/pull'), 7);
      expect(await run).toEqual({ outcome: 'completed', pushed: 3, rejected: 0, pulled: 0 });
      expect((await outbox().counts()).pending).toBe(0);
      expect(await provider().run(db => readMeta<number>(db, META_KEYS.pullCursor))).toBe(7);
      expect(await provider().run(db => readMeta<string>(db, META_KEYS.lastSyncAt))).toBeDefined();
    });

    it('sends big queues in batches of at most 100, still in order', async () => {
      const db = await provider().ready();
      await db.outbox.bulkAdd(
        Array.from({ length: 250 }, (_, index) => ({
          changeId: `c-${index}`,
          entity: 'stockMovements',
          id: `m-${index}`,
          op: 'put' as const,
          data: { id: `m-${index}` },
          createdAt: new Date().toISOString(),
          status: 'pending' as const,
          attempts: 0,
        }))
      );
      const run = engine().runNow('manual');
      const sizes: number[] = [];
      for (let batch = 0; batch < 3; batch++) {
        const push = await nextRequest('/sync/push');
        sizes.push((push.request.body as PushBody).changes.length);
        accept(push);
      }
      emptyPull(await nextRequest('/sync/pull'));
      expect((await run).pushed).toBe(250);
      expect(sizes).toEqual([100, 100, 50]);
    });

    it('treats a resent change as done and never applies it twice (AC-8)', async () => {
      await saveSuppliers(2);
      const run = engine().runNow('manual');
      const push = await nextRequest('/sync/push');
      push.flush({
        results: (push.request.body as PushBody).changes.map(change => ({
          changeId: change.changeId,
          status: 'duplicate',
          reason: 'already_processed',
        })),
      });
      emptyPull(await nextRequest('/sync/pull'));
      expect((await run).outcome).toBe('completed');
      expect((await outbox().counts()).pending).toBe(0);
    });

    it('takes a refused change out of the retry cycle and lists it with a plain reason (AC-12)', async () => {
      await saveSuppliers(2);
      const run = engine().runNow('manual');
      const push = await nextRequest('/sync/push');
      const [first, second] = (push.request.body as PushBody).changes;
      push.flush({
        results: [
          {
            changeId: first.changeId,
            status: 'rejected',
            reason: 'duplicate_sku',
            message: 'secret internals',
          },
          { changeId: second.changeId, status: 'accepted' },
        ],
      });
      emptyPull(await nextRequest('/sync/pull'));
      expect(await run).toEqual(jasmine.objectContaining({ pushed: 1, rejected: 1 }));
      expect(await outbox().counts()).toEqual({ pending: 0, rejected: 1 });
      const items = await firstValueFrom(TestBed.inject(SyncDataService).attentionItems$);
      expect(items).toHaveSize(1);
      expect(items[0].what).toBe('Supplier');
      expect(items[0].reason).toBe('Another product already uses this product code.');
      expect(JSON.stringify(items)).not.toContain('secret internals');
      expect(JSON.stringify(events())).not.toContain('secret internals');
      const again = engine().runNow('manual');
      emptyPull(await nextRequest('/sync/pull'));
      expect((await again).pushed).toBe(0);
      http.expectNone(request => request.url.includes('/sync/push'));
    });

    it('shows an unknown refusal code as a generic sentence', async () => {
      await saveSuppliers(1);
      const run = engine().runNow('manual');
      const push = await nextRequest('/sync/push');
      const [only] = (push.request.body as PushBody).changes;
      push.flush({ results: [{ changeId: only.changeId, status: 'rejected', reason: 'xyz' }] });
      emptyPull(await nextRequest('/sync/pull'));
      await run;
      const items = await firstValueFrom(TestBed.inject(SyncDataService).attentionItems$);
      expect(items[0].reason).toBe('The central record could not accept this change.');
    });

    it('keeps every change, in order, after a server error and retries the same ids (AC-4)', async () => {
      await saveSuppliers(2);
      const before = await provider().run(db => db.outbox.orderBy('seq').toArray());
      const failing = engine().runNow('manual');
      (await nextRequest('/sync/push')).flush('boom', { status: 500, statusText: 'Server Error' });
      expect((await failing).outcome).toBe('failed');
      const after = await provider().run(db => db.outbox.orderBy('seq').toArray());
      expect(after.map(row => row.changeId)).toEqual(before.map(row => row.changeId));
      expect(after.every(row => row.status === 'pending' && row.attempts === 1)).toBeTrue();
      const retry = engine().runNow('manual');
      const push = await nextRequest('/sync/push');
      expect((push.request.body as PushBody).changes.map(change => change.changeId)).toEqual(
        before.map(row => row.changeId)
      );
      accept(push);
      emptyPull(await nextRequest('/sync/pull'));
      expect((await retry).outcome).toBe('completed');
    });

    it('waits longer after each repeated failure and resets after a success (AC-4)', async () => {
      await saveSuppliers(1);
      for (let attempt = 1; attempt <= 3; attempt++) {
        const failing = engine().runNow('manual');
        (await nextRequest('/sync/push')).flush('x', { status: 503, statusText: 'Unavailable' });
        await failing;
      }
      const delays = events()
        .filter(event => event.code === 'sync.push.failed')
        .map(event => Number(/nextDelayMs=(\d+)/.exec(String(event.detail))?.[1]));
      expect(delays).toHaveSize(3);
      expect(delays[0]).toBeGreaterThanOrEqual(1000);
      expect(delays[1]).toBeGreaterThanOrEqual(2000);
      expect(delays[2]).toBeGreaterThanOrEqual(4000);
      await exchange();
      await saveSuppliers(1);
      const failingAgain = engine().runNow('manual');
      (await nextRequest('/sync/push')).flush('x', { status: 503, statusText: 'Unavailable' });
      await failingAgain;
      const last = events()
        .filter(event => event.code === 'sync.push.failed')
        .at(-1);
      expect(Number(/nextDelayMs=(\d+)/.exec(String(last?.detail))?.[1])).toBeLessThan(1500);
    });

    it('honours a too-many-requests answer and keeps the queue (429)', async () => {
      await saveSuppliers(1);
      const failing = engine().runNow('manual');
      (await nextRequest('/sync/push')).flush('slow down', {
        status: 429,
        statusText: 'Too Many',
        headers: { 'Retry-After': '30' },
      });
      expect((await failing).outcome).toBe('failed');
      const last = events()
        .filter(event => event.code === 'sync.push.failed')
        .at(-1);
      expect(Number(/nextDelayMs=(\d+)/.exec(String(last?.detail))?.[1])).toBeGreaterThanOrEqual(
        30000
      );
      expect((await outbox().counts()).pending).toBe(1);
    });

    it('keeps the queue and rejects nothing when the device is not authorised (401)', async () => {
      await saveSuppliers(2);
      const failing = engine().runNow('manual');
      (await nextRequest('/sync/push')).flush(
        { error: { code: 'unauthenticated' } },
        {
          status: 401,
          statusText: 'Unauthorized',
        }
      );
      expect((await failing).outcome).toBe('unauthorised');
      expect(await outbox().counts()).toEqual({ pending: 2, rejected: 0 });
      const status = await firstValueFrom(TestBed.inject(SyncDataService).getStatus());
      expect(status.lastError).toBe('unauthorised');
      expect(status.state).toBe('ONLINE');
    });

    it('goes offline on a network failure and returns online on the next success (AC-5)', async () => {
      await saveSuppliers(1);
      const connectivity = TestBed.inject(ConnectivityService);
      const failing = engine().runNow('manual');
      (await nextRequest('/sync/push')).error(new ProgressEvent('error'), { status: 0 });
      await failing;
      expect(connectivity.isOnline()).toBeFalse();
      const status = await firstValueFrom(TestBed.inject(SyncDataService).getStatus());
      expect(status.state).toBe('OFFLINE');
      expect(status.pendingChanges).toBe(1);
      await exchange();
      expect(connectivity.isOnline()).toBeTrue();
    });

    it('resumes after a connection drop in the middle without losing or repeating anything (AC-25)', async () => {
      await saveSuppliers(150);
      const run = engine().runNow('manual');
      const first = await nextRequest('/sync/push');
      accept(first);
      (await nextRequest('/sync/push')).error(new ProgressEvent('error'), { status: 0 });
      expect((await run).outcome).toBe('failed');
      expect((await outbox().counts()).pending).toBe(50);
      const resume = engine().runNow('manual');
      const push = await nextRequest('/sync/push');
      expect((push.request.body as PushBody).changes.map(change => change.id)).toEqual(
        Array.from({ length: 50 }, (_, index) => `sup-${index + 101}`)
      );
      accept(push);
      emptyPull(await nextRequest('/sync/pull'));
      expect((await resume).outcome).toBe('completed');
      expect((await outbox().counts()).pending).toBe(0);
    });

    it('survives the whole batch being resent after a lost reply (AC-8, AC-25)', async () => {
      await saveSuppliers(3);
      const lost = engine().runNow('manual');
      (await nextRequest('/sync/push')).error(new ProgressEvent('error'), { status: 0 });
      await lost;
      const resent = engine().runNow('manual');
      const push = await nextRequest('/sync/push');
      push.flush({
        results: (push.request.body as PushBody).changes.map(change => ({
          changeId: change.changeId,
          status: 'duplicate',
          reason: 'already_processed',
        })),
      });
      emptyPull(await nextRequest('/sync/pull'));
      expect((await resent).outcome).toBe('completed');
      expect((await outbox().counts()).pending).toBe(0);
    });

    it('treats a malformed or mismatched server answer as a failed attempt and keeps the queue', async () => {
      await saveSuppliers(2);
      const failing = engine().runNow('manual');
      (await nextRequest('/sync/push')).flush({
        results: [{ changeId: 'other', status: 'accepted' }],
      });
      expect((await failing).outcome).toBe('failed');
      const odd = engine().runNow('manual');
      (await nextRequest('/sync/push')).flush('<html>oops</html>');
      expect((await odd).outcome).toBe('failed');
      expect((await outbox().counts()).pending).toBe(2);
    });

    it('runs one exchange at a time on this device', async () => {
      await saveSuppliers(1);
      const first = engine().runNow('manual');
      const second = engine().runNow('manual');
      expect(second).toBe(first);
      accept(await nextRequest('/sync/push'));
      emptyPull(await nextRequest('/sync/pull'));
      await first;
      http.expectNone(request => request.url.includes('/sync/push'));
    });

    it('reports the device as offline without calling the server when the browser is offline', async () => {
      await saveSuppliers(1);
      window.dispatchEvent(new Event('offline'));
      const result = await engine().runNow('manual');
      expect(result.outcome).toBe('offline');
      http.expectNone(() => true);
      expect((await outbox().counts()).pending).toBe(1);
      window.dispatchEvent(new Event('online'));
    });

    it('sends the stored base seq with an edit and waits for its own seq before editing it again', async () => {
      const db = await provider().ready();
      await db.syncSeqs.put({ key: 'suppliers:sup-1', seq: 4 });
      await firstValueFrom(suppliers().save(SUPPLIER));
      await firstValueFrom(suppliers().save({ ...SUPPLIER, name: 'Second edit' }));
      const run = engine().runNow('manual');
      const first = await nextRequest('/sync/push');
      const firstBody = first.request.body as PushBody;
      expect(firstBody.changes).toHaveSize(1);
      expect(firstBody.changes[0].baseSeq).toBe(4);
      accept(first);
      const settle = await nextRequest('/sync/pull');
      settle.flush({
        changes: [{ entity: 'suppliers', id: 'sup-1', op: 'put', seq: 9, data: { ...SUPPLIER } }],
        nextCursor: 9,
        hasMore: false,
      });
      const second = await nextRequest('/sync/push');
      expect((second.request.body as PushBody).changes[0].baseSeq).toBe(9);
      accept(second);
      emptyPull(await nextRequest('/sync/pull'), 10);
      expect((await run).pushed).toBe(2);
      expect((await firstValueFrom(suppliers().getById('sup-1')))?.name).toBe('Second edit');
    });

    it('collects everything again after the server says its version won', async () => {
      await saveSuppliers(1);
      const db = await provider().ready();
      await db.meta.put({ key: META_KEYS.pullCursor, value: 40 });
      const run = engine().runNow('manual');
      const push = await nextRequest('/sync/push');
      push.flush({
        results: (push.request.body as PushBody).changes.map(change => ({
          changeId: change.changeId,
          status: 'duplicate',
          reason: 'server_wins',
        })),
      });
      const pull = await nextRequest('/sync/pull');
      expect(pull.request.params.get('cursor')).toBe('0');
      emptyPull(pull, 40);
      await run;
    });
  });

  describe('collecting server changes', () => {
    async function pullWith(changes: object[], nextCursor = 5, hasMore = false) {
      const run = engine().runNow('manual');
      const pull = await nextRequest('/sync/pull');
      pull.flush({ changes, nextCursor, hasMore });
      return run;
    }

    it('adds new central records and replaces differing ones: the server wins (AC-9, AC-26)', async () => {
      await firstValueFrom(suppliers().save(SUPPLIER));
      const db = await provider().ready();
      await db.outbox.clear();
      const result = await pullWith([
        {
          entity: 'suppliers',
          id: 'sup-1',
          op: 'put',
          seq: 3,
          data: { ...SUPPLIER, name: 'Central name' },
        },
        { entity: 'suppliers', id: 'sup-9', op: 'put', seq: 4, data: { ...SUPPLIER, id: 'sup-9' } },
      ]);
      expect(result.pulled).toBe(2);
      expect((await firstValueFrom(suppliers().getById('sup-1')))?.name).toBe('Central name');
      expect(await firstValueFrom(suppliers().getById('sup-9'))).not.toBeNull();
      expect((await db.syncSeqs.get('suppliers:sup-1'))?.seq).toBe(3);
      expect(await db.outbox.count()).toBe(0);
    });

    it('does not overwrite a record that gained a waiting change during the exchange', async () => {
      await saveSuppliers(1);
      const run = engine().runNow('manual');
      accept(await nextRequest('/sync/push'));
      const pull = await nextRequest('/sync/pull');
      await firstValueFrom(suppliers().save({ ...SUPPLIER, name: 'Local edit' }));
      pull.flush({
        changes: [
          {
            entity: 'suppliers',
            id: 'sup-1',
            op: 'put',
            seq: 3,
            data: { ...SUPPLIER, name: 'Central' },
          },
        ],
        nextCursor: 3,
        hasMore: false,
      });
      expect((await run).pulled).toBe(0);
      expect((await firstValueFrom(suppliers().getById('sup-1')))?.name).toBe('Local edit');
      expect((await outbox().counts()).pending).toBe(1);
    });

    it('never removes a completed sale or return, even when the server sends a delete (AC-11)', async () => {
      await firstValueFrom(
        TestBed.inject(SalesDataService).saveSale(testSale({ id: 'sale-keep' }))
      );
      const db = await provider().ready();
      await db.outbox.clear();
      await pullWith([{ entity: 'sales', id: 'sale-keep', op: 'delete', seq: 8, data: null }]);
      expect(await db.sales.get('sale-keep')).toBeDefined();
    });

    it('removes other records the server deleted', async () => {
      await firstValueFrom(suppliers().save(SUPPLIER));
      const db = await provider().ready();
      await db.outbox.clear();
      await pullWith([{ entity: 'suppliers', id: 'sup-1', op: 'delete', seq: 8, data: null }]);
      expect(await db.suppliers.get('sup-1')).toBeUndefined();
    });

    it('combines stock from movements by id and never overwrites a stock total (AC-10, D5)', async () => {
      const products = TestBed.inject(ProductDataService);
      const before = (await firstValueFrom(products.getById('prod-002')))!;
      const movement = {
        id: 'mov-remote',
        seq: 77,
        productId: 'prod-002',
        batchId: '',
        type: 'SALE',
        qtyDelta: -3,
        refId: 'sale-remote',
        userId: null,
        deviceCode: 'ZZ9',
        createdAt: '2026-11-24T08:00:00.000Z',
      };
      const change = {
        entity: 'stockMovements',
        id: 'mov-remote',
        op: 'put',
        seq: 77,
        data: movement,
      };
      await pullWith([change], 77);
      await pullWith([change, change], 77);
      const after = (await firstValueFrom(products.getById('prod-002')))!;
      expect(after.stockOnHand).toBe(before.stockOnHand - 3);
      const stored = await provider().run(db => db.stockMovements.toArray());
      expect(stored.filter(row => row.id === 'mov-remote')).toHaveSize(1);
      expect(stored.find(row => row.id === 'mov-remote')?.seq).toBe(1);
    });

    it('takes central product details but keeps the device stock figures', async () => {
      const products = TestBed.inject(ProductDataService);
      const before = (await firstValueFrom(products.getById('prod-002')))!;
      const db = await provider().ready();
      const base = await db.products.get('prod-002');
      await pullWith([
        {
          entity: 'products',
          id: 'prod-002',
          op: 'put',
          seq: 12,
          data: { ...base, priceCents: 99_900, stockOnHand: 424242 },
        },
      ]);
      const after = (await firstValueFrom(products.getById('prod-002')))!;
      expect(after.priceCents).toBe(99_900);
      expect(after.stockOnHand).toBe(before.stockOnHand);
    });

    it('applies documents and ignores unknown entities and malformed records', async () => {
      const result = await pullWith([
        {
          entity: 'documents',
          id: 'app-settings',
          op: 'put',
          seq: 1,
          data: { shopName: 'Central Shop' },
        },
        { entity: 'somethingNew', id: 'x', op: 'put', seq: 2, data: {} },
        { entity: 'suppliers', id: 'sup-bad', op: 'put', seq: 3, data: { id: 'different' } },
        { entity: 'suppliers', id: 'sup-null', op: 'put', seq: 4, data: null },
      ]);
      expect(result.pulled).toBe(1);
      const db = await provider().ready();
      expect(
        ((await db.documents.get('app-settings'))?.value as { shopName: string }).shopName
      ).toBe('Central Shop');
      expect(await db.suppliers.get('sup-bad')).toBeUndefined();
    });

    it('follows hasMore until the server has nothing more', async () => {
      const run = engine().runNow('manual');
      const first = await nextRequest('/sync/pull');
      expect(first.request.params.get('cursor')).toBe('0');
      first.flush({
        changes: [
          {
            entity: 'suppliers',
            id: 'sup-a',
            op: 'put',
            seq: 1,
            data: { ...SUPPLIER, id: 'sup-a' },
          },
        ],
        nextCursor: 1,
        hasMore: true,
      });
      const second = await nextRequest('/sync/pull');
      expect(second.request.params.get('cursor')).toBe('1');
      second.flush({
        changes: [
          {
            entity: 'suppliers',
            id: 'sup-b',
            op: 'put',
            seq: 2,
            data: { ...SUPPLIER, id: 'sup-b' },
          },
        ],
        nextCursor: 2,
        hasMore: false,
      });
      expect((await run).pulled).toBe(2);
      expect(await provider().run(db => readMeta<number>(db, META_KEYS.pullCursor))).toBe(2);
    });

    it('stops a runaway pull that never advances the cursor and rejects an oversized page', async () => {
      const run = engine().runNow('manual');
      (await nextRequest('/sync/pull')).flush({ changes: [], nextCursor: 0, hasMore: true });
      expect((await run).outcome).toBe('completed');
      const oversized = engine().runNow('manual');
      const many = Array.from({ length: 501 }, (_, index) => ({
        entity: 'suppliers',
        id: `s${index}`,
        op: 'delete',
        seq: index + 1,
        data: null,
      }));
      (await nextRequest('/sync/pull')).flush({ changes: many, nextCursor: 501, hasMore: false });
      expect((await oversized).outcome).toBe('failed');
    });

    it('does not queue anything for data it received', async () => {
      await pullWith([
        { entity: 'suppliers', id: 'sup-r', op: 'put', seq: 1, data: { ...SUPPLIER, id: 'sup-r' } },
      ]);
      expect((await outbox().counts()).pending).toBe(0);
    });
  });

  describe('automatic exchange', () => {
    beforeEach(async () => {
      startApp([{ provide: SYNC_INTERVAL_MS, useValue: 40 }]);
      await provider().ready();
    });

    it('sends on its own on the interval and does so only while automatic sync is on (AC-7, AC-20)', async () => {
      await firstValueFrom(TestBed.inject(SyncDataService).setAutoSync(false));
      await saveSuppliers(1);
      engine().start();
      await pause(200);
      http.expectNone(request => request.url.includes('/sync/'));
      const toggled = firstValueFrom(TestBed.inject(SyncDataService).setAutoSync(true));
      accept(await nextRequest('/sync/push'));
      emptyPull(await nextRequest('/sync/pull'));
      await toggled;
      expect((await outbox().counts()).pending).toBe(0);
    });

    it('starts sending at once when the connection returns (AC-6)', async () => {
      await saveSuppliers(1);
      window.dispatchEvent(new Event('offline'));
      engine().start();
      await pause(120);
      http.expectNone(request => request.url.includes('/sync/'));
      window.dispatchEvent(new Event('online'));
      accept(await nextRequest('/sync/push'));
      emptyPull(await nextRequest('/sync/pull'));
      await pause(50);
      expect((await outbox().counts()).pending).toBe(0);
    });

    it('stops its timer when told to', async () => {
      engine().start();
      engine().stop();
      await pause(150);
      expect(http.match(() => true).length).toBeLessThanOrEqual(1);
    });
  });

  describe('status', () => {
    it('reports Syncing with the count while an exchange runs, then Online (AC-14)', async () => {
      await saveSuppliers(2);
      const states: string[] = [];
      const subscription = TestBed.inject(SyncDataService).status$.subscribe(status =>
        states.push(`${status.state}:${status.pendingChanges}`)
      );
      await pause(60);
      const run = engine().runNow('manual');
      const push = await nextRequest('/sync/push');
      await pause(60);
      accept(push);
      emptyPull(await nextRequest('/sync/pull'));
      await run;
      await pause(60);
      subscription.unsubscribe();
      expect(states[0]).toBe('ONLINE:2');
      expect(states).toContain('SYNCING:2');
      expect(states.at(-1)).toBe('ONLINE:0');
    });

    it('shows Needs attention with the refused count, ahead of waiting changes (AC-15)', async () => {
      await saveSuppliers(2);
      const run = engine().runNow('manual');
      const push = await nextRequest('/sync/push');
      const [first] = (push.request.body as PushBody).changes;
      push.flush({
        results: [
          { changeId: first.changeId, status: 'rejected', reason: 'validation_error' },
          { changeId: (push.request.body as PushBody).changes[1].changeId, status: 'accepted' },
        ],
      });
      emptyPull(await nextRequest('/sync/pull'));
      await run;
      await saveSuppliers(1);
      const status = await firstValueFrom(TestBed.inject(SyncDataService).getStatus());
      expect(status.state).toBe('NEEDS_ATTENTION');
      expect(status.attentionCount).toBe(1);
      expect(status.pendingChanges).toBe(1);
    });

    it('answers Sync now and Back up now with what is left', async () => {
      await saveSuppliers(1);
      const sync = firstValueFrom(TestBed.inject(SyncDataService).syncNow());
      accept(await nextRequest('/sync/push'));
      emptyPull(await nextRequest('/sync/pull'));
      expect(await sync).toEqual({ outcome: 'completed', pendingChanges: 0, attentionCount: 0 });
      const lastSync = await firstValueFrom(TestBed.inject(SyncDataService).getStatus());
      expect(lastSync.lastSyncAt).not.toBeNull();

      await saveSuppliers(1);
      const backUp = firstValueFrom(TestBed.inject(SyncDataService).backUpNow());
      (await nextRequest('/sync/push')).flush('x', { status: 500, statusText: 'err' });
      expect(await backUp).toEqual({ outcome: 'failed', pendingChanges: 1, attentionCount: 0 });
    });

    it('tells the caller it is offline and loses nothing', async () => {
      await saveSuppliers(1);
      window.dispatchEvent(new Event('offline'));
      const result = await firstValueFrom(TestBed.inject(SyncDataService).syncNow());
      expect(result).toEqual({ outcome: 'offline', pendingChanges: 1, attentionCount: 0 });
      window.dispatchEvent(new Event('online'));
    });

    it('records only counts and codes in its events, never record contents', async () => {
      await saveSuppliers(1);
      await exchange();
      const text = JSON.stringify(events());
      expect(text).not.toContain('Alpha');
      expect(text).not.toContain('a@example.com');
      expect(events().map(event => event.code)).toEqual(
        jasmine.arrayContaining(['sync.run.started', 'sync.run.finished', 'sync.pull.applied'])
      );
    });

    it('applies the automatic-sync toggle at once and keeps it across a restart', async () => {
      await firstValueFrom(TestBed.inject(SyncDataService).setAutoSync(false));
      expect(
        (await firstValueFrom(TestBed.inject(SyncDataService).getStatus())).autoSyncEnabled
      ).toBeFalse();
      startApp();
      expect(
        (await firstValueFrom(TestBed.inject(SyncDataService).getStatus())).autoSyncEnabled
      ).toBeFalse();
    });

    it('flushes before an Update Products refresh and says whether it succeeded', async () => {
      await saveSuppliers(1);
      const flush = firstValueFrom(TestBed.inject(SyncDataService).exchangeBeforeProductUpdate());
      accept(await nextRequest('/sync/push'));
      emptyPull(await nextRequest('/sync/pull'));
      expect(await flush).toBeTrue();
      const failed = firstValueFrom(TestBed.inject(SyncDataService).exchangeBeforeProductUpdate());
      (await nextRequest('/sync/pull')).flush('x', { status: 500, statusText: 'err' });
      expect(await failed).toBeFalse();
    });
  });
});
