import { test, expect } from '../fixtures/base';
import { uniqueEmail } from '../helpers/test-env';
import {
  signupCustomer,
  signupVerifiedCustomer,
  submitWrongPasswordViaUi,
  loginViaUi,
} from '../helpers/account';

const PASSWORD = 'Customer123!';

test.describe.configure({ mode: 'serial' });

test.describe('Login lockout UI (100)', () => {
  test.setTimeout(120_000);

  test('wrong password, lockout message, logout clears /account', async ({ page, request }) => {
    const email = uniqueEmail('login-lock');
    await signupCustomer(request, { email, password: PASSWORD });

    await submitWrongPasswordViaUi(page, { email });
    await expect(page.getByText(/invalid email or password/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // 5 failures lock the account; the next attempt surfaces RATE_LIMITED in UI.
    for (let i = 0; i < 4; i += 1) {
      await submitWrongPasswordViaUi(page, { email });
    }
    await submitWrongPasswordViaUi(page, { email });

    await expect(
      page.getByText(/too many failed login attempts|try again later/i)
    ).toBeVisible({ timeout: 15_000 });

    // Fresh email for successful login + logout (original may still be locked).
    const okEmail = uniqueEmail('login-ok');
    await signupVerifiedCustomer(request, { email: okEmail, password: PASSWORD });
    await loginViaUi(page, { email: okEmail, password: PASSWORD });
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'Log out' }).click();
    await page.goto('/account');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
