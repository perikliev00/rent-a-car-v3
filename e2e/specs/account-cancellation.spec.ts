import { expect, test } from '../fixtures/base';
import { applySessionCookies, signupVerifiedCustomer } from '../helpers/account';
import { apiPost } from '../helpers/csrf';
import {
  assertReservationStatus,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  cleanupTestCar,
  getLatestCancellationRequest,
  getPendingCancellationRequest,
  withDb,
} from '../helpers/db';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import { E2E_GUEST, allocateFutureRange, uniqueEmail } from '../helpers/test-env';

test.describe.configure({ mode: 'serial' });

test.describe("account-cancel-hold", () => {
  const CAR_NAME = `E2E Cancel Hold ${Date.now()}`;
  const PASSWORD = 'Customer123!';

  test.describe('CUST-005 Cancel own active hold immediately', () => {
    test.setTimeout(120_000);

    let carId: number;
    const range = allocateFutureRange({ fromDaysAhead: 70, nights: 2 });

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

    test('customer cancels pending_payment hold from portal immediately', async ({ page, request }) => {
      const email = uniqueEmail('cancel-hold');
      const customer = await signupVerifiedCustomer(request, { email, password: PASSWORD });

      const seeded = await seedLinkedBooking({
        carId,
        status: 'pending_payment',
        userId: customer.userId,
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
        guest: { ...E2E_GUEST, email },
      });

      await applySessionCookies(page, customer.session);
      await page.goto(`/account/reservations/${seeded.reservationId}`);
      await expect(
        page.getByRole('heading', { name: `Reservation #${seeded.reservationId}` })
      ).toBeVisible({ timeout: 15_000 });

      await page.getByRole('button', { name: 'Request cancellation' }).click();
      await expect(page.getByText('Reservation cancelled')).toBeVisible({ timeout: 15_000 });

      await assertReservationStatus(seeded.reservationId, 'cancelled');
    });
  });
});

test.describe("account-cancel-double-request", () => {
  const CAR_NAME = `E2E Cancel Double ${Date.now()}`;
  const PASSWORD = 'Customer123!';

  test.describe('Double cancellation request (97)', () => {
    test.setTimeout(120_000);

    let carId: number;
    const range = allocateFutureRange({ fromDaysAhead: 60, nights: 3 });

    test.beforeAll(async () => {
      await cleanupE2eCarsByName(CAR_NAME);
      carId = await seedE2eFixtures(CAR_NAME);
    });

    test.afterAll(async () => {
      await cleanupReservationsForCar(carId).catch(() => undefined);
      await cleanupTestCar(carId).catch(() => undefined);
    });

    test.beforeEach(async () => {
      await cleanupReservationsForCar(carId);
    });

    test('second request shows pending copy; admin sees one row', async ({
      page,
      request,
      adminPage,
    }) => {
      const email = uniqueEmail('cancel-double');
      const customer = await signupVerifiedCustomer(request, { email, password: PASSWORD });

      const seeded = await seedLinkedBooking({
        carId,
        status: 'confirmed',
        userId: customer.userId,
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
        guest: { ...E2E_GUEST, email, fullName: 'Cancel Double Guest' },
      });

      await applySessionCookies(page, customer.session);
      await page.goto(`/account/reservations/${seeded.reservationId}`);
      await expect(
        page.getByRole('heading', { name: `Reservation #${seeded.reservationId}` })
      ).toBeVisible({ timeout: 15_000 });

      await page.getByLabel('Reason (optional)').fill('First request');
      await page.getByRole('button', { name: 'Request cancellation' }).click();
      await expect(page.getByText('Cancellation request submitted for review')).toBeVisible({
        timeout: 15_000,
      });
      expect(await getPendingCancellationRequest(seeded.reservationId)).toBeTruthy();

      await page.goto(`/account/reservations/${seeded.reservationId}`);
      await expect(page.getByText('A cancellation request is pending admin review.')).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByRole('button', { name: 'Request cancellation' })).toHaveCount(0);

      const pendingCount = await withDb(async (client) => {
        const result = await client.query(
          `
          SELECT COUNT(*)::int AS count
          FROM reservation_cancellation_requests
          WHERE reservation_id = $1 AND status = 'pending'
          `,
          [seeded.reservationId]
        );
        return Number(result.rows[0].count);
      });
      expect(pendingCount).toBe(1);

      await adminPage.goto('/admin/reservations');
      await expect(adminPage.getByRole('heading', { name: 'Cancellation requests' })).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        adminPage.getByText(new RegExp(`Reservation #${seeded.reservationId}`))
      ).toHaveCount(1);
    });
  });
});

