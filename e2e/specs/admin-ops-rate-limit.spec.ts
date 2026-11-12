import { test, expect } from '../fixtures/base';
import { changeOpsStatusViaApi } from '../helpers/admin-reservations';
import { waitForAdminLive } from '../helpers/admin-realtime';
import {
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  cleanupTestCar,
} from '../helpers/db';
import { loginAsAdmin } from '../helpers/csrf';
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
import { allocateFutureRange, API_URL, E2E_GUEST, uniqueEmail } from '../helpers/test-env';

const CAR_NAME = `E2E Ops RateLimit ${Date.now()}`;
const STATUS_WALK = ['car_prepared', 'picked_up', 'active_rental', 'returned', 'completed'] as const;
const BOOKING_COUNT = 10;

test.describe.configure({ mode: 'serial' });

test.describe('Admin ops rate-limit isolation', () => {
  test.setTimeout(180_000);

  let carId: number;

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    await cleanupReservationsForCar(carId);
    await cleanupTestCar(carId);
  });

  test('50 status writes leave Ops reads, health, and SSE usable', async ({
    adminPage,
    request,
  }) => {
    await cleanupReservationsForCar(carId);

    const reservationIds: number[] = [];
    for (let i = 0; i < BOOKING_COUNT; i += 1) {
      const range = allocateFutureRange({ fromDaysAhead: 180 + i * 7, nights: 2 });
      const seeded = await seedLinkedBooking({
        carId,
        status: 'confirmed',
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
        pickupTime: range.pickupTime,
        returnTime: range.returnTime,
        guest: {
          ...E2E_GUEST,
          email: uniqueEmail(`ops-burst-${i}`),
          fullName: `Ops Burst ${i}`,
        },
      });
      reservationIds.push(seeded.reservationId);
    }

    const unexpected429: string[] = [];
    adminPage.on('response', (res) => {
      if (res.status() === 429) {
        unexpected429.push(res.url());
      }
    });

    await adminPage.goto('/admin/reservations');
    await expect(adminPage.getByRole('heading', { name: 'Reservation Ops' })).toBeVisible({
      timeout: 15_000,
    });
    await waitForAdminLive(adminPage);

    const auth = await loginAsAdmin(request);
    let writeCount = 0;
    for (const reservationId of reservationIds) {
      for (const status of STATUS_WALK) {
        const result = await changeOpsStatusViaApi(request, reservationId, status, auth);
        expect(result.ok, JSON.stringify(result.body)).toBeTruthy();
        expect(result.status).not.toBe(429);
        writeCount += 1;
      }
    }
    expect(writeCount).toBe(BOOKING_COUNT * STATUS_WALK.length);

    await expect(adminPage.getByRole('heading', { name: 'Reservation Ops' })).toBeVisible();
    await adminPage.getByRole('button', { name: 'Refresh' }).click();
    await expect(adminPage.getByRole('heading', { name: 'Reservation Ops' })).toBeVisible();
    await waitForAdminLive(adminPage, 15_000);

    const live = await request.get(`${API_URL}/health/live`);
    expect(live.status()).toBe(200);
    const ready = await request.get(`${API_URL}/ready`);
    expect(ready.status()).toBe(200);

    expect(unexpected429, `unexpected 429s: ${unexpected429.join(', ')}`).toEqual([]);
  });
});
