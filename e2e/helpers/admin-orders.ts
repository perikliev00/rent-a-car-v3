// Import named exports from '@playwright/test'.
import { expect, type Page } from '@playwright/test';
// Import named exports from './test-env'.
import { E2E_GUEST } from './test-env';

// Export the admin order form values type.
export type AdminOrderFormValues = {
  // Provide the car name field value.
  carName: string;
  // Provide the pickup date field value.
  pickupDate: string;
  // Provide the return date field value.
  returnDate: string;
  // Contribute this line to the enclosing declaration or statement.
  pickupTime?: string;
  // Contribute this line to the enclosing declaration or statement.
  returnTime?: string;
  // Contribute this line to the enclosing declaration or statement.
  pickupLocationLabel?: string;
  // Contribute this line to the enclosing declaration or statement.
  returnLocationLabel?: string;
  // Contribute this line to the enclosing declaration or statement.
  fullName?: string;
  // Provide the email field value.
  email: string;
  // Contribute this line to the enclosing declaration or statement.
  phoneNumber?: string;
  // Contribute this line to the enclosing declaration or statement.
  address?: string;
  // Contribute this line to the enclosing declaration or statement.
  hotelName?: string;
};

// Export the async fillCreateOrderForm function.
export async function fillCreateOrderForm(page: Page, values: AdminOrderFormValues): Promise<void> {
  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Car', { exact: true }).selectOption({ label: values.carName });
  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Full name').fill(values.fullName ?? E2E_GUEST.fullName);
  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Email').fill(values.email);
  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Phone').fill(values.phoneNumber ?? E2E_GUEST.phoneNumber);
  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Pickup date').fill(values.pickupDate);
  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Return date').fill(values.returnDate);
  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Pickup time').fill(values.pickupTime ?? '10:00');
  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Return time').fill(values.returnTime ?? '10:00');
  // Wait until the asynchronous operation resolves.
  await page
    // Call .getByLabel to perform this step.
    .getByLabel('Pickup location')
    // Call .selectOption to perform this step.
    .selectOption({ label: values.pickupLocationLabel ?? 'Office' });
  // Wait until the asynchronous operation resolves.
  await page
    // Call .getByLabel to perform this step.
    .getByLabel('Return location')
    // Call .selectOption to perform this step.
    .selectOption({ label: values.returnLocationLabel ?? 'Office' });
  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Address').fill(values.address ?? E2E_GUEST.address);
  // Evaluate the condition and enter the branch when it is true.
  if (values.hotelName !== undefined || E2E_GUEST.hotelName) {
    // Wait until the asynchronous operation resolves.
    await page.getByLabel('Hotel').fill(values.hotelName ?? E2E_GUEST.hotelName);
  }
}

// Export the async fillEditOrderDates function.
export async function fillEditOrderDates(
  // Provide the page field value.
  page: Page,
  // Provide the values field value.
  values: { returnDate?: string; pickupDate?: string; pickupLocationLabel?: string }
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Evaluate the condition and enter the branch when it is true.
  if (values.pickupDate) {
    // Wait until the asynchronous operation resolves.
    await page.getByLabel('Pickup date').fill(values.pickupDate);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (values.returnDate) {
    // Wait until the asynchronous operation resolves.
    await page.getByLabel('Return date').fill(values.returnDate);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (values.pickupLocationLabel) {
    // Wait until the asynchronous operation resolves.
    await page.getByLabel('Pickup location').selectOption({ label: values.pickupLocationLabel });
  }
}

// Export the confirmDeleteDialog function.
export function confirmDeleteDialog(page: Page): void {
  // Call page.once to perform this step.
  page.once('dialog', async (dialog) => {
    // Wait until the asynchronous operation resolves.
    await dialog.accept();
  });
}

// Export the async expectToast function.
export async function expectToast(
  // Provide the page field value.
  page: Page,
  // Provide the text field value.
  text: string | RegExp,
  // Provide the options field value.
  options: { timeout?: number; waitForHide?: boolean } = {}
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Create the timeout constant.
  const timeout = options.timeout ?? 15_000;
  // Create the locator constant.
  const locator = page.getByText(text);
  // Wait until the asynchronous operation resolves.
  await expect(locator.last()).toBeVisible({ timeout });
  // Evaluate the condition and enter the branch when it is true.
  if (options.waitForHide !== false) {
    // Wait until the asynchronous operation resolves.
    await expect(locator).toHaveCount(0, { timeout: 10_000 });
  }
}

// Export the async openOrderRowAction function.
export async function openOrderRowAction(
  // Provide the page field value.
  page: Page,
  // Provide the email field value.
  email: string,
  // Provide the action field value.
  action: 'View' | 'Edit' | 'Delete' | 'Restore'
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Create the row constant.
  const row = page.locator('tbody tr', { hasText: email });
  // Evaluate the condition and enter the branch when it is true.
  if (action === 'View' || action === 'Edit') {
    // Wait until the asynchronous operation resolves.
    await row.getByRole('link', { name: action }).click();
    // Return control to the caller with the following value.
    return;
  }
  // Wait until the asynchronous operation resolves.
  await row.getByRole('button', { name: action }).click();
}
