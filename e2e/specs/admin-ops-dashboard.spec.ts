import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  insertIsolatedTestCar,
} from '../helpers/db';
import { uniqueEmail, E2E_GUEST, allocateFutureRange } from '../helpers/test-env';
import {
  getSofiaIsoDateString,
  formatSofiaIsoDateFromParts,
  addSofiaCalendarDays,
} from '../helpers/dates';

const PREFIX = `E2E Ops Dash ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('ADMIN-010 Ops dashboard real buckets', () => {
  test.setTimeout(180_000);

  const carIds: number[] = [];
  const today = getSofiaIsoDateString();
  const yesterday = formatSofiaIsoDateFromParts(addSofiaCalendarDays(new Date(), -1));
  const tomorrow = formatSofiaIsoDateFromParts(addSofiaCalendarDays(new Date(), 1));
  const future = allocateFutureRange({ fromDaysAhead: 45, nights: 2 });

  const emails = {
    pickup: uniqueEmail('ops-pickup'),
    returns: uniqueEmail('ops-returns'),
    active: uniqueEmail('ops-active'),
    review: uniqueEmail('ops-review'),
    paid: uniqueEmail('ops-paid'),
    cancelled: uniqueEmail('ops-cancelled'),
    expired: uniqueEmail('ops-expired'),
  };

  let ids: Record<string, number> = {};

  test.beforeAll(async () => {
    await seedE2eFixtures(`${PREFIX} seed`);
    for (let i = 0; i < 7; i += 1) {
      carIds.push(await insertIsolatedTestCar(`${PREFIX} Car ${i}`, 55 + i));
    }

    const [
      pickup,
      returns,
      active,
      review,
      paid,
      cancelled,
      expired,
    ] = await Promise.all([
      seedLinkedBooking({
        carId: carIds[0],
        status: 'confirmed',
        pickupDate: today,
        returnDate: tomorrow,
        guest: { ...E2E_GUEST, email: emails.pickup, fullName: 'Ops Pickup' },
      }),
      seedLinkedBooking({
        carId: carIds[1],
        status: 'active_rental',
        pickupDate: yesterday,
        returnDate: today,
        guest: { ...E2E_GUEST, email: emails.returns, fullName: 'Ops Returns' },
      }),
      seedLinkedBooking({
        carId: carIds[2],
        status: 'picked_up',
        pickupDate: yesterday,
        returnDate: tomorrow,
        guest: { ...E2E_GUEST, email: emails.active, fullName: 'Ops Active' },
      }),
      seedLinkedBooking({
        carId: carIds[3],
        status: 'manual_review',
        pickupDate: future.pickupDate,
        returnDate: future.returnDate,
        guest: { ...E2E_GUEST, email: emails.review, fullName: 'Ops Review' },
      }),
      seedLinkedBooking({
        carId: carIds[4],
        status: 'paid',
        pickupDate: future.pickupDate,
        returnDate: future.returnDate,
        guest: { ...E2E_GUEST, email: emails.paid, fullName: 'Ops Paid' },
      }),
      seedLinkedBooking({
        carId: carIds[5],
        status: 'cancelled',
        pickupDate: future.pickupDate,
        returnDate: future.returnDate,
        withBlock: false,
        guest: { ...E2E_GUEST, email: emails.cancelled, fullName: 'Ops Cancelled' },
      }),
      seedLinkedBooking({
        carId: carIds[6],
        status: 'expired',
        pickupDate: future.pickupDate,
        returnDate: future.returnDate,
        withBlock: false,
        guest: { ...E2E_GUEST, email: emails.expired, fullName: 'Ops Expired' },
      }),
    ]);

    ids = {
      pickup: pickup.reservationId,
      returns: returns.reservationId,
      active: active.reservationId,
      review: review.reservationId,
      paid: paid.reservationId,
      cancelled: cancelled.reservationId,
      expired: expired.reservationId,
    };
  });

  test.afterAll(async () => {
    for (const id of carIds) {
      await cleanupReservationsForCar(id);
      await cleanupTestCar(id);
    }
    await cleanupE2eCarsByName(`${PREFIX} seed`);
  });

  test('widgets list seeded reservations in the correct buckets', async ({ adminPage }) => {
    await adminPage.goto('/admin/reservations');
    await expect(adminPage.getByRole('heading', { name: 'Reservation Ops' })).toBeVisible({
      timeout: 15_000,
    });

    const widgetAssertions: Array<{ title: string; email: string; id: number }> = [
      { title: "Today's Pickups", email: emails.pickup, id: ids.pickup },
      { title: "Today's Returns", email: emails.returns, id: ids.returns },
      { title: 'Active Rentals', email: emails.active, id: ids.active },
      { title: 'Manual Review', email: emails.review, id: ids.review },
      { title: 'Paid — Not Confirmed', email: emails.paid, id: ids.paid },
      { title: 'Cancelled', email: emails.cancelled, id: ids.cancelled },
      { title: 'Failed / Expired Payments', email: emails.expired, id: ids.expired },
    ];

    for (const { title, email, id } of widgetAssertions) {
      await expect(adminPage.getByRole('heading', { name: title, exact: true })).toBeVisible();
      // Same reservation can appear in multiple widgets (e.g. Today's Returns + Active Rentals).
      await expect(adminPage.getByText(email).first()).toBeVisible({ timeout: 15_000 });
      await expect(adminPage.getByRole('button', { name: String(id), exact: true }).first()).toBeVisible();
    }

    await adminPage.getByRole('button', { name: String(ids.pickup), exact: true }).click();
    await expect(adminPage).toHaveURL(new RegExp(`id=${ids.pickup}`));
    await expect(adminPage.getByRole('heading', { name: 'Status History' })).toBeVisible({
      timeout: 15_000,
    });
  });
});
