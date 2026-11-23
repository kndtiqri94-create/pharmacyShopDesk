import {
  APIRequestContext,
  Browser,
  BrowserContext,
  Page,
  expect,
  request,
} from '@playwright/test';

export const API_ROOT = 'http://127.0.0.1:3100';
export const API_URL = `${API_ROOT}/api/v1`;
const API_TOKEN = 'e2e-throwaway-token';
const API_PATTERN = `${API_ROOT}/**`;
const APP_ORIGIN = 'http://127.0.0.1:4300';

export interface Device {
  context: BrowserContext;
  page: Page;
}

export interface ServerSale {
  id: string;
  invoiceNo: string;
  totalCents: number;
}

let productCounter = 0;

export function apiClient(): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: `${API_URL}/`,
    extraHTTPHeaders: { Authorization: `Bearer ${API_TOKEN}` },
  });
}

export interface TestProduct {
  id: string;
  sku: string;
  name: string;
}

export async function createServerProduct(
  api: APIRequestContext,
  stock: number,
  priceCents = 1000
): Promise<TestProduct> {
  productCounter += 1;
  const stamp = `${Date.now().toString(36)}${productCounter}`.toUpperCase();
  const product = {
    id: `e2e-${stamp.toLowerCase()}`,
    name: `E2E Item ${stamp}`,
    genericName: 'E2E generic',
    category: 'Test',
    form: 'tablet',
    unit: 'tablet',
    sku: `E2E-${stamp}`,
    barcode: '',
    manufacturer: 'E2E',
    costCents: 500,
    priceCents,
    reorderLevel: 1,
    trackBatches: false,
    stockOnHand: stock,
    prescriptionRequired: false,
    active: true,
    taxRatePercent: 0,
    shelfLocation: '',
    showInPosQuickList: true,
    batches: [],
  };
  const response = await api.post('products', { data: product });
  expect(response.status()).toBe(201);
  return { id: product.id, sku: product.sku, name: product.name };
}

export async function serverStock(api: APIRequestContext, productId: string): Promise<number> {
  const response = await api.get(`stock/products/${productId}`);
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as { stockOnHand: number }).stockOnHand;
}

export async function serverProduct(
  api: APIRequestContext,
  productId: string
): Promise<{ priceCents: number; stockOnHand: number }> {
  const response = await api.get(`products/${productId}`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as { priceCents: number; stockOnHand: number };
}

export async function serverSales(api: APIRequestContext): Promise<ServerSale[]> {
  const response = await api.get('sales?pageSize=500');
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as { items: ServerSale[] }).items;
}

export async function serverMovements(
  api: APIRequestContext,
  productId: string
): Promise<{ id: string; qtyDelta: number }[]> {
  const response = await api.get(`stock-movements?productId=${productId}&limit=500`);
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as { items: { id: string; qtyDelta: number }[] }).items;
}

export type TestUser = 'cashier' | 'owner';

const CREDENTIALS: Record<TestUser, { username: string; password: string }> = {
  cashier: { username: 'ruwani', password: 'Cashier@2026' },
  owner: { username: 'nimal', password: 'Owner@2026' },
};

export async function newDevice(browser: Browser, user: TestUser = 'cashier'): Promise<Device> {
  const context = await browser.newContext({ baseURL: APP_ORIGIN });
  const page = await context.newPage();
  await signIn(page, user);
  return { context, page };
}

export async function signIn(page: Page, user: TestUser = 'cashier'): Promise<void> {
  await page.goto('/sign-in');
  await page.locator('#signin-username').fill(CREDENTIALS[user].username);
  await page.locator('#signin-password').fill(CREDENTIALS[user].password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.locator('app-sync-pill output')).toBeVisible();
}

export function pill(page: Page) {
  return page.locator('app-sync-pill output');
}

export async function expectPill(page: Page, text: string | RegExp): Promise<void> {
  await expect(pill(page)).toContainText(text, { timeout: 30_000 });
}

export async function cutNetwork(context: BrowserContext): Promise<void> {
  await context.route(API_PATTERN, route => route.abort('internetdisconnected'));
}

export async function restoreNetwork(context: BrowserContext): Promise<void> {
  await context.unrouteAll({ behavior: 'ignoreErrors' });
}

export async function openTill(page: Page): Promise<void> {
  await page.goto('/pos');
  await expect(page.getByLabel('Find a product')).toBeEnabled();
}

export async function sellOne(page: Page, product: TestProduct, quantity = 1): Promise<void> {
  await openTill(page);
  const search = page.getByLabel('Find a product');
  for (let count = 0; count < quantity; count++) {
    await search.fill(product.sku);
    await search.press('Enter');
  }
  await page.locator('#pos-pay-cash').fill('100000');
  await page
    .getByRole('button', { name: /^Save\s/ })
    .first()
    .click();
  await expect(page.getByLabel('Find a product')).toHaveValue('');
}

export interface DeviceStorage {
  pending: number;
  stock: number | null;
  priceCents: number | null;
  sales: number;
}

export function readStorage(page: Page, productId: string): Promise<DeviceStorage> {
  return page.evaluate(
    id =>
      new Promise<DeviceStorage>((resolve, reject) => {
        const open = indexedDB.open('shopdesk-local');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(['outbox', 'products', 'stockMovements', 'sales'], 'readonly');
          const read = <T>(store: string, key?: IDBValidKey) =>
            new Promise<T>((done, fail) => {
              const request =
                key === undefined ? tx.objectStore(store).getAll() : tx.objectStore(store).get(key);
              request.onsuccess = () => done(request.result as T);
              request.onerror = () => fail(request.error);
            });
          Promise.all([
            read<{ status: string }[]>('outbox'),
            read<{ stockOnHand: number; priceCents: number } | undefined>('products', id),
            read<{ productId: string; qtyDelta: number }[]>('stockMovements'),
            read<unknown[]>('sales'),
          ])
            .then(([outbox, product, movements, sales]) => {
              db.close();
              const moved = movements
                .filter(movement => movement.productId === id)
                .reduce((sum, movement) => sum + movement.qtyDelta, 0);
              resolve({
                pending: outbox.filter(row => row.status === 'pending').length,
                stock: product ? product.stockOnHand + moved : null,
                priceCents: product ? product.priceCents : null,
                sales: sales.length,
              });
            })
            .catch(reject);
        };
      }),
    productId
  );
}

export async function waitForProduct(page: Page, productId: string): Promise<void> {
  await expect
    .poll(async () => (await readStorage(page, productId)).stock, { timeout: 30_000 })
    .not.toBeNull();
}

export async function waitForSettled(page: Page): Promise<void> {
  await expect
    .poll(async () => (await readStorage(page, 'none')).pending, { timeout: 45_000 })
    .toBe(0);
}
