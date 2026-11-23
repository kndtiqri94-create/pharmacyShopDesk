/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { AppConfig } from '../src/config.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { createPrismaClient } from '../src/store/client.js';
import { MemoryStore } from '../src/store/memory-store.js';
import { PrismaStore } from '../src/store/prisma-store.js';
import { Store } from '../src/store/types.js';

export const TOKEN = 'test-token-0123456789-test-token-0123456789';

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: 'test',
    host: '127.0.0.1',
    port: 0,
    logLevel: 'silent',
    databaseUrl: null,
    authToken: TOKEN,
    allowInsecureDev: false,
    corsOrigins: [],
    requireHttps: false,
    store: 'memory',
    ...overrides,
  };
}

export interface TestApi {
  app: FastifyInstance;
  store: Store;
  get: (url: string) => Promise<{ status: number; body: any }>;
  post: (url: string, body?: unknown) => Promise<{ status: number; body: any; headers: any }>;
  put: (url: string, body?: unknown) => Promise<{ status: number; body: any; headers: any }>;
  del: (url: string) => Promise<{ status: number; body: any }>;
}

let prisma: PrismaClient | undefined;

/** MemoryStore by default; the real PostgreSQL store (via Prisma) when run with npm run test:pg. */
async function createStore(): Promise<Store> {
  const url = process.env['PG_DATABASE_URL'];
  if (process.env['PG_TESTS'] !== '1' || !url) return new MemoryStore();
  prisma ??= createPrismaClient(url);
  await prisma.$executeRawUnsafe('TRUNCATE entities, stock_movements, processed_changes');
  await prisma.$executeRawUnsafe('ALTER SEQUENCE change_seq RESTART WITH 1');
  return new PrismaStore(prisma);
}

export async function createApi(overrides: Partial<AppConfig> = {}): Promise<TestApi> {
  const store = await createStore();
  const app = await buildApp({
    config: testConfig(overrides),
    store,
    now: () => '2026-11-23T10:00:00.000Z',
  });
  const headers = { authorization: `Bearer ${TOKEN}` };
  const call = async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown) => {
    const response = await app.inject({
      method,
      url: `/api/v1${url}`,
      headers,
      ...(body === undefined ? {} : { payload: body as object }),
    });
    const text = response.body;
    return {
      status: response.statusCode,
      body: text ? JSON.parse(text) : null,
      headers: response.headers,
    };
  };
  return {
    app,
    store,
    get: url => call('GET', url),
    post: (url, body) => call('POST', url, body),
    put: (url, body) => call('PUT', url, body),
    del: url => call('DELETE', url),
  };
}

export const product = (overrides: Record<string, unknown> = {}) => ({
  id: 'prod-1',
  name: 'Paracetamol 500mg',
  genericName: 'Paracetamol',
  category: 'Analgesic',
  form: 'Tablet',
  unit: 'tablet',
  sku: 'PAR-500',
  barcode: '4791000000011',
  manufacturer: 'Acme',
  costCents: 180,
  priceCents: 250,
  reorderLevel: 20,
  trackBatches: false,
  stockOnHand: 100,
  prescriptionRequired: false,
  active: true,
  taxRatePercent: 0,
  shelfLocation: 'A1',
  showInPosQuickList: true,
  batches: [],
  ...overrides,
});

export const movement = (overrides: Record<string, unknown> = {}) => ({
  id: 'mov-1',
  productId: 'prod-1',
  batchId: '',
  type: 'SALE',
  qtyDelta: -2,
  refId: 'sale-1',
  userId: 'usr-1',
  deviceCode: 'AB1',
  createdAt: '2026-11-23T09:00:00.000Z',
  ...overrides,
});

export const sale = (overrides: Record<string, unknown> = {}) => ({
  id: 'sale-1',
  invoiceNo: 'AB1-0001',
  date: '2026-11-23',
  createdAt: '2026-11-23T09:00:00.000Z',
  cashierUserId: 'usr-1',
  cashierName: 'Cashier',
  customerId: 'cus-1',
  customerName: 'Walk-in',
  repId: null,
  repName: null,
  lines: [
    {
      productId: 'prod-1',
      sku: 'PAR-500',
      name: 'Paracetamol 500mg',
      barcode: '4791000000011',
      unitPriceCents: 250,
      discountPercent: 0,
      quantity: 2,
      totalCents: 500,
      batchAllocations: [],
    },
  ],
  payments: [{ method: 'CASH', amountCents: 1000, reference: '' }],
  subTotalCents: 500,
  discountCents: 0,
  totalCents: 500,
  paidCents: 500,
  creditCents: 0,
  changeCents: 500,
  profitCents: 140,
  discountApprovals: [],
  ...overrides,
});
