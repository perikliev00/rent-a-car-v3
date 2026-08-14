import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  backdateReservationCreatedAt,
  countNotificationsByType,
  assertReservationStatus,
} from '../helpers/db';
import { allocateFutureRange, uniqueEmail, E2E_GUEST } from '../helpers/test-env';
import { runNotificationSchedulerViaApi } from '../helpers/notifications';

const CAR_NAME = `E2E Abandoned Reminder ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Abandoned checkout reminder (92)', () => {
  test.setTimeout(120_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 270, nights: 2 });
  const guestEmail = uniqueEmail('abandon-rem');

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupReservationsForCar(carId).catch(() => undefined);
    await cleanupTestCar(carId).catch(() => undefined);
  });

  test('scheduler enqueues abandoned_checkout_reminder while hold is still pending', async ({
    request,
    adminPage,
  }) => {
    await cleanupReservationsForCar(carId);

    // Seed hold with email already on the row (checkout form alone does not persist email).
    const seeded = await seedLinkedBooking({
      carId,
      status: 'pending_payment',
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      pickupTime: range.pickupTime,
      returnTime: range.returnTime,
      withOrder: false,
      withBlock: false,
      holdExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      guest: { ...E2E_GUEST, email: guestEmail, fullName: 'Abandon Reminder Guest' },
    });
    const reservationId = seeded.reservationId;

    await backdateReservationCreatedAt(reservationId, 30);

    const run = await runNotificationSchedulerViaApi(request);
    expect(run.ok, JSON.stringify(run.body)).toBeTruthy();

    await expect
      .poll(
        async () =>
          countNotificationsByType('abandoned_checkout_reminder', { reservationId }),
        { timeout: 15_000 }
      )
      .toBeGreaterThanOrEqual(1);

    expect(
      await countNotificationsByType('abandoned_checkout_reminder', {
        reservationId,
        status: 'sent',
      })
    ).toBeGreaterThanOrEqual(1);

    await assertReservationStatus(reservationId, 'pending_payment');

    await adminPage.goto('/admin/notifications');
    await expect(adminPage.getByRole('heading', { name: 'Notifications' })).toBeVisible({
      timeout: 15_000,
    });
    await adminPage.getByLabel('Status').selectOption('sent');
    await expect(adminPage.getByText('abandoned_checkout_reminder').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(adminPage.getByText(guestEmail).first()).toBeVisible();
  });
});
