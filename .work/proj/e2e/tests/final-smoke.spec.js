import { test, expect } from '@playwright/test';

test('public landing and admin open', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('#root')).toBeVisible();
  await expect(page.locator('body')).toContainText(/MED|School|شروع|پزشک/i, { timeout: 15000 });
  const res = await request.post('/api/auth/login', { data: { username: 'admin', password: 'demo' } });
  expect(res.ok()).toBeTruthy();
  const { token } = await res.json();
  await page.addInitScript((tk) => localStorage.setItem('medlab_token', tk), token);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /پنل مدیریت|Admin/i })).toBeVisible({ timeout: 20000 });
});
