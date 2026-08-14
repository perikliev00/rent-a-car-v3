import type { Page } from '@playwright/test';
import { E2E_GUEST } from './test-env';

export type AdminOrderFormValues = {
  carName: string;
  pickupDate: string;
  returnDate: string;
  pickupTime?: string;
  returnTime?: string;
  pickupLocationLabel?: string;
  returnLocationLabel?: string;
  fullName?: string;
  email: string;
  phoneNumber?: string;
  address?: string;
  hotelName?: string;
};

export async function fillCreateOrderForm(page: Page, values: AdminOrderFormValues): Promise<void> {
  await page.getByLabel('Car').selectOption({ label: values.carName });
  await page.getByLabel('Full name').fill(values.fullName ?? E2E_GUEST.fullName);
  await page.getByLabel('Email').fill(values.email);
  await page.getByLabel('Phone').fill(values.phoneNumber ?? E2E_GUEST.phoneNumber);
  await page.getByLabel('Pickup date').fill(values.pickupDate);
  await page.getByLabel('Return date').fill(values.returnDate);
  await page.getByLabel('Pickup time').fill(values.pickupTime ?? '10:00');
  await page.getByLabel('Return time').fill(values.returnTime ?? '10:00');
  await page
    .getByLabel('Pickup location')
    .selectOption({ label: values.pickupLocationLabel ?? 'Office' });
  await page
    .getByLabel('Return location')
    .selectOption({ label: values.returnLocationLabel ?? 'Office' });
  await page.getByLabel('Address').fill(values.address ?? E2E_GUEST.address);
  if (values.hotelName !== undefined || E2E_GUEST.hotelName) {
    await page.getByLabel('Hotel').fill(values.hotelName ?? E2E_GUEST.hotelName);
  }
}

export async function fillEditOrderDates(
  page: Page,
  values: { returnDate?: string; pickupDate?: string; pickupLocationLabel?: string }
): Promise<void> {
  if (values.pickupDate) {
    await page.getByLabel('Pickup date').fill(values.pickupDate);
  }
  if (values.returnDate) {
    await page.getByLabel('Return date').fill(values.returnDate);
  }
  if (values.pickupLocationLabel) {
    await page.getByLabel('Pickup location').selectOption({ label: values.pickupLocationLabel });
  }
}

export function confirmDeleteDialog(page: Page): void {
  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });
}

export async function openOrderRowAction(
  page: Page,
  email: string,
  action: 'View' | 'Edit' | 'Delete' | 'Restore'
): Promise<void> {
  const row = page.locator('tbody tr', { hasText: email });
  if (action === 'View' || action === 'Edit') {
    await row.getByRole('link', { name: action }).click();
    return;
  }
  await row.getByRole('button', { name: action }).click();
}