test.describe("account-cancel-terminal", () => {
  const CAR_NAME = `E2E Cancel Terminal ${Date.now()}`;
  const PASSWORD = 'Customer123!';

  test.describe('Account cancel on terminal statuses (96)', () => {
    test.setTimeout(120_000);

    let carId: number;
    const range = allocateFutureRange({ fromDaysAhead: 55, nights: 2 });

    test.beforeAll(async () => {
      await cleanupE2eCarsByName(CAR_NAME);
      carId = await seedE2eFixtures(CAR_NAME);
    });

    test.afterAll(async () => {
      await cleanupReservationsForCar(carId).catch(() => undefined);
      await cleanupTestCar(carId).catch(() => undefined);
    });

    test.beforeEach(async () => {
      await cleanupReservationsForCar(carId);
    });

    for (const status of ['completed', 'no_show'] as const) {
      test(`${status}: no Request cancellation and API refuses`, async ({ page, request }) => {
        const email = uniqueEmail(`cancel-${status}`);
        const customer = await signupVerifiedCustomer(request, { email, password: PASSWORD });

        const seeded = await seedLinkedBooking({
          carId,
          status,
          userId: customer.userId,
          pickupDate: range.pickupDate,
          returnDate: range.returnDate,
          guest: { ...E2E_GUEST, email, fullName: `Terminal ${status}` },
        });

        await applySessionCookies(page, customer.session);
        await page.goto(`/account/reservations/${seeded.reservationId}`);
        await expect(
          page.getByRole('heading', { name: `Reservation #${seeded.reservationId}` })
        ).toBeVisible({ timeout: 15_000 });

        await expect(page.getByRole('button', { name: 'Request cancellation' })).toHaveCount(0);
        expect(await getPendingCancellationRequest(seeded.reservationId)).toBeNull();

        const res = await apiPost(
          request,
          `/api/account/reservations/${seeded.reservationId}/cancel-request`,
          { reason: 'should fail' },
          customer.session
        );
        expect(res.status()).toBe(422);

        await assertReservationStatus(seeded.reservationId, status);
        expect(await getPendingCancellationRequest(seeded.reservationId)).toBeNull();
      });
    }
  });
});

test.describe("cancellation-approval", () => {
  const CAR_NAME = `E2E Cancel Approve ${Date.now()}`;
  const PASSWORD = 'Customer123!';

  test.describe('CROSS-001 Cancellation approved by admin', () => {
    test.setTimeout(120_000);

    let carId: number;
    const range = allocateFutureRange({ fromDaysAhead: 50, nights: 3 });

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

    test('customer request then admin approve cancels booking', async ({ page, request, adminPage }) => {
      const email = uniqueEmail('cancel-approve');
      const customer = await signupVerifiedCustomer(request, { email, password: PASSWORD });

      const seeded = await seedLinkedBooking({
        carId,
        status: 'confirmed',
        userId: customer.userId,
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
        guest: { ...E2E_GUEST, email, fullName: 'Cancel Approve Guest' },
      });

      await applySessionCookies(page, customer.session);
      await page.goto(`/account/reservations/${seeded.reservationId}`);
      await expect(page.getByRole('heading', { name: `Reservation #${seeded.reservationId}` })).toBeVisible({
        timeout: 15_000,
      });

      await page.getByLabel('Reason (optional)').fill('E2E cancel approve');
      await page.getByRole('button', { name: 'Request cancellation' }).click();
      await expect(page.getByText('Cancellation request submitted for review')).toBeVisible({
        timeout: 15_000,
      });

      expect(await getPendingCancellationRequest(seeded.reservationId)).toBeTruthy();

      await adminPage.goto('/admin/reservations');
      await expect(adminPage.getByRole('heading', { name: 'Cancellation requests' })).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        adminPage.getByText(new RegExp(`Reservation #${seeded.reservationId}`))
      ).toBeVisible();

      await adminPage.getByRole('button', { name: 'Approve' }).first().click();
      await expect(adminPage.getByText('Cancellation request updated')).toBeVisible({
        timeout: 15_000,
      });

      await assertReservationStatus(seeded.reservationId, 'cancelled');
      const latest = await getLatestCancellationRequest(seeded.reservationId);
      expect(latest?.status).toBe('approved');
      expect(await getPendingCancellationRequest(seeded.reservationId)).toBeNull();
    });
  });
});

test.describe("cancellation-rejection", () => {
  const CAR_NAME = `E2E Cancel Reject ${Date.now()}`;
  const PASSWORD = 'Customer123!';

  test.describe('CROSS-002 Cancellation rejected keeps booking', () => {
    test.setTimeout(120_000);

    let carId: number;
    const range = allocateFutureRange({ fromDaysAhead: 55, nights: 3 });

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

    test('admin reject leaves reservation confirmed in portal', async ({ page, request, adminPage }) => {
      const email = uniqueEmail('cancel-reject');
      const customer = await signupVerifiedCustomer(request, { email, password: PASSWORD });

      const seeded = await seedLinkedBooking({
        carId,
        status: 'confirmed',
        userId: customer.userId,
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
        guest: { ...E2E_GUEST, email, fullName: 'Cancel Reject Guest' },
      });

      await applySessionCookies(page, customer.session);
      await page.goto(`/account/reservations/${seeded.reservationId}`);
      await page.getByLabel('Reason (optional)').fill('E2E cancel reject');
      await page.getByRole('button', { name: 'Request cancellation' }).click();
      await expect(page.getByText('Cancellation request submitted for review')).toBeVisible({
        timeout: 15_000,
      });

      await adminPage.goto('/admin/reservations');
      await expect(
        adminPage.getByText(new RegExp(`Reservation #${seeded.reservationId}`))
      ).toBeVisible({ timeout: 15_000 });
      await adminPage.getByRole('button', { name: 'Reject' }).first().click();
      await expect(adminPage.getByText('Cancellation request updated')).toBeVisible({
        timeout: 15_000,
      });

      await assertReservationStatus(seeded.reservationId, 'confirmed');
      const latest = await getLatestCancellationRequest(seeded.reservationId);
      expect(latest?.status).toBe('rejected');
      expect(await getPendingCancellationRequest(seeded.reservationId)).toBeNull();

      await page.goto('/account/reservations');
      await expect(page.getByText(`Reservation #${seeded.reservationId}`)).toBeVisible({
        timeout: 15_000,
      });
    });
  });
});
