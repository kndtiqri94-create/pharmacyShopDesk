import { APIRequestContext, expect, test } from '@playwright/test';
import {
  Device,
  TestUser,
  apiClient,
  createServerProduct,
  cutNetwork,
  expectPill,
  newDevice,
  readStorage,
  restoreNetwork,
  sellOne,
  serverMovements,
  serverProduct,
  serverSales,
  serverStock,
  waitForProduct,
  waitForSettled,
} from './helpers';

const START_STOCK = 50;

test.describe('offline sync (S-3.4.5)', () => {
  let api: APIRequestContext;
  const devices: Device[] = [];

  async function addDevice(
    browser: Parameters<typeof newDevice>[0],
    user: TestUser = 'cashier'
  ): Promise<Device> {
    const device = await newDevice(browser, user);
    devices.push(device);
    return device;
  }

  test.beforeAll(async () => {
    api = await apiClient();
  });

  test.afterEach(async () => {
    for (const device of devices.splice(0)) await device.context.close();
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('a sale made offline survives a reload and reaches the central record exactly once (AC-24)', async ({
    browser,
  }) => {
    const product = await createServerProduct(api, START_STOCK);
    const { context, page } = await addDevice(browser);
    await expectPill(page, 'Online');
    await waitForProduct(page, product.id);
    const salesBefore = (await serverSales(api)).length;

    await cutNetwork(context);
    await sellOne(page, product, 2);
    await expect.poll(async () => (await readStorage(page, product.id)).pending).toBeGreaterThan(0);
    await expectPill(page, /Offline - \d+ changes? waiting/);

    await page.reload();
    await expectPill(page, /Offline - \d+ changes? waiting/);
    const afterReload = await readStorage(page, product.id);
    expect(afterReload.sales).toBeGreaterThan(0);
    expect(afterReload.stock).toBe(START_STOCK - 2);
    expect(await serverStock(api, product.id)).toBe(START_STOCK);

    await restoreNetwork(context);
    await expectPill(page, /^\s*Online\s*$/);
    await waitForSettled(page);

    expect(await serverStock(api, product.id)).toBe(START_STOCK - 2);
    expect((await serverSales(api)).length).toBe(salesBefore + 1);
    const saleMovements = (await serverMovements(api, product.id)).filter(
      movement => movement.qtyDelta < 0
    );
    expect(saleMovements).toHaveLength(1);
    expect((await readStorage(page, product.id)).stock).toBe(START_STOCK - 2);
  });

  test('a connection dropped after the server received the batch loses nothing and applies nothing twice (AC-25, AC-8)', async ({
    browser,
  }) => {
    const product = await createServerProduct(api, START_STOCK);
    const { context, page } = await addDevice(browser);
    await waitForProduct(page, product.id);
    const salesBefore = (await serverSales(api)).length;

    await cutNetwork(context);
    await sellOne(page, product, 3);
    await expect.poll(async () => (await readStorage(page, product.id)).pending).toBeGreaterThan(0);
    await restoreNetwork(context);

    let dropped = 0;
    await context.route('**/api/v1/sync/push', async route => {
      if (dropped === 0) {
        dropped += 1;
        await route.fetch();
        await route.abort('connectionreset');
        return;
      }
      await route.continue();
    });

    await expect.poll(() => dropped, { timeout: 30_000 }).toBe(1);
    await expect
      .poll(() => serverStock(api, product.id), { timeout: 30_000 })
      .toBe(START_STOCK - 3);
    await waitForSettled(page);
    await expectPill(page, /^\s*Online\s*$/);

    expect(await serverStock(api, product.id)).toBe(START_STOCK - 3);
    expect((await serverSales(api)).length).toBe(salesBefore + 1);
    expect(
      (await serverMovements(api, product.id)).filter(movement => movement.qtyDelta < 0)
    ).toHaveLength(1);
    expect((await readStorage(page, product.id)).stock).toBe(START_STOCK - 3);
  });

  test('two devices selling the same item both end with the starting stock minus both sales (AC-10)', async ({
    browser,
  }) => {
    const product = await createServerProduct(api, START_STOCK);
    const first = await addDevice(browser);
    const second = await addDevice(browser);
    await waitForProduct(first.page, product.id);
    await waitForProduct(second.page, product.id);

    await cutNetwork(first.context);
    await cutNetwork(second.context);
    await sellOne(first.page, product, 2);
    await sellOne(second.page, product, 5);
    await expect
      .poll(async () => (await readStorage(first.page, product.id)).pending)
      .toBeGreaterThan(0);
    await expect
      .poll(async () => (await readStorage(second.page, product.id)).pending)
      .toBeGreaterThan(0);

    await restoreNetwork(first.context);
    await restoreNetwork(second.context);
    await waitForSettled(first.page);
    await waitForSettled(second.page);

    const expected = START_STOCK - 2 - 5;
    expect(await serverStock(api, product.id)).toBe(expected);
    await expect
      .poll(async () => (await readStorage(first.page, product.id)).stock, { timeout: 45_000 })
      .toBe(expected);
    await expect
      .poll(async () => (await readStorage(second.page, product.id)).stock, { timeout: 45_000 })
      .toBe(expected);
    const sales = await serverSales(api);
    expect(new Set(sales.map(sale => sale.invoiceNo)).size).toBe(sales.length);
  });

  test('the same product price edited on two devices keeps the central value on both (AC-26)', async ({
    browser,
  }) => {
    const product = await createServerProduct(api, START_STOCK, 1000);
    const first = await addDevice(browser, 'owner');
    const second = await addDevice(browser, 'owner');
    await waitForProduct(first.page, product.id);
    await waitForProduct(second.page, product.id);

    await cutNetwork(first.context);
    await cutNetwork(second.context);
    await editPrice(first, product.id, '12.00');
    await editPrice(second, product.id, '15.00');
    await expect
      .poll(async () => (await readStorage(first.page, product.id)).pending)
      .toBeGreaterThan(0);
    await expect
      .poll(async () => (await readStorage(second.page, product.id)).pending)
      .toBeGreaterThan(0);

    await restoreNetwork(first.context);
    await expect
      .poll(async () => (await serverProduct(api, product.id)).priceCents, { timeout: 45_000 })
      .toBe(1200);
    await waitForSettled(first.page);

    await restoreNetwork(second.context);
    await waitForSettled(second.page);

    expect((await serverProduct(api, product.id)).priceCents).toBe(1200);
    await expect
      .poll(async () => (await readStorage(first.page, product.id)).priceCents, { timeout: 45_000 })
      .toBe(1200);
    await expect
      .poll(async () => (await readStorage(second.page, product.id)).priceCents, {
        timeout: 45_000,
      })
      .toBe(1200);
  });

  test('Settings shows the real state and Needs attention never blocks the till (AC-14, AC-17, AC-23)', async ({
    browser,
  }) => {
    const product = await createServerProduct(api, START_STOCK);
    const { context, page } = await addDevice(browser, 'owner');
    await waitForProduct(page, product.id);

    await cutNetwork(context);
    await sellOne(page, product, 1);
    await expect.poll(async () => (await readStorage(page, product.id)).pending).toBeGreaterThan(0);
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Backup & sync' }).click();
    await expect(page.getByText('Changes waiting to send')).toBeVisible();
    await expect(page.getByText('those unsent changes are lost')).toBeVisible();
    await page.getByRole('button', { name: 'Sync now' }).click();
    await expect(page.getByText(/could not be reached|offline/i).first()).toBeVisible();
    expect((await readStorage(page, product.id)).pending).toBeGreaterThan(0);

    await restoreNetwork(context);
    await page.getByRole('button', { name: 'Sync now' }).click();
    await waitForSettled(page);
    await expectPill(page, /^\s*Online\s*$/);
  });
});

async function editPrice(device: Device, productId: string, price: string): Promise<void> {
  await device.page.goto(`/products/${productId}/edit`);
  const field = device.page.locator('#product-sellingPrice');
  await expect(field).toBeVisible();
  await field.fill(price);
  await device.page.locator('form').getByRole('button', { name: 'Save product' }).click();
  await expect(device.page).toHaveURL(/\/products(\?.*)?$/);
}
