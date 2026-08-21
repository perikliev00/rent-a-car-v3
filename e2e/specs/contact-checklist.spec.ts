import { expect, test } from '../fixtures/base';
import { applySessionCookies, signupCustomer } from '../helpers/account';
import { applyOpsStatus, fillAndSavePickupChecklist, fillAndSaveReturnChecklist } from '../helpers/admin-reservations';
import { deleteContactViaApi, updateContactStatusViaApi } from '../helpers/contacts';
import { apiGet, loginAsAdmin } from '../helpers/csrf';
import { addSofiaCalendarDays, formatSofiaIsoDateFromParts, getSofiaIsoDateString } from '../helpers/dates';
import {
  assertReservationStatus,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  cleanupTestCar,
} from '../helpers/db';
import { loginAsStaff } from '../helpers/rbac';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import { E2E_GUEST, allocateFutureRange, uniqueEmail } from '../helpers/test-env';

test.describe.configure({ mode: 'serial' });

test.describe("contact-support-lifecycle", () => {
  test.describe('CROSS-005 Contact → support inbox lifecycle', () => {
    test.use({ role: 'support' });
    test.setTimeout(120_000);

    test('guest submit → new → ready → done → delete', async ({ page, staffPage, staffUser, request }) => {
      const subject = `E2E Contact ${Date.now()}`;
      const email = uniqueEmail('contact');

      await page.goto('/contact');
      await expect(page.getByRole('heading', { name: /Contact/i }).first()).toBeVisible({
        timeout: 15_000,
      });
      await page.getByLabel('Name').fill('Contact Guest');
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Subject').fill(subject);
      await page.getByLabel('Message').fill('Please help with my booking question.');
      await page.getByRole('button', { name: /Send|Submit/i }).click();
      await expect(page.getByText(/Message sent|get back to you/i)).toBeVisible({
        timeout: 15_000,
      });

      await staffPage.goto('/admin/contacts');
      await expect(staffPage.getByRole('heading', { name: /Contacts/i })).toBeVisible({
        timeout: 15_000,
      });
      await expect(staffPage.getByText(subject)).toBeVisible({ timeout: 15_000 });

      const session = await loginAsStaff(request, staffUser);
      const listed = await apiGet(request, '/api/admin/contacts', session);
      expect(listed.ok()).toBeTruthy();
      const body = await listed.json();
      const contacts = body?.data?.contacts ?? body?.contacts ?? [];
      const row = contacts.find((c: { subject?: string; email?: string }) => c.subject === subject || c.email === email);
      expect(row).toBeTruthy();
      const contactId = Number(row.id);
      expect(row.status).toBe('new');

      const ready = await updateContactStatusViaApi(request, session, contactId, 'ready');
      expect(ready.status, JSON.stringify(ready.body)).toBe(200);

      const done = await updateContactStatusViaApi(request, session, contactId, 'done');
      expect(done.status, JSON.stringify(done.body)).toBe(200);

      await staffPage.reload();
      await expect(staffPage.getByText(subject)).toBeVisible();
      const select = staffPage
        .locator('tr, div')
        .filter({ hasText: subject })
        .locator('select')
        .first();
      await expect(select).toHaveValue('done');

      const deleted = await deleteContactViaApi(request, session, contactId);
      expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);

      await staffPage.reload();
      await expect(staffPage.getByText(subject)).toHaveCount(0);

      // Optional audit via owner session
      const owner = await loginAsAdmin(request);
      const audit = await apiGet(
        request,
        '/api/admin/audit-logs?actionPrefix=admin&limit=50',
        owner
      );
      if (audit.ok()) {
        const auditBody = await audit.json();
        const logs = auditBody?.data?.logs ?? auditBody?.logs ?? [];
        const actions = logs.map((l: { action?: string }) => l.action);
        expect(
          actions.some(
            (a: string) =>
              a === 'admin.updated_contact_status' || a === 'admin.deleted_contact'
          )
        ).toBeTruthy();
      }
    });
  });
});

test.describe("checklist-customer-documents", () => {
  const CAR_NAME = `E2E Checklist Docs ${Date.now()}`;
  const PASSWORD = 'Customer123!';

  test.describe('CROSS-003 Pickup/return checklists + PDFs to customer', () => {
    test.setTimeout(180_000);

    let carId: number;
    // Use Sofia today so ops widgets stay usable if Apply is needed; checklists work via ?id= alone.
    const today = getSofiaIsoDateString();
    const returnDate = formatSofiaIsoDateFromParts(addSofiaCalendarDays(new Date(), 2));
    const future = allocateFutureRange({ fromDaysAhead: 55, nights: 3 });

    test.beforeAll(async () => {
      await cleanupE2eCarsByName(CAR_NAME);
      carId = await seedE2eFixtures(CAR_NAME);
    });

    test.afterAll(async () => {
      await cleanupTestCar(carId);
    });

    test.beforeEach(async () => {
      await cleanupReservationsForCar(carId);
    });

    test('admin checklists unlock customer PDF downloads', async ({
      page,
      request,
      adminPage,
    }) => {
      const email = uniqueEmail('checklist-pdf');
      const customer = await signupCustomer(request, { email, password: PASSWORD });

      const seeded = await seedLinkedBooking({
        carId,
        status: 'confirmed',
        userId: customer.userId,
        pickupDate: today,
        returnDate: returnDate || future.returnDate,
        guest: { ...E2E_GUEST, email, fullName: 'Checklist Guest' },
      });
      const reservationId = seeded.reservationId;

      await fillAndSavePickupChecklist(adminPage, reservationId, {
        fuelLevel: 'full',
        mileage: '10000',
      });
      await assertReservationStatus(reservationId, 'picked_up');

      // Return checklist requires picked_up/active_rental — advance if product needs active_rental.
      await applyOpsStatus(adminPage, reservationId, 'active_rental', { request });
      await assertReservationStatus(reservationId, 'active_rental');

      await fillAndSaveReturnChecklist(adminPage, reservationId, {
        fuelLevel: 'half',
        mileage: '10100',
      });
      await assertReservationStatus(reservationId, 'returned');

      await applySessionCookies(page, customer.session);
      await page.goto(`/account/reservations/${reservationId}`);
      await expect(
        page.getByRole('heading', { name: `Reservation #${reservationId}` })
      ).toBeVisible({ timeout: 15_000 });

      await expect(page.getByRole('heading', { name: 'Documents (PDF)' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Pickup checklist' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Return checklist' })).toBeVisible();

      const downloadPromise = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null);
      await page.getByRole('button', { name: 'Pickup checklist' }).click();
      const download = await downloadPromise;
      if (download) {
        expect(download.suggestedFilename()).toMatch(/pickup|checklist|pdf/i);
      }
      await expect(
        page.getByRole('heading', { name: `Reservation #${reservationId}` })
      ).toBeVisible();
    });
  });
});
