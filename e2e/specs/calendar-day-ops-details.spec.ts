import { test, expect } from '../fixtures/base';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import {
  cleanupTestCar,
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
} from '../helpers/db';
import { uniqueEmail, E2E_GUEST } from '../helpers/test-env';
import {
  getSofiaIsoDateString,
  addSofiaCalendarDays,
  formatSofiaIsoDateFromParts,
  parseSofiaDate,
} from '../helpers/dates';
import { openCalendarMonth, openCalendarWeek } from '../helpers/calendar';

const CAR_NAME = `E2E Cal DayOps ${Date.now()}`;

test.describe.configure({ mode: 'serial' });

test.describe('ADMIN-020 Calendar day ops + reservation deep links', () => {
  test.setTimeout(120_000);

  let carId: number;
  const today = getSofiaIsoDateString();
  const returnDate = formatSofiaIsoDateFromParts(
    addSofiaCalendarDays(parseSofiaDate(today, '00:00') ?? new Date(), 3)
  );
  const guestName = `Day Ops Guest ${Date.now()}`;
  const guestEmail = uniqueEmail('day-ops');

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupReservationsForCar(carId);
    await cleanupTestCar(carId);
  });

  test.beforeEach(async () => {
    await cleanupReservationsForCar(carId);
  });

  test('day ops pickups and event drawer open reservation ops', async ({ adminPage }) => {
    const seeded = await seedLinkedBooking({
      carId,
      status: 'confirmed',
      withBlock: true,
      pickupDate: today,
      returnDate,
      pickupTime: '10:00',
      returnTime: '10:00',
      guest: { ...E2E_GUEST, email: guestEmail, fullName: guestName },
    });

    await openCalendarMonth(adminPage, today);

    const [y, m, d] = today.split('-').map(Number);
    const localDate = new Date(y, m - 1, d);
    const weekday = localDate.toLocaleDateString('en-US', { weekday: 'short' });
    await adminPage
      .getByTestId('month-fleet-grid')
      .getByRole('button')
      .filter({ hasText: weekday })
      .filter({ hasText: String(d) })
      .first()
      .click();

    await expect(
      adminPage.getByRole('heading', { name: new RegExp(`Day ops ·`) })
    ).toBeVisible({ timeout: 15_000 });

    await expect(adminPage.getByRole('button', { name: /Pickups/ })).toBeVisible();
    await expect(adminPage.getByText(guestName)).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByText(String(seeded.reservationId)).or(adminPage.getByText(guestName))).toBeVisible();

    await adminPage.getByRole('button', { name: 'Open' }).first().click();
    await adminPage.waitForURL(new RegExp(`/admin/reservations\\?id=${seeded.reservationId}`), {
      timeout: 15_000,
    });

    await openCalendarWeek(adminPage, today);
    await adminPage.locator('[data-event="1"]').filter({ hasText: guestName }).first().click();
    await expect(adminPage.getByRole('heading', { name: 'Event details' })).toBeVisible({
      timeout: 10_000,
    });

    await adminPage.getByTestId('open-reservation-ops').click();
    await adminPage.waitForURL(new RegExp(`/admin/reservations\\?id=${seeded.reservationId}`), {
      timeout: 15_000,
    });

    await openCalendarWeek(adminPage, today);
    const url = new URL(adminPage.url());
    expect(url.searchParams.has('view')).toBeTruthy();
    expect(url.searchParams.has('date')).toBeTruthy();
    expect(url.searchParams.has('id')).toBeFalsy();
    expect(url.searchParams.has('event')).toBeFalsy();
    expect(url.searchParams.has('eventId')).toBeFalsy();
  });
});
