// Import named exports from '../fixtures/base'.
import { test, expect } from '../fixtures/base';
// Import named exports from '../helpers/test-env'.
import { uniqueEmail } from '../helpers/test-env';
// Import named exports from '../helpers/account'.
import { signupCustomer, submitWrongPasswordViaUi, loginViaUi } from '../helpers/account';

// Create the password constant.
const PASSWORD = 'Customer123!';

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe('Login lockout UI (100)', () => {
  // Call test.setTimeout to perform this step.
  test.setTimeout(120_000);

  // Define a single test case and its expectations.
  test('wrong password, lockout message, logout clears /account', async ({ page, request }) => {
    // Create the email constant.
    const email = uniqueEmail('login-lock');
    // Wait until the asynchronous operation resolves.
    await signupCustomer(request, { email, password: PASSWORD });

    // Wait until the asynchronous operation resolves.
    await submitWrongPasswordViaUi(page, { email });
    // Wait until the asynchronous operation resolves.
    await expect(page.getByText(/invalid email or password/i).first()).toBeVisible({
      // Provide the timeout field value.
      timeout: 10_000,
    });

    // 5 failures lock the account; the next attempt surfaces RATE_LIMITED in UI.
    for (let i = 0; i < 4; i += 1) {
      // Wait until the asynchronous operation resolves.
      await submitWrongPasswordViaUi(page, { email });
    }
    // Wait until the asynchronous operation resolves.
    await submitWrongPasswordViaUi(page, { email });

    // Wait until the asynchronous operation resolves.
    await expect(
      // Call page.getByText to perform this step.
      page.getByText(/too many failed login attempts|try again later/i)
    // Continue the surrounding logic with this statement.
    ).toBeVisible({ timeout: 15_000 });

    // Fresh email for successful login + logout (original may still be locked).
    const okEmail = uniqueEmail('login-ok');
    // Wait until the asynchronous operation resolves.
    await signupCustomer(request, { email: okEmail, password: PASSWORD });
    // Wait until the asynchronous operation resolves.
    await loginViaUi(page, { email: okEmail, password: PASSWORD });
    // Wait until the asynchronous operation resolves.
    await page.goto('/account');
    // Wait until the asynchronous operation resolves.
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({
      // Provide the timeout field value.
      timeout: 15_000,
    });

    // Wait until the asynchronous operation resolves.
    await page.getByRole('button', { name: 'Log out' }).click();
    // Wait until the asynchronous operation resolves.
    await page.goto('/account');
    // Wait until the asynchronous operation resolves.
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
