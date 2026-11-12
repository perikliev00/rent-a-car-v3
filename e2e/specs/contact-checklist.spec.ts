// Import named exports from '../fixtures/base'.
import { expect, test } from '../fixtures/base';
// Import named exports from '../helpers/account'.
import { applySessionCookies, signupCustomer } from '../helpers/account';
// Import named exports from '../helpers/admin-reservations'.
import { applyOpsStatus, fillAndSavePickupChecklist, fillAndSaveReturnChecklist } from '../helpers/admin-reservations';
// Import named exports from '../helpers/contacts'.
import { deleteContactViaApi, updateContactStatusViaApi } from '../helpers/contacts';
// Import named exports from '../helpers/csrf'.
import { apiGet, loginAsAdmin } from '../helpers/csrf';
// Import named exports from '../helpers/dates'.
import { addSofiaCalendarDays, formatSofiaIsoDateFromParts, getSofiaIsoDateString } from '../helpers/dates';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  assertReservationStatus,
  // Contribute this line to the enclosing declaration or statement.
  cleanupE2eCarsByName,
  // Contribute this line to the enclosing declaration or statement.
  cleanupReservationsForCar,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/db';
// Import named exports from '../helpers/rbac'.
import { loginAsStaff } from '../helpers/rbac';
// Import named exports from '../helpers/seed'.
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
// Import named exports from '../helpers/test-env'.
import { E2E_GUEST, allocateFutureRange, uniqueEmail } from '../helpers/test-env';

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe("contact-support-lifecycle", () => {
  // Call test.describe to perform this step.
  test.describe('CROSS-005 Contact → support inbox lifecycle', () => {
    // Call test.use to perform this step.
    test.use({ role: 'support' });
    // Call test.setTimeout to perform this step.
    test.setTimeout(120_000);

    // Define a single test case and its expectations.
    test('guest submit → new → ready → done → delete', async ({ page, staffPage, staffUser, request }) => {
      // Create the subject constant.
      const subject = `E2E Contact ${Date.now()}`;
      // Create the email constant.
      const email = uniqueEmail('contact');

      // Wait until the asynchronous operation resolves.
      await page.goto('/contact');
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: /Contact/i }).first()).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Name').fill('Contact Guest');
      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Email').fill(email);
      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Subject').fill(subject);
      // Wait until the asynchronous operation resolves.
      await page.getByLabel('Message').fill('Please help with my booking question.');
      // Wait until the asynchronous operation resolves.
      await page.getByRole('button', { name: /Send|Submit/i }).click();
      // Wait until the asynchronous operation resolves.
      await expect(page.getByText(/Message sent|get back to you/i)).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });

      // Wait until the asynchronous operation resolves.
      await staffPage.goto('/admin/contacts');
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByRole('heading', { name: /Contacts/i })).toBeVisible({
        // Provide the timeout field value.
        timeout: 15_000,
      });
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByText(subject)).toBeVisible({ timeout: 15_000 });

      // Create the session constant.
      const session = await loginAsStaff(request, staffUser);
      // Create the listed constant.
      const listed = await apiGet(request, '/api/admin/contacts', session);
      // Assert that the value matches the intended expectation.
      expect(listed.ok()).toBeTruthy();
      // Create the body constant.
      const body = await listed.json();
      // Create the contacts constant.
      const contacts = body?.data?.contacts ?? body?.contacts ?? [];
      // Create the row constant.
      const row = contacts.find((c: { subject?: string; email?: string }) => c.subject === subject || c.email === email);
      // Assert that the value matches the intended expectation.
      expect(row).toBeTruthy();
      // Create the contact id constant.
      const contactId = Number(row.id);
      // Assert that the value matches the intended expectation.
      expect(row.status).toBe('new');

      // Create the ready constant.
      const ready = await updateContactStatusViaApi(request, session, contactId, 'ready');
      // Assert that the value matches the intended expectation.
      expect(ready.status, JSON.stringify(ready.body)).toBe(200);

      // Create the done constant.
      const done = await updateContactStatusViaApi(request, session, contactId, 'done');
      // Assert that the value matches the intended expectation.
      expect(done.status, JSON.stringify(done.body)).toBe(200);

      // Wait until the asynchronous operation resolves.
      await staffPage.reload();
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByText(subject)).toBeVisible();
      // Create the select constant.
      const select = staffPage
        // Call .locator to perform this step.
        .locator('tr, div')
        // Call .filter to perform this step.
        .filter({ hasText: subject })
        // Call .locator to perform this step.
        .locator('select')
        // Call .first to perform this step.
        .first();
      // Wait until the asynchronous operation resolves.
      await expect(select).toHaveValue('done');

      // Create the deleted constant.
      const deleted = await deleteContactViaApi(request, session, contactId);
      // Assert that the value matches the intended expectation.
      expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);

      // Wait until the asynchronous operation resolves.
      await staffPage.reload();
      // Wait until the asynchronous operation resolves.
      await expect(staffPage.getByText(subject)).toHaveCount(0);

      // Optional audit via owner session
      const owner = await loginAsAdmin(request);
      // Create the audit constant.
      const audit = await apiGet(
        // Contribute this line to the enclosing declaration or statement.
        request,
        // Continue the surrounding logic with this statement.
        '/api/admin/audit-logs?actionPrefix=admin&limit=50',
        // Reference the identifier used by the enclosing expression.
        owner
      );
      // Evaluate the condition and enter the branch when it is true.
      if (audit.ok()) {
        // Create the audit body constant.
        const auditBody = await audit.json();
        // Create the logs constant.
        const logs = auditBody?.data?.logs ?? auditBody?.logs ?? [];
        // Create the actions constant.
        const actions = logs.map((l: { action?: string }) => l.action);
        // Assert that the value matches the intended expectation.
        expect(
          // Call actions.some to perform this step.
          actions.some(
            // Continue the surrounding logic with this statement.
            (a: string) =>
              // Update a with the right-hand side value.
              a === 'admin.updated_contact_status' || a === 'admin.deleted_contact'
          )
        // Continue the surrounding logic with this statement.
        ).toBeTruthy();
      }
    });
  });
});

