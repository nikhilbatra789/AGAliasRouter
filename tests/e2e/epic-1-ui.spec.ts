import { expect, test } from '@playwright/test';

test('protected routes redirect to login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
});

test('routes render after login and required UI edits are present', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  for (const route of ['/configuration', '/provider-pool', '/model-mapping', '/credential-files', '/real-time-logs']) {
    await page.goto(route);
    await expect(page.locator('[data-screen-label="Control Plane"]')).toBeVisible();
  }

  await page.goto('/provider-pool');
  await page.getByRole('button', { name: /Add Provider/ }).first().click();
  await expect(page.getByText('Custom Name').first()).toBeVisible();
  await expect(page.getByText('Manual Provider Models')).toBeVisible();
  await expect(page.getByText('Custom Name Optional')).toHaveCount(0);

  await page.goto('/model-mapping');
  await expect(page.getByText('Round Robin')).toBeVisible();
  await expect(page.getByText('Priority')).toHaveCount(0);
  await expect(page.getByText('Weighted')).toHaveCount(0);
  await expect(page.getByText('Least Latency')).toHaveCount(0);

  await page.goto('/real-time-logs');
  await expect(page.getByLabel('Request bodies')).not.toBeChecked();
  await expect(page.getByText('Route Inspector')).toHaveCount(0);
});
