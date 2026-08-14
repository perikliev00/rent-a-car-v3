import { test, expect } from '../fixtures/base';

test('adminPage fixture lands on admin dashboard', async ({ adminPage }) => {
  await expect(adminPage).toHaveURL(/\/admin/);
  await expect(adminPage.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(adminPage.getByRole('button', { name: 'Log out' })).toBeVisible();
});
