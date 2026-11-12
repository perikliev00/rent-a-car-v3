// Import named exports from '../fixtures/base'.
import { test, expect } from '../fixtures/base';
// Import named exports from '../helpers/admin-reservations'.
import { changeOpsStatusViaApi } from '../helpers/admin-reservations';
// Import named exports from '../helpers/admin-realtime'.
import { waitForAdminLive } from '../helpers/admin-realtime';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  cleanupE2eCarsByName,
  // Contribute this line to the enclosing declaration or statement.
  cleanupReservationsForCar,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
// Contribute this line to the enclosing declaration or statement.
} from '../helpers/db';
// Import named exports from '../helpers/csrf'.
import { loginAsAdmin } from '../helpers/csrf';
// Import named exports from '../helpers/seed'.
import { seedE2eFixtures, seedLinkedBooking } from '../helpers/seed';
// Import named exports from '../helpers/test-env'.
import { allocateFutureRange, API_URL, E2E_GUEST, uniqueEmail } from '../helpers/test-env';

// Create the car name constant.
const CAR_NAME = `E2E Ops RateLimit ${Date.now()}`;
// Create the status walk constant.
const STATUS_WALK = ['car_prepared', 'picked_up', 'active_rental', 'returned', 'completed'] as const;
// Create the booking count constant.
const BOOKING_COUNT = 10;

// Call test.describe.configure to perform this step.
test.describe.configure({ mode: 'serial' });

// Call test.describe to perform this step.
test.describe('Admin ops rate-limit isolation', () => {
  // Call test.setTimeout to perform this step.
  test.setTimeout(180_000);

  // Contribute this line to the enclosing declaration or statement.
  let carId: number;

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
    await cleanupReservationsForCar(carId);
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carId);
  });

  // Define a single test case and its expectations.
  test('50 status writes leave Ops reads, health, and SSE usable', async ({
    // Contribute this line to the enclosing declaration or statement.
    adminPage,
    // Contribute this line to the enclosing declaration or statement.
    request,
  // Continue the surrounding logic with this statement.
  }) => {
    // Wait until the asynchronous operation resolves.
    await cleanupReservationsForCar(carId);

    // Continue the surrounding logic with this statement.
    const reservationIds: number[] = [];
    // Iterate using the loop initializer, condition, and step.
    for (let i = 0; i < BOOKING_COUNT; i += 1) {
      // Create the range constant.
      const range = allocateFutureRange({ fromDaysAhead: 180 + i * 7, nights: 2 });
      // Create the seeded constant.
      const seeded = await seedLinkedBooking({
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Provide the status field value.
        status: 'confirmed',
        // Provide the pickup date field value.
        pickupDate: range.pickupDate,
        // Provide the return date field value.
        returnDate: range.returnDate,
        // Provide the pickup time field value.
        pickupTime: range.pickupTime,
        // Provide the return time field value.
        returnTime: range.returnTime,
        // Provide the guest field value.
        guest: {
          // Spread E2E_GUEST into the surrounding structure.
          ...E2E_GUEST,
          // Provide the email field value.
          email: uniqueEmail(`ops-burst-${i}`),
          // Provide the full name field value.
          fullName: `Ops Burst ${i}`,
        },
      });
      // Call reservationIds.push to perform this step.
      reservationIds.push(seeded.reservationId);
    }

    // Continue the surrounding logic with this statement.
    const unexpected429: string[] = [];
    // Call adminPage.on to perform this step.
    adminPage.on('response', (res) => {
      // Evaluate the condition and enter the branch when it is true.
      if (res.status() === 429) {
        // Call unexpected429.push to perform this step.
        unexpected429.push(res.url());
      }
    });

    // Wait until the asynchronous operation resolves.
    await adminPage.goto('/admin/reservations');
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByRole('heading', { name: 'Reservation Ops' })).toBeVisible({
      // Provide the timeout field value.
      timeout: 15_000,
    });
    // Wait until the asynchronous operation resolves.
    await waitForAdminLive(adminPage);

    // Create the auth constant.
    const auth = await loginAsAdmin(request);
    // Initialize the mutable write count variable.
    let writeCount = 0;
    // Iterate using the loop initializer, condition, and step.
    for (const reservationId of reservationIds) {
      // Iterate using the loop initializer, condition, and step.
      for (const status of STATUS_WALK) {
        // Create the result constant.
        const result = await changeOpsStatusViaApi(request, reservationId, status, auth);
        // Assert that the value matches the intended expectation.
        expect(result.ok, JSON.stringify(result.body)).toBeTruthy();
        // Assert that the value matches the intended expectation.
        expect(result.status).not.toBe(429);
        // Update writeCount with the right-hand side value.
        writeCount += 1;
      }
    }
    // Assert that the value matches the intended expectation.
    expect(writeCount).toBe(BOOKING_COUNT * STATUS_WALK.length);

    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByRole('heading', { name: 'Reservation Ops' })).toBeVisible();
    // Wait until the asynchronous operation resolves.
    await adminPage.getByRole('button', { name: 'Refresh' }).click();
    // Wait until the asynchronous operation resolves.
    await expect(adminPage.getByRole('heading', { name: 'Reservation Ops' })).toBeVisible();
    // Wait until the asynchronous operation resolves.
    await waitForAdminLive(adminPage, 15_000);

    // Create the live constant.
    const live = await request.get(`${API_URL}/health/live`);
    // Assert that the value matches the intended expectation.
    expect(live.status()).toBe(200);
    // Create the ready constant.
    const ready = await request.get(`${API_URL}/ready`);
    // Assert that the value matches the intended expectation.
    expect(ready.status()).toBe(200);

    // Assert that the value matches the intended expectation.
    expect(unexpected429, `unexpected 429s: ${unexpected429.join(', ')}`).toEqual([]);
  });
});
