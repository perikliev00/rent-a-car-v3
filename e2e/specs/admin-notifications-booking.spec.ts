import { test, expect } from '../fixtures/base';
import { seedE2eFixtures } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  getReservationByStripeSessionId,
  countNotificationsByType,
  eurosToStripeCents,
} from '../helpers/db';
import { allocateFutureRange, uniqueEmail, E2E_GUEST } from '../helpers/test-env';
import {
  openOrderAndResolveConflict,
  continueToCheckoutAndFillGuest,
} from '../helpers/booking';
import { buildCheckoutCompletedEvent, postSignedWebhook } from '../helpers/stripe-webhook';
import { listNotificationsViaApi } from '../helpers/notifications';

const CAR_NAME = `E2E Notif Booking ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('Admin notifications after booking (91)', () => {
  test.setTimeout(180_000);

  let carId: number;
  const range = allocateFutureRange({ fromDaysAhead: 260, nights: 2 });
  const guestEmail = uniqueEmail('notif-book');

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupReservationsForCar(carId).catch(() => undefined);
    await cleanupTestCar(carId).catch(() => undefined);
  });

  test('confirmation and admin_new_booking_alert appear as sent', async ({
    page,
    request,
    adminPage,
  }) => {
    await cleanupReservationsForCar(carId);

    await openOrderAndResolveConflict(page, carId, range);
    await continueToCheckoutAndFillGuest(page, carId, {
      ...E2E_GUEST,
      email: guestEmail,
      hotelName: '',
    });
    await page.getByRole('button', { name: 'Pay with Stripe' }).click();
    await page.waitForURL(/\/checkout\/success\?session_id=/, { timeout: 15_000 });

    const stripeSessionId = new URL(page.url()).searchParams.get('session_id') || '';
    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    expect(reservation).toBeTruthy();

    const event = buildCheckoutCompletedEvent({
      eventId: `evt_e2e_notif_${Date.now()}`,
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId: reservation.car_id,
      sessionIdMeta: reservation.session_id,
      amountTotal: eurosToStripeCents(Number(reservation.total_price)),
    });
    expect((await postSignedWebhook(request, event)).status()).toBe(200);

    await expect
      .poll(
        async () =>
          (await countNotificationsByType('reservation_confirmation', {
            reservationId: Number(reservation.id),
          })) >= 1,
        { timeout: 15_000 }
      )
      .toBe(true);
    await expect
      .poll(
        async () =>
          (await countNotificationsByType('admin_new_booking_alert', {
            reservationId: Number(reservation.id),
          })) >= 1,
        { timeout: 15_000 }
      )
      .toBe(true);

    const listed = await listNotificationsViaApi(request, { limit: 50, status: 'sent' });
    expect(listed.ok, JSON.stringify(listed.body)).toBeTruthy();
    const types = listed.items.map((n: { type?: string }) => n.type);
    expect(types).toContain('reservation_confirmation');
    expect(types).toContain('admin_new_booking_alert');

    await adminPage.goto('/admin/notifications');
    await expect(adminPage.getByRole('heading', { name: 'Notifications' })).toBeVisible({
      timeout: 15_000,
    });
    await adminPage.getByLabel('Status').selectOption('sent');
    await expect(adminPage.getByText('reservation_confirmation').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(adminPage.getByText('admin_new_booking_alert').first()).toBeVisible();
    await expect(adminPage.getByText(guestEmail).first()).toBeVisible();
  });
});
