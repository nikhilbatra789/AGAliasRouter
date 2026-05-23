import { expect, test } from '@playwright/test';

test('protected routes redirect to login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=\/dashboard/);
});

test('routes render after login and required UI edits are present', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('admin@gmail.com').fill('admin@gmail.com');
  await page.getByPlaceholder('Password').fill('123456');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  for (const route of ['/configuration', '/provider-pool', '/model-mapping', '/playground', '/credential-files', '/real-time-logs']) {
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

  await page.goto('/playground');
  await expect(page.getByLabel('Model')).toBeVisible();
  await expect(page.getByLabel('Model')).toHaveValue('');
  await expect(page.getByRole('option', { name: 'Select your model' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();
});