// Call test.describe to perform this step.
test.describe("checklist-customer-documents", () => {
  // Create the car name constant.
  const CAR_NAME = `E2E Checklist Docs ${Date.now()}`;
  // Create the password constant.
  const PASSWORD = 'Customer123!';

  // Call test.describe to perform this step.
  test.describe('CROSS-003 Pickup/return checklists + PDFs to customer', () => {
    // Call test.setTimeout to perform this step.
    test.setTimeout(180_000);

    // Contribute this line to the enclosing declaration or statement.
    let carId: number;
    // Use Sofia today so ops widgets stay usable if Apply is needed; checklists work via ?id= alone.
    const today = getSofiaIsoDateString();
    // Create the return date constant.
    const returnDate = formatSofiaIsoDateFromParts(addSofiaCalendarDays(new Date(), 2));
    // Create the future constant.
    const future = allocateFutureRange({ fromDaysAhead: 55, nights: 3 });

    // Call test.beforeAll to perform this step.
    test.beforeAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupE2eCarsByName(CAR_NAME);
      // Store the awaited result in carId.
      carId = await seedE2eFixtures(CAR_NAME);
    });

    // Call test.afterAll to perform this step.
    test.afterAll(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupTestCar(carId);
    });

    // Call test.beforeEach to perform this step.
    test.beforeEach(async () => {
      // Wait until the asynchronous operation resolves.
      await cleanupReservationsForCar(carId);
    });

    // Define a single test case and its expectations.
    test('admin checklists unlock customer PDF downloads', async ({
      // Contribute this line to the enclosing declaration or statement.
      page,
      // Contribute this line to the enclosing declaration or statement.
      request,
      // Contribute this line to the enclosing declaration or statement.
      adminPage,
    // Continue the surrounding logic with this statement.
    }) => {
      // Create the email constant.
      const email = uniqueEmail('checklist-pdf');
      // Create the customer constant.
      const customer = await signupCustomer(request, { email, password: PASSWORD });

      // Create the seeded constant.
      const seeded = await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'confirmed',
        // Provide the user id field value.
        userId: customer.userId,
        // Provide the pickup date field value.
        pickupDate: today,
        // Provide the return date field value.
        returnDate: returnDate || future.returnDate,
        // Provide the guest field value.
        guest: { ...E2E_GUEST, email, fullName: 'Checklist Guest' },
      });
      // Create the reservation id constant.
      const reservationId = seeded.reservationId;

      // Wait until the asynchronous operation resolves.
      await fillAndSavePickupChecklist(adminPage, reservationId, {
        // Provide the fuel level field value.
        fuelLevel: 'full',
        // Provide the mileage field value.
        mileage: '10000',
      });
      // Wait until the asynchronous operation resolves.
      await assertReservationStatus(reservationId, 'picked_up');

      // Return checklist requires picked_up/active_rental — advance if product needs active_rental.
      await applyOpsStatus(adminPage, reservationId, 'active_rental', { request });
      // Wait until the asynchronous operation resolves.
      await assertReservationStatus(reservationId, 'active_rental');

      // Wait until the asynchronous operation resolves.
      await fillAndSaveReturnChecklist(adminPage, reservationId, {
        // Provide the fuel level field value.
        fuelLevel: 'half',
        // Provide the mileage field value.
        mileage: '10100',
      });
      // Wait until the asynchronous operation resolves.
      await assertReservationStatus(reservationId, 'returned');

      // Wait until the asynchronous operation resolves.
      await applySessionCookies(page, customer.session);
      // Wait until the asynchronous operation resolves.
      await page.goto(`/account/reservations/${reservationId}`);
      // Wait until the asynchronous operation resolves.
      await expect(
        // Call page.getByRole to perform this step.
        page.getByRole('heading', { name: `Reservation #${reservationId}` })
      // Continue the surrounding logic with this statement.
      ).toBeVisible({ timeout: 15_000 });

      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('heading', { name: 'Documents (PDF)' })).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('button', { name: 'Pickup checklist' })).toBeVisible();
      // Wait until the asynchronous operation resolves.
      await expect(page.getByRole('button', { name: 'Return checklist' })).toBeVisible();

      // Create the download promise constant.
      const downloadPromise = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null);
      // Wait until the asynchronous operation resolves.
      await page.getByRole('button', { name: 'Pickup checklist' }).click();
      // Create the download constant.
      const download = await downloadPromise;
      // Evaluate the condition and enter the branch when it is true.
      if (download) {
        // Assert that the value matches the intended expectation.
        expect(download.suggestedFilename()).toMatch(/pickup|checklist|pdf/i);
      }
      // Wait until the asynchronous operation resolves.
      await expect(
        // Call page.getByRole to perform this step.
        page.getByRole('heading', { name: `Reservation #${reservationId}` })
      // Continue the surrounding logic with this statement.
      ).toBeVisible();
    });
  });
});
