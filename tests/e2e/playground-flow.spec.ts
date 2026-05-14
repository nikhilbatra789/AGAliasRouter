import { expect, test } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByPlaceholder('admin@gmail.com').fill('admin@gmail.com');
  await page.getByPlaceholder('Password').fill('123456');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test('playground route, model selection, chat, error retry flow', async ({ page }) => {
  let chatCalls = 0;

  await page.route('**/v1/models', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        object: 'list',
        data: [{ id: 'gpt-4o-mini' }, { id: 'claude-3-5-sonnet' }]
      })
    });
  });

  await page.route('**/v1/chat/completions', async (route) => {
    chatCalls += 1;
    if (chatCalls === 1) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Upstream error for retry check' } })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{ message: { content: 'Assistant response after retry' } }]
      })
    });
  });

  await login(page);

  await expect(page.getByRole('link', { name: /Playground/ })).toBeVisible();
  await page.goto('/playground');

  const modelSelect = page.locator('#playground-model');
  await expect(modelSelect).toBeVisible();
  await expect(modelSelect).toHaveValue('');
  await expect(modelSelect).toContainText('Select your model');
  await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();

  await modelSelect.selectOption('gpt-4o-mini');
  await page.getByPlaceholder('Type a prompt...').fill('hello model');
  await page.getByRole('button', { name: 'Send' }).click();

  const userBubble = page.locator('div').filter({ hasText: /^hello model$/ }).first();
  await expect(userBubble).toBeVisible();

  await expect(page.getByText('Upstream error for retry check')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();

  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText('Assistant response after retry')).toBeVisible();
  expect(chatCalls).toBe(2);
});
