import { expect, test } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test('configuration reveals full API key', async ({ page }) => {
  await login(page);
  await page.goto('/configuration');

  const keyRow = page.locator('code').first();
  await expect(keyRow).toContainText('sk');
  await page.getByRole('button', { name: 'Reveal API key' }).click();
  await expect(keyRow).toContainText('sk-123456');
});

test('provider edit modal preloads api key and base url', async ({ page }) => {
  await login(page);
  await page.goto('/provider-pool');
  await page.getByRole('button', { name: 'Edit' }).nth(1).click();

  const apiKeyInput = page.locator('input[placeholder="sk-..."]').first();
  await expect(apiKeyInput).toHaveValue(/.+/);
  await expect(page.locator('input').filter({ hasText: '' }).nth(2)).toHaveValue(/https?:\/\//);
});

test('realtime logs route loads and global models includes mapping aliases', async ({ page, request }) => {
  await login(page);
  await page.goto('/real-time-logs');
  await expect(page.getByText('Real-time Logs')).toBeVisible();

  const logsResponse = await request.get('/api/admin/logs/today');
  expect(logsResponse.ok()).toBeTruthy();
  const logsJson = await logsResponse.json();
  expect(logsJson.ok).toBeTruthy();
  expect(Array.isArray(logsJson.data)).toBeTruthy();

  const modelsResponse = await request.get('/v1/models', {
    headers: { Authorization: 'Bearer sk-123456' }
  });
  expect(modelsResponse.ok()).toBeTruthy();
  const modelsJson = await modelsResponse.json();
  expect(modelsJson.object).toBe('list');
  expect(Array.isArray(modelsJson.data)).toBeTruthy();
  expect(modelsJson.data.length).toBeGreaterThan(0);
});

