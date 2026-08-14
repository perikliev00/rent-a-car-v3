import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  getOrderById,
  getReservationById,
  assertDateBlockCovers,
  assertOrderLinkedToReservation,
  assertReservationStatus,
  countDateBlocksForCar,
} from '../helpers/db';
import { allocateFutureRange, formatSofiaIsoDateFromParts, addSofiaCalendarDays, parseSofiaDate } from '../helpers/dates';
import { uniqueEmail, E2E_GUEST } from '../helpers/test-env';
import { fillEditOrderDates, openOrderRowAction } from '../helpers/admin-orders';

const CAR_NAME = `E2E Admin Edit ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('ADMIN-002 Edit order syncs reservation + calendar', () => {
  test.setTimeout(120_000);

  let carId: number;

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

  test('success path updates order, reservation, block, and price together', async ({
    adminPage,
  }) => {
    const email = uniqueEmail('admin-edit-ok');
    const range = allocateFutureRange({ fromDaysAhead: 25, nights: 3 });
    const newReturnDate = formatSofiaIsoDateFromParts(
      addSofiaCalendarDays(parseSofiaDate(range.pickupDate, '00:00')!, 5)
    );

    const linked = await seedLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: range.pickupDate,
      returnDate: range.returnDate,
      pickupTime: range.pickupTime,
      returnTime: range.returnTime,
      guest: { ...E2E_GUEST, email, fullName: 'Edit Sync Guest' },
      totalPrice: 165,
      dayPrice: 55,
    });

    const beforeOrder = await getOrderById(linked.orderId);
    const beforeRes = await getReservationById(linked.reservationId);
    expect(Number(beforeOrder.total_price)).toBe(165);

    await adminPage.goto('/admin/orders');
    await adminPage.getByLabel('Search').fill(email);
    await expect(adminPage.getByText(email)).toBeVisible({ timeout: 10_000 });
    await openOrderRowAction(adminPage, email, 'Edit');
    await expect(
      adminPage.getByRole('heading', { name: `Edit order #${linked.orderId}` })
    ).toBeVisible();

    await fillEditOrderDates(adminPage, {
      returnDate: newReturnDate,
      pickupLocationLabel: 'Sunny Beach',
    });
    await adminPage.getByRole('button', { name: 'Save' }).click();
    await expect(adminPage.getByText('Order updated')).toBeVisible({ timeout: 15_000 });
    await expect(adminPage).toHaveURL(new RegExp(`/admin/orders/${linked.orderId}`));

    const afterOrder = await getOrderById(linked.orderId);
    const afterRes = await getReservationById(linked.reservationId);

    expect(String(afterOrder.return_date).slice(0, 10)).not.toBe(
      String(beforeOrder.return_date).slice(0, 10)
    );
    expect(Number(afterOrder.total_price)).not.toBe(Number(beforeOrder.total_price));
    expect(String(afterRes.return_date).slice(0, 10)).toBe(
      String(afterOrder.return_date).slice(0, 10)
    );
    expect(Number(afterRes.total_price)).toBe(Number(afterOrder.total_price));
    expect(afterRes.pickup_location).toBe(afterOrder.pickup_location || afterRes.pickup_location);
    await assertOrderLinkedToReservation(linked.orderId, linked.reservationId);
    await assertReservationStatus(linked.reservationId, 'confirmed');
    await assertDateBlockCovers(carId, range.pickupDate, newReturnDate);
    expect(await countDateBlocksForCar(carId)).toBe(1);

    // Snapshot object should move with price recalculation
    expect(beforeRes.price_snapshot?.totalPrice).toBe(165);
    expect(afterRes.price_snapshot?.totalPrice).toBe(Number(afterOrder.total_price));
  });

  test('conflict path leaves order, reservation, and block unchanged', async ({ adminPage }) => {
    const emailA = uniqueEmail('admin-edit-a');
    const emailB = uniqueEmail('admin-edit-b');
    const rangeA = allocateFutureRange({ fromDaysAhead: 40, nights: 2 });
    const rangeB = allocateFutureRange({ fromDaysAhead: 43, nights: 2 });

    const linkedA = await seedLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: rangeA.pickupDate,
      returnDate: rangeA.returnDate,
      guest: { ...E2E_GUEST, email: emailA, fullName: 'Conflict Order A' },
      totalPrice: 110,
    });

    await seedLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: rangeB.pickupDate,
      returnDate: rangeB.returnDate,
      guest: { ...E2E_GUEST, email: emailB, fullName: 'Conflict Order B' },
      totalPrice: 110,
    });

    const beforeOrder = await getOrderById(linkedA.orderId);
    const beforeRes = await getReservationById(linkedA.reservationId);
    const beforeBlocks = await countDateBlocksForCar(carId);

    await adminPage.goto(`/admin/orders/${linkedA.orderId}/edit`);
    await expect(
      adminPage.getByRole('heading', { name: `Edit order #${linkedA.orderId}` })
    ).toBeVisible();

    // Move A onto B's exact window to force a booking-block overlap.
    await fillEditOrderDates(adminPage, {
      pickupDate: rangeB.pickupDate,
      returnDate: rangeB.returnDate,
    });
    await adminPage.getByRole('button', { name: 'Save' }).click();

    await expect(
      adminPage.getByText(/already booked|Booking overlaps|different dates|active online reservation/i)
    ).toBeVisible({ timeout: 8_000 });
    await expect(adminPage).toHaveURL(new RegExp(`/admin/orders/${linkedA.orderId}/edit`));

    const afterOrder = await getOrderById(linkedA.orderId);
    const afterRes = await getReservationById(linkedA.reservationId);
    expect(String(afterOrder.return_date)).toBe(String(beforeOrder.return_date));
    expect(Number(afterOrder.total_price)).toBe(Number(beforeOrder.total_price));
    expect(String(afterRes.return_date)).toBe(String(beforeRes.return_date));
    expect(Number(afterRes.total_price)).toBe(Number(beforeRes.total_price));
    expect(await countDateBlocksForCar(carId)).toBe(beforeBlocks);
    await assertDateBlockCovers(carId, rangeA.pickupDate, rangeA.returnDate);
  });
});
