// Import named exports from 'pg'.
import { Client } from 'pg';
// Import bcrypt from 'bcrypt'.
import bcrypt from 'bcrypt';
// Import named exports from 'crypto'.
import { createHash, randomBytes } from 'crypto';
// Import named exports from './test-env'.
import { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, E2E_GUEST } from './test-env';
// Import named exports from './dates'.
import { allocateFutureRange, getSofiaIsoDateString, parseSofiaDate } from './dates';

// Export the async withDb function.
export async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  // Create the client constant.
  const client = new Client({ connectionString: DATABASE_URL });
  // Wait until the asynchronous operation resolves.
  await client.connect();
  // Start a try block for operations that may fail.
  try {
    // Return the resulting value to the caller.
    return await fn(client);
  // Contribute this line to the enclosing declaration or statement.
  } finally {
    // Wait until the asynchronous operation resolves.
    await client.end();
  }
}

// Declare the CleanupScope TypeScript type alias.
type CleanupScope =
  // Contribute this line to the enclosing declaration or statement.
  | { kind: 'car'; carId: number; deleteCar: boolean }
  // Contribute this line to the enclosing declaration or statement.
  | { kind: 'reservation'; reservationId: number };

// Define the async function deleteReservationChildren.
async function deleteReservationChildren(
  // Provide the client field value.
  client: Client,
  // Provide the reservation ids sql field value.
  reservationIdsSql: string,
  // Provide the params field value.
  params: unknown[]
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Wait until the asynchronous operation resolves.
  await client.query(
    // Continue the surrounding logic with this statement.
    `DELETE FROM refund_operations WHERE reservation_id IN (${reservationIdsSql})`,
    // Reference the identifier used by the enclosing expression.
    params
  );
  // Wait until the asynchronous operation resolves.
  await client.query(
    // Continue the surrounding logic with this statement.
    `DELETE FROM payment_events WHERE reservation_id IN (${reservationIdsSql})`,
    // Reference the identifier used by the enclosing expression.
    params
  );
  // Wait until the asynchronous operation resolves.
  await client.query(
    // Continue the surrounding logic with this statement.
    `DELETE FROM payment_failures WHERE reservation_id IN (${reservationIdsSql})`,
    // Reference the identifier used by the enclosing expression.
    params
  );
  // Wait until the asynchronous operation resolves.
  await client.query(
    // Continue the surrounding logic with this statement.
    `
    DELETE FROM processed_stripe_events
    WHERE stripe_session_id IN (
      SELECT stripe_session_id FROM reservations
      WHERE id IN (${reservationIdsSql}) AND stripe_session_id IS NOT NULL
    )
    `,
    // Reference the identifier used by the enclosing expression.
    params
  );
  // Wait until the asynchronous operation resolves.
  await client.query(
    // Continue the surrounding logic with this statement.
    `DELETE FROM notifications WHERE reservation_id IN (${reservationIdsSql})`,
    // Reference the identifier used by the enclosing expression.
    params
  );
  // Wait until the asynchronous operation resolves.
  await client.query(
    // Continue the surrounding logic with this statement.
    `DELETE FROM calendar_tasks WHERE reservation_id IN (${reservationIdsSql})`,
    // Reference the identifier used by the enclosing expression.
    params
  );
  // Wait until the asynchronous operation resolves.
  await client.query(
    // Continue the surrounding logic with this statement.
    `DELETE FROM customer_documents WHERE reservation_id IN (${reservationIdsSql})`,
    // Reference the identifier used by the enclosing expression.
    params
  );
  // Wait until the asynchronous operation resolves.
  await client.query(
    // Continue the surrounding logic with this statement.
    `DELETE FROM reservation_cancellation_requests WHERE reservation_id IN (${reservationIdsSql})`,
    // Reference the identifier used by the enclosing expression.
    params
  );
  // Wait until the asynchronous operation resolves.
  await client.query(
    // Continue the surrounding logic with this statement.
    `DELETE FROM car_damage_reports WHERE reservation_id IN (${reservationIdsSql})`,
    // Reference the identifier used by the enclosing expression.
    params
  );
  // Wait until the asynchronous operation resolves.
  await client.query(
    // Continue the surrounding logic with this statement.
    `DELETE FROM reservation_pickup_checklists WHERE reservation_id IN (${reservationIdsSql})`,
    // Reference the identifier used by the enclosing expression.
    params
  );
  // Wait until the asynchronous operation resolves.
  await client.query(
    // Continue the surrounding logic with this statement.
    `DELETE FROM reservation_return_checklists WHERE reservation_id IN (${reservationIdsSql})`,
    // Reference the identifier used by the enclosing expression.
    params
  );
  // Wait until the asynchronous operation resolves.
  await client.query(
    // Continue the surrounding logic with this statement.
    `DELETE FROM reservation_status_history WHERE reservation_id IN (${reservationIdsSql})`,
    // Reference the identifier used by the enclosing expression.
    params
  );
}

// Define the async function runFkSafeCleanup.
async function runFkSafeCleanup(client: Client, scope: CleanupScope): Promise<void> {
  // Evaluate the condition and enter the branch when it is true.
  if (scope.kind === 'reservation') {
    // Destructure object properties into local variables.
    const { reservationId } = scope;
    // Wait until the asynchronous operation resolves.
    await deleteReservationChildren(client, '$1', [reservationId]);
    await client.query(`DELETE FROM notifications WHERE order_id IN (
      SELECT id FROM orders WHERE reservation_id = $1
    )`, [reservationId]);
    // Wait until the asynchronous operation resolves.
    await client.query('DELETE FROM orders WHERE reservation_id = $1', [reservationId]);

    // Create the res constant.
    const res = await client.query(
      // Continue the surrounding logic with this statement.
      'SELECT car_id, pickup_date, return_date FROM reservations WHERE id = $1',
      // Contribute this line to the enclosing declaration or statement.
      [reservationId]
    );
    // Create the row constant.
    const row = res.rows[0];
    // Wait until the asynchronous operation resolves.
    await client.query('DELETE FROM reservations WHERE id = $1', [reservationId]);

    // Evaluate the condition and enter the branch when it is true.
    if (row) {
      // Wait until the asynchronous operation resolves.
      await client.query(
        // Continue the surrounding logic with this statement.
        `
        DELETE FROM car_date_blocks
        WHERE car_id = $1
          AND start_date = $2
          AND end_date = $3
        `,
        // Contribute this line to the enclosing declaration or statement.
        [row.car_id, row.pickup_date, row.return_date]
      );
    }
    // Return control to the caller with the following value.
    return;
  }

  // Destructure object properties into local variables.
  const { carId, deleteCar } = scope;
  // Wait until the asynchronous operation resolves.
  await deleteReservationChildren(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    'SELECT id FROM reservations WHERE car_id = $1',
    // Contribute this line to the enclosing declaration or statement.
    [carId]
  );
  // Wait until the asynchronous operation resolves.
  await client.query(
    `DELETE FROM notifications WHERE order_id IN (SELECT id FROM orders WHERE car_id = $1)
       OR car_id = $1`,
    // Contribute this line to the enclosing declaration or statement.
    [carId]
  );
  // Wait until the asynchronous operation resolves.
  await client.query(`DELETE FROM calendar_tasks WHERE car_id = $1`, [carId]);
  // Wait until the asynchronous operation resolves.
  await client.query('DELETE FROM orders WHERE car_id = $1', [carId]);
  // Wait until the asynchronous operation resolves.
  await client.query('DELETE FROM reservations WHERE car_id = $1', [carId]);
  // Wait until the asynchronous operation resolves.
  await client.query('DELETE FROM car_date_blocks WHERE car_id = $1', [carId]);
  // Evaluate the condition and enter the branch when it is true.
  if (deleteCar) {
    // Wait until the asynchronous operation resolves.
    await client.query('DELETE FROM cars WHERE id = $1', [carId]);
  }
}

// Export the async cleanupReservationsForCar function.
export async function cleanupReservationsForCar(carId: number): Promise<void> {
  // Wait until the asynchronous operation resolves.
  await withDb(async (client) => {
    // Wait until the asynchronous operation resolves.
    await client.query('BEGIN');
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await runFkSafeCleanup(client, { kind: 'car', carId, deleteCar: false });
      // Wait until the asynchronous operation resolves.
      await client.query('COMMIT');
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Wait until the asynchronous operation resolves.
      await client.query('ROLLBACK');
      // Throw an error to stop the current control flow.
      throw err;
    }
  });
}

// Export the async cleanupTestCar function.
export async function cleanupTestCar(carId: number): Promise<void> {
  // Evaluate the condition and enter the branch when it is true.
  if (!carId) return;
  // Wait until the asynchronous operation resolves.
  await withDb(async (client) => {
    // Wait until the asynchronous operation resolves.
    await client.query('BEGIN');
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await runFkSafeCleanup(client, { kind: 'car', carId, deleteCar: true });
      // Wait until the asynchronous operation resolves.
      await client.query('COMMIT');
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Wait until the asynchronous operation resolves.
      await client.query('ROLLBACK');
      // Throw an error to stop the current control flow.
      throw err;
    }
  });
}

// Export the async cleanupReservationGraph function.
export async function cleanupReservationGraph(reservationId: number): Promise<void> {
  // Wait until the asynchronous operation resolves.
  await withDb(async (client) => {
    // Wait until the asynchronous operation resolves.
    await client.query('BEGIN');
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await runFkSafeCleanup(client, { kind: 'reservation', reservationId });
      // Wait until the asynchronous operation resolves.
      await client.query('COMMIT');
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Wait until the asynchronous operation resolves.
      await client.query('ROLLBACK');
      // Throw an error to stop the current control flow.
      throw err;
    }
  });
}

// Export the async cleanupE2eCarsByName function.
export async function cleanupE2eCarsByName(name: string): Promise<void> {
  // Create the ids constant.
  const ids = await withDb(async (client) => {
    // Destructure object properties into local variables.
    const { rows } = await client.query('SELECT id FROM cars WHERE name = $1', [name]);
    // Return the resulting value to the caller.
    return rows.map((row: Record<string, unknown>) => Number(row.id));
  });
  // Iterate using the loop initializer, condition, and step.
  for (const id of ids) {
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(id);
  }
}

// Export the async insertIsolatedTestCar function.
export async function insertIsolatedTestCar(
  // Update name with the right-hand side value.
  name = 'E2E Test Car',
  // Update price with the right-hand side value.
  price = 55,
  // Contribute this line to the enclosing declaration or statement.
  options?: { transmission?: string; fuelType?: string; seats?: number }
// Continue the surrounding logic with this statement.
): Promise<number> {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the result constant.
    const result = await client.query(
      // Continue the surrounding logic with this statement.
      `
      INSERT INTO cars (
        name, image, transmission, price, seats, fuel_type, availability
      )
      VALUES ($1, '/images/test.jpg', $2, $3, $4, $5, TRUE)
      RETURNING id
    `,
      [
        // Contribute this line to the enclosing declaration or statement.
        name,
        // Contribute this line to the enclosing declaration or statement.
        options?.transmission ?? 'Automatic',
        // Contribute this line to the enclosing declaration or statement.
        price,
        // Contribute this line to the enclosing declaration or statement.
        options?.seats ?? 4,
        // Contribute this line to the enclosing declaration or statement.
        options?.fuelType ?? 'Petrol',
      ]
    );
    // Return the resulting value to the caller.
    return Number(result.rows[0].id);
  });
}

// Export the async insertTestAdmin function.
export async function insertTestAdmin(): Promise<void> {
  // Wait until the asynchronous operation resolves.
  await withDb(async (client) => {
    // Create the hashed password constant.
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    // Create the email constant.
    const email = ADMIN_EMAIL.toLowerCase();

    // Create the existing constant.
    const existing = await client.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
    // Contribute this line to the enclosing declaration or statement.
    let userId: number;
    // Evaluate the condition and enter the branch when it is true.
    if (existing.rows.length > 0) {
      // Update userId with the right-hand side value.
      userId = Number(existing.rows[0].id);
      // Wait until the asynchronous operation resolves.
      await client.query(
        // Continue the surrounding logic with this statement.
        `UPDATE users SET password = $2, role = 'admin', updated_at = NOW() WHERE id = $1`,
        // Contribute this line to the enclosing declaration or statement.
        [userId, hashedPassword]
      );
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // Create the inserted constant.
      const inserted = await client.query(
        // Continue the surrounding logic with this statement.
        `INSERT INTO users (email, password, role) VALUES ($1, $2, 'admin') RETURNING id`,
        // Contribute this line to the enclosing declaration or statement.
        [email, hashedPassword]
      );
      // Update userId with the right-hand side value.
      userId = Number(inserted.rows[0].id);
    }

    // Wait until the asynchronous operation resolves.
    await client.query(
      // Continue the surrounding logic with this statement.
      `
      INSERT INTO user_roles (user_id, role_id)
      SELECT $1, r.id
      FROM roles r
      WHERE r.slug = 'owner'
      ON CONFLICT (user_id, role_id) DO NOTHING
      `,
      // Contribute this line to the enclosing declaration or statement.
      [userId]
    );
  });
}

// Export the async getOrderById function.
export async function getOrderById(orderId: number) {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the result constant.
    const result = await client.query(
      // Continue the surrounding logic with this statement.
      `
      SELECT id, car_id, reservation_id, status, email, full_name,
             pickup_date, return_date, pickup_time, return_time,
             total_price, price_snapshot, is_deleted, deleted_at
      FROM orders
      WHERE id = $1
      `,
      // Contribute this line to the enclosing declaration or statement.
      [orderId]
    );
    // Return the resulting value to the caller.
    return result.rows[0] || null;
  });
}

// Export the async setOrderDeletedAt function.
export async function setOrderDeletedAt(orderId: number, deletedAt: Date): Promise<void> {
  // Wait until the asynchronous operation resolves.
  await withDb(async (client) => {
    // Wait until the asynchronous operation resolves.
    await client.query(
      // Continue the surrounding logic with this statement.
      `UPDATE orders SET deleted_at = $2, is_deleted = TRUE, updated_at = NOW() WHERE id = $1`,
      // Contribute this line to the enclosing declaration or statement.
      [orderId, deletedAt]
    );
  });
}

// Export the linked booking status type.
export type LinkedBookingStatus =
  // Contribute this line to the enclosing declaration or statement.
  | 'pending_payment'
  // Contribute this line to the enclosing declaration or statement.
  | 'processing_payment'
  // Contribute this line to the enclosing declaration or statement.
  | 'paid'
  // Contribute this line to the enclosing declaration or statement.
  | 'confirmed'
  // Contribute this line to the enclosing declaration or statement.
  | 'car_prepared'
  // Contribute this line to the enclosing declaration or statement.
  | 'picked_up'
  // Contribute this line to the enclosing declaration or statement.
  | 'active_rental'
  // Contribute this line to the enclosing declaration or statement.
  | 'returned'
  // Contribute this line to the enclosing declaration or statement.
  | 'completed'
  // Contribute this line to the enclosing declaration or statement.
  | 'cancelled'
  // Contribute this line to the enclosing declaration or statement.
  | 'no_show'
  // Contribute this line to the enclosing declaration or statement.
  | 'expired'
  // Contribute this line to the enclosing declaration or statement.
  | 'manual_review'
  // Contribute this line to the enclosing declaration or statement.
  | 'refunded';

// Create the hold seed statuses constant.
const HOLD_SEED_STATUSES = new Set(['pending_payment', 'processing_payment']);

// Export the seed linked booking options type.
export type SeedLinkedBookingOptions = {
  // Provide the car id field value.
  carId: number;
  // Provide the status field value.
  status: LinkedBookingStatus | string;
  // Contribute this line to the enclosing declaration or statement.
  pickupDate?: string;
  // Contribute this line to the enclosing declaration or statement.
  returnDate?: string;
  // Contribute this line to the enclosing declaration or statement.
  pickupTime?: string;
  // Contribute this line to the enclosing declaration or statement.
  returnTime?: string;
  // Contribute this line to the enclosing declaration or statement.
  pickupLocation?: string;
  // Contribute this line to the enclosing declaration or statement.
  returnLocation?: string;
  // Contribute this line to the enclosing declaration or statement.
  rentalDays?: number;
  // Contribute this line to the enclosing declaration or statement.
  totalPrice?: number;
  // Contribute this line to the enclosing declaration or statement.
  deliveryPrice?: number;
  // Contribute this line to the enclosing declaration or statement.
  returnPrice?: number;
  // Contribute this line to the enclosing declaration or statement.
  dayPrice?: number;
  // Contribute this line to the enclosing declaration or statement.
  orderStatus?: 'pending' | 'active' | 'expired' | 'cancelled';
  // Continue the surrounding logic with this statement.
  guest?: Partial<typeof E2E_GUEST>;
  // Contribute this line to the enclosing declaration or statement.
  sessionId?: string;
  // Contribute this line to the enclosing declaration or statement.
  stripeSessionId?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  stripePaymentIntentId?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  holdExpiresAt?: Date;
  // Contribute this line to the enclosing declaration or statement.
  withHistory?: boolean;
  /** When set, reservation (and order if created) are owned by this user. */
  userId?: number | null;
  /** Defaults to false for hold statuses, true otherwise. */
  withOrder?: boolean;
  /** Defaults to false for hold statuses, true otherwise. */
  withBlock?: boolean;
};

// Export the seed linked booking result type.
export type SeedLinkedBookingResult = {
  // Provide the reservation id field value.
  reservationId: number;
  // Provide the order id field value.
  orderId: number | null;
  // Provide the block id field value.
  blockId: number | null;
  // Provide the session id field value.
  sessionId: string;
  // Provide the pickup date field value.
  pickupDate: string;
  // Provide the return date field value.
  returnDate: string;
};

// Define the rentalDaysBetween function.
function rentalDaysBetween(pickupDate: string, returnDate: string): number {
  // Create the start constant.
  const start = parseSofiaDate(pickupDate, '00:00');
  // Create the end constant.
  const end = parseSofiaDate(returnDate, '00:00');
  // Evaluate the condition and enter the branch when it is true.
  if (!start || !end) {
    // Throw an error to stop the current control flow.
    throw new Error(`Invalid Sofia dates for rentalDays: ${pickupDate} → ${returnDate}`);
  }
  // Create the ms constant.
  const ms = end.getTime() - start.getTime();
  // Create the days constant.
  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  // Return the resulting value to the caller.
  return Math.max(1, days);
}

// Export the async insertLinkedBooking function.
export async function insertLinkedBooking(
  // Provide the options field value.
  options: SeedLinkedBookingOptions
// Continue the surrounding logic with this statement.
): Promise<SeedLinkedBookingResult> {
  // Create the range constant.
  const range =
    // Contribute this line to the enclosing declaration or statement.
    options.pickupDate && options.returnDate
      // Contribute this line to the enclosing declaration or statement.
      ? {
          // Provide the pickup date field value.
          pickupDate: options.pickupDate,
          // Provide the return date field value.
          returnDate: options.returnDate,
          // Provide the pickup time field value.
          pickupTime: options.pickupTime ?? '10:00',
          // Provide the return time field value.
          returnTime: options.returnTime ?? '10:00',
        }
      // Continue the surrounding logic with this statement.
      : allocateFutureRange({
          // Provide the pickup time field value.
          pickupTime: options.pickupTime,
          // Provide the return time field value.
          returnTime: options.returnTime,
        });

  // Create the pickup at constant.
  const pickupAt = parseSofiaDate(range.pickupDate, range.pickupTime);
  // Create the return at constant.
  const returnAt = parseSofiaDate(range.returnDate, range.returnTime);
  // Evaluate the condition and enter the branch when it is true.
  if (!pickupAt || !returnAt) {
    // Throw an error to stop the current control flow.
    throw new Error(`Failed to parse Sofia pickup/return for linked booking`);
  }

  // Create the rental days constant.
  const rentalDays = options.rentalDays ?? rentalDaysBetween(range.pickupDate, range.returnDate);
  // Create the day price constant.
  const dayPrice = options.dayPrice ?? 55;
  // Create the total price constant.
  const totalPrice = options.totalPrice ?? dayPrice * rentalDays;
  // Create the delivery price constant.
  const deliveryPrice = options.deliveryPrice ?? 0;
  // Create the return price constant.
  const returnPrice = options.returnPrice ?? 0;
  // Create the guest constant.
  const guest = { ...E2E_GUEST, ...options.guest };
  // Create the session id constant.
  const sessionId = options.sessionId ?? `e2e-linked-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // Create the price snapshot constant.
  const priceSnapshot = {
    // Provide the currency field value.
    currency: 'EUR',
    // Contribute this line to the enclosing declaration or statement.
    rentalDays,
    // Contribute this line to the enclosing declaration or statement.
    dayPrice,
    // Contribute this line to the enclosing declaration or statement.
    totalPrice,
  };
  // Create the with history constant.
  const withHistory = options.withHistory !== false;
  // Create the order status constant.
  const orderStatus = options.orderStatus ?? 'active';
  // Create the hold expires at constant.
  const holdExpiresAt = options.holdExpiresAt ?? new Date(Date.now() + 60 * 60 * 1000);
  // Create the is hold constant.
  const isHold = HOLD_SEED_STATUSES.has(String(options.status));
  // Create the with order constant.
  const withOrder = options.withOrder ?? !isHold;
  // Create the with block constant.
  const withBlock = options.withBlock ?? !isHold;
  // Create the user id constant.
  const userId = options.userId ?? null;

  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Wait until the asynchronous operation resolves.
    await client.query('BEGIN');
    // Start a try block for operations that may fail.
    try {
      // Create the reservation result constant.
      const reservationResult = await client.query(
        // Continue the surrounding logic with this statement.
        `
        INSERT INTO reservations (
          car_id, session_id, user_id,
          pickup_date, pickup_time, return_date, return_time,
          pickup_location, return_location,
          rental_days, delivery_price, return_price, total_price,
          full_name, phone_number, email, address, hotel_name,
          status, hold_expires_at, stripe_session_id, stripe_payment_intent_id, price_snapshot
        )
        VALUES (
          $1, $2, $3,
          $4, $5, $6, $7,
          $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23::jsonb
        )
        RETURNING id
        `,
        [
          // Contribute this line to the enclosing declaration or statement.
          options.carId,
          // Contribute this line to the enclosing declaration or statement.
          sessionId,
          // Contribute this line to the enclosing declaration or statement.
          userId,
          // Contribute this line to the enclosing declaration or statement.
          pickupAt,
          // Contribute this line to the enclosing declaration or statement.
          range.pickupTime,
          // Contribute this line to the enclosing declaration or statement.
          returnAt,
          // Contribute this line to the enclosing declaration or statement.
          range.returnTime,
          // Contribute this line to the enclosing declaration or statement.
          options.pickupLocation || 'office',
          // Contribute this line to the enclosing declaration or statement.
          options.returnLocation || 'office',
          // Contribute this line to the enclosing declaration or statement.
          rentalDays,
          // Contribute this line to the enclosing declaration or statement.
          deliveryPrice,
          // Contribute this line to the enclosing declaration or statement.
          returnPrice,
          // Contribute this line to the enclosing declaration or statement.
          totalPrice,
          // Contribute this line to the enclosing declaration or statement.
          guest.fullName,
          // Contribute this line to the enclosing declaration or statement.
          guest.phoneNumber,
          // Contribute this line to the enclosing declaration or statement.
          guest.email,
          // Contribute this line to the enclosing declaration or statement.
          guest.address,
          // Contribute this line to the enclosing declaration or statement.
          guest.hotelName,
          // Contribute this line to the enclosing declaration or statement.
          options.status,
          // Contribute this line to the enclosing declaration or statement.
          holdExpiresAt,
          // Contribute this line to the enclosing declaration or statement.
          options.stripeSessionId ?? null,
          // Contribute this line to the enclosing declaration or statement.
          options.stripePaymentIntentId ?? null,
          // Call JSON.stringify to perform this step.
          JSON.stringify(priceSnapshot),
        ]
      );
      // Create the reservation id constant.
      const reservationId = Number(reservationResult.rows[0].id);

      // Evaluate the condition and enter the branch when it is true.
      if (withHistory) {
        // Wait until the asynchronous operation resolves.
        await client.query(
          // Continue the surrounding logic with this statement.
          `
          INSERT INTO reservation_status_history (
            reservation_id, old_status, new_status,
            changed_by_system, reason, metadata
          )
          VALUES ($1, NULL, $2, TRUE, $3, $4::jsonb)
          `,
          [
            // Contribute this line to the enclosing declaration or statement.
            reservationId,
            // Contribute this line to the enclosing declaration or statement.
            options.status,
            // Supply the literal value used by the enclosing expression.
            'seed_linked_booking',
            // Call JSON.stringify to perform this step.
            JSON.stringify({ source: 'e2e_seed_linked_booking' }),
          ]
        );
      }

      // Continue the surrounding logic with this statement.
      let orderId: number | null = null;
      // Evaluate the condition and enter the branch when it is true.
      if (withOrder) {
        // Create the order result constant.
        const orderResult = await client.query(
          // Continue the surrounding logic with this statement.
          `
          INSERT INTO orders (
            reservation_id, car_id, user_id,
            pickup_date, pickup_time, return_date, return_time,
            pickup_location, return_location,
            rental_days, delivery_price, return_price, total_price,
            full_name, phone_number, email, address, hotel_name,
            status, price_snapshot
          )
          VALUES (
            $1, $2, $3,
            $4, $5, $6, $7,
            $8, $9,
            $10, $11, $12, $13,
            $14, $15, $16, $17, $18,
            $19, $20::jsonb
          )
          RETURNING id
          `,
          [
            // Contribute this line to the enclosing declaration or statement.
            reservationId,
            // Contribute this line to the enclosing declaration or statement.
            options.carId,
            // Contribute this line to the enclosing declaration or statement.
            userId,
            // Contribute this line to the enclosing declaration or statement.
            pickupAt,
            // Contribute this line to the enclosing declaration or statement.
            range.pickupTime,
            // Contribute this line to the enclosing declaration or statement.
            returnAt,
            // Contribute this line to the enclosing declaration or statement.
            range.returnTime,
            // Contribute this line to the enclosing declaration or statement.
            options.pickupLocation || 'office',
            // Contribute this line to the enclosing declaration or statement.
            options.returnLocation || 'office',
            // Contribute this line to the enclosing declaration or statement.
            rentalDays,
            // Contribute this line to the enclosing declaration or statement.
            deliveryPrice,
            // Contribute this line to the enclosing declaration or statement.
            returnPrice,
            // Contribute this line to the enclosing declaration or statement.
            totalPrice,
            // Contribute this line to the enclosing declaration or statement.
            guest.fullName,
            // Contribute this line to the enclosing declaration or statement.
            guest.phoneNumber,
            // Contribute this line to the enclosing declaration or statement.
            guest.email,
            // Contribute this line to the enclosing declaration or statement.
            guest.address,
            // Contribute this line to the enclosing declaration or statement.
            guest.hotelName,
            // Contribute this line to the enclosing declaration or statement.
            orderStatus,
            // Call JSON.stringify to perform this step.
            JSON.stringify(priceSnapshot),
          ]
        );
        // Update orderId with the right-hand side value.
        orderId = Number(orderResult.rows[0].id);
      }

      // Continue the surrounding logic with this statement.
      let blockId: number | null = null;
      // Evaluate the condition and enter the branch when it is true.
      if (withBlock) {
        // Create the block result constant.
        const blockResult = await client.query(
          // Continue the surrounding logic with this statement.
          `
          INSERT INTO car_date_blocks (car_id, start_date, end_date, block_type)
          VALUES ($1, $2, $3, 'booking')
          RETURNING id
          `,
          // Contribute this line to the enclosing declaration or statement.
          [options.carId, pickupAt, returnAt]
        );
        // Update blockId with the right-hand side value.
        blockId = Number(blockResult.rows[0].id);
      }

      // Wait until the asynchronous operation resolves.
      await client.query('COMMIT');
      // Return the resulting value to the caller.
      return {
        // Contribute this line to the enclosing declaration or statement.
        reservationId,
        // Contribute this line to the enclosing declaration or statement.
        orderId,
        // Contribute this line to the enclosing declaration or statement.
        blockId,
        // Contribute this line to the enclosing declaration or statement.
        sessionId,
        // Provide the pickup date field value.
        pickupDate: range.pickupDate,
        // Provide the return date field value.
        returnDate: range.returnDate,
      };
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Wait until the asynchronous operation resolves.
      await client.query('ROLLBACK');
      // Throw an error to stop the current control flow.
      throw err;
    }
  });
}

// Export the async getReservationByStripeSessionId function.
export async function getReservationByStripeSessionId(stripeSessionId: string) {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the result constant.
    const result = await client.query(
      `SELECT id, car_id, status, stripe_session_id, session_id, total_price, email
       FROM reservations WHERE stripe_session_id = $1`,
      // Contribute this line to the enclosing declaration or statement.
      [stripeSessionId]
    );
    // Return the resulting value to the caller.
    return result.rows[0] || null;
  });
}

// Export the async getReservationById function.
export async function getReservationById(reservationId: number) {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the result constant.
    const result = await client.query(
      `SELECT id, car_id, user_id, status, stripe_session_id, session_id, total_price, email,
              pickup_date, return_date, price_snapshot, flight_number, hotel_name, address,
              special_requests
       FROM reservations WHERE id = $1`,
      // Contribute this line to the enclosing declaration or statement.
      [reservationId]
    );
    // Return the resulting value to the caller.
    return result.rows[0] || null;
  });
}

// Export the async getReservationUserId function.
export async function getReservationUserId(reservationId: number): Promise<number | null> {
  // Create the row constant.
  const row = await getReservationById(reservationId);
  // Evaluate the condition and enter the branch when it is true.
  if (!row || row.user_id == null) return null;
  // Return the resulting value to the caller.
  return Number(row.user_id);
}

// Export the async getPendingCancellationRequest function.
export async function getPendingCancellationRequest(reservationId: number) {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the result constant.
    const result = await client.query(
      // Continue the surrounding logic with this statement.
      `
      SELECT id, reservation_id, user_id, status, reason, created_at
      FROM reservation_cancellation_requests
      WHERE reservation_id = $1 AND status = 'pending'
      ORDER BY id DESC
      LIMIT 1
      `,
      // Contribute this line to the enclosing declaration or statement.
      [reservationId]
    );
    // Return the resulting value to the caller.
    return result.rows[0] || null;
  });
}

// Export the async getLatestCancellationRequest function.
export async function getLatestCancellationRequest(reservationId: number) {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the result constant.
    const result = await client.query(
      // Continue the surrounding logic with this statement.
      `
      SELECT id, reservation_id, user_id, status, reason, created_at
      FROM reservation_cancellation_requests
      WHERE reservation_id = $1
      ORDER BY id DESC
      LIMIT 1
      `,
      // Contribute this line to the enclosing declaration or statement.
      [reservationId]
    );
    // Return the resulting value to the caller.
    return result.rows[0] || null;
  });
}

// Export the async getOrderByGuestEmail function.
export async function getOrderByGuestEmail(email: string) {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the result constant.
    const result = await client.query(
      `SELECT id, car_id, status, email, pickup_date, return_date, reservation_id
       FROM orders WHERE email = $1 AND is_deleted = FALSE
       ORDER BY id DESC LIMIT 1`,
      // Contribute this line to the enclosing declaration or statement.
      [email]
    );
    // Return the resulting value to the caller.
    return result.rows[0] || null;
  });
}

// Export the async getOrderByReservationId function.
export async function getOrderByReservationId(reservationId: number) {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the result constant.
    const result = await client.query(
      // Continue the surrounding logic with this statement.
      `
      SELECT id, car_id, reservation_id, status, stripe_session_id, email, total_price,
             price_snapshot, is_deleted, deleted_at
      FROM orders
      WHERE reservation_id = $1
      ORDER BY id DESC
      LIMIT 1
      `,
      // Contribute this line to the enclosing declaration or statement.
      [reservationId]
    );
    // Return the resulting value to the caller.
    return result.rows[0] || null;
  });
}

// Export the async getRefundOperationByReservationId function.
export async function getRefundOperationByReservationId(reservationId: number) {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the result constant.
    const result = await client.query(
      // Continue the surrounding logic with this statement.
      `
      SELECT id, reservation_id, status, stripe_refund_id, stripe_payment_intent_id,
             amount_cents, idempotency_key
      FROM refund_operations
      WHERE reservation_id = $1
      ORDER BY id DESC
      LIMIT 1
      `,
      // Contribute this line to the enclosing declaration or statement.
      [reservationId]
    );
    // Return the resulting value to the caller.
    return result.rows[0] || null;
  });
}

// Export the async getDateBlocksForCar function.
export async function getDateBlocksForCar(carId: number) {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the result constant.
    const result = await client.query(
      // Continue the surrounding logic with this statement.
      `
      SELECT id, car_id, start_date, end_date, block_type
      FROM car_date_blocks
      WHERE car_id = $1
      ORDER BY start_date
      `,
      // Contribute this line to the enclosing declaration or statement.
      [carId]
    );
    // Return the resulting value to the caller.
    return result.rows;
  });
}

// Export the async getStatusHistory function.
export async function getStatusHistory(reservationId: number) {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the result constant.
    const result = await client.query(
      // Continue the surrounding logic with this statement.
      `
      SELECT id, reservation_id, old_status, new_status, changed_by_system, reason, metadata, created_at
      FROM reservation_status_history
      WHERE reservation_id = $1
      ORDER BY id ASC
      `,
      // Contribute this line to the enclosing declaration or statement.
      [reservationId]
    );
    // Return the resulting value to the caller.
    return result.rows;
  });
}

// Export the async getPaymentEventsForReservation function.
export async function getPaymentEventsForReservation(reservationId: number) {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the result constant.
    const result = await client.query(
      // Continue the surrounding logic with this statement.
      `
      SELECT id, event_id, event_type, stripe_session_id, reservation_id, status, payload, created_at
      FROM payment_events
      WHERE reservation_id = $1
      ORDER BY id ASC
      `,
      // Contribute this line to the enclosing declaration or statement.
      [reservationId]
    );
    // Return the resulting value to the caller.
    return result.rows;
  });
}

// Export the async getPaymentFailuresForReservation function.
export async function getPaymentFailuresForReservation(reservationId: number) {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the result constant.
    const result = await client.query(
      // Continue the surrounding logic with this statement.
      `
      SELECT id, reason, correlation_id, stripe_session_id, reservation_id, event_id, context, resolved, created_at
      FROM payment_failures
      WHERE reservation_id = $1
      ORDER BY id ASC
      `,
      // Contribute this line to the enclosing declaration or statement.
      [reservationId]
    );
    // Return the resulting value to the caller.
    return result.rows;
  });
}

// Export the async countProcessedStripeEvents function.
export async function countProcessedStripeEvents(eventId: string): Promise<number> {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the result constant.
    const result = await client.query(
      // Continue the surrounding logic with this statement.
      'SELECT COUNT(*)::int AS count FROM processed_stripe_events WHERE event_id = $1',
      // Contribute this line to the enclosing declaration or statement.
      [eventId]
    );
    // Return the resulting value to the caller.
    return result.rows[0].count;
  });
}

// Export the async countDateBlocksForCar function.
export async function countDateBlocksForCar(carId: number): Promise<number> {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the result constant.
    const result = await client.query(
      // Continue the surrounding logic with this statement.
      'SELECT COUNT(*)::int AS count FROM car_date_blocks WHERE car_id = $1',
      // Contribute this line to the enclosing declaration or statement.
      [carId]
    );
    // Return the resulting value to the caller.
    return result.rows[0].count;
  });
}

// Export the async getCarStatus function.
export async function getCarStatus(carId: number): Promise<string | null> {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the result constant.
    const result = await client.query('SELECT status FROM cars WHERE id = $1', [carId]);
    // Return the resulting value to the caller.
    return (result.rows[0]?.status as string) ?? null;
  });
}

// Export the async countActiveReservationsForCar function.
export async function countActiveReservationsForCar(carId: number): Promise<number> {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the result constant.
    const result = await client.query(
      // Continue the surrounding logic with this statement.
      `
      SELECT COUNT(*)::int AS count
      FROM reservations
      WHERE car_id = $1
        AND status IN ('pending_payment', 'processing_payment')
        AND hold_expires_at > NOW()
      `,
      // Contribute this line to the enclosing declaration or statement.
      [carId]
    );
    // Return the resulting value to the caller.
    return result.rows[0].count;
  });
}

// Export the async getActiveReservationForCar function.
export async function getActiveReservationForCar(carId: number) {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the result constant.
    const result = await client.query(
      // Continue the surrounding logic with this statement.
      `
      SELECT id, car_id, session_id, status, stripe_session_id, hold_expires_at,
             pickup_date, return_date, total_price, email, hotel_delivery, selected_extras,
             price_snapshot
      FROM reservations
      WHERE car_id = $1
        AND status IN ('pending_payment', 'processing_payment')
        AND hold_expires_at > NOW()
      ORDER BY id DESC
      LIMIT 1
      `,
      // Contribute this line to the enclosing declaration or statement.
      [carId]
    );
    // Return the resulting value to the caller.
    return result.rows[0] || null;
  });
}

// Define the toIsoDate function.
function toIsoDate(value: unknown): string {
  // Evaluate the condition and enter the branch when it is true.
  if (value instanceof Date) {
    // Return the resulting value to the caller.
    return value.toISOString().slice(0, 10);
  }
  // Return the resulting value to the caller.
  return String(value).slice(0, 10);
}

// Export the async assertOrderLinkedToReservation function.
export async function assertOrderLinkedToReservation(
  // Provide the order id field value.
  orderId: number,
  // Provide the reservation id field value.
  reservationId: number
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Create the order constant.
  const order = await withDb(async (client) => {
    // Create the result constant.
    const result = await client.query(
      // Continue the surrounding logic with this statement.
      'SELECT id, reservation_id FROM orders WHERE id = $1',
      // Contribute this line to the enclosing declaration or statement.
      [orderId]
    );
    // Return the resulting value to the caller.
    return result.rows[0] || null;
  });
  // Evaluate the condition and enter the branch when it is true.
  if (!order) {
    // Throw an error to stop the current control flow.
    throw new Error(`assertOrderLinkedToReservation: order ${orderId} not found`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (Number(order.reservation_id) !== Number(reservationId)) {
    // Throw an error to stop the current control flow.
    throw new Error(
      // Continue the surrounding logic with this statement.
      `assertOrderLinkedToReservation: order ${orderId} reservation_id=${order.reservation_id}, expected ${reservationId}`
    );
  }
}

// Export the async assertReservationStatus function.
export async function assertReservationStatus(
  // Provide the reservation id field value.
  reservationId: number,
  // Provide the status field value.
  status: string
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Create the reservation constant.
  const reservation = await getReservationById(reservationId);
  // Evaluate the condition and enter the branch when it is true.
  if (!reservation) {
    // Throw an error to stop the current control flow.
    throw new Error(`assertReservationStatus: reservation ${reservationId} not found`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (reservation.status !== status) {
    // Throw an error to stop the current control flow.
    throw new Error(
      // Continue the surrounding logic with this statement.
      `assertReservationStatus: reservation ${reservationId} status=${reservation.status}, expected ${status}`
    );
  }
}

// Export the async assertStatusHistoryContains function.
export async function assertStatusHistoryContains(
  // Provide the reservation id field value.
  reservationId: number,
  // Provide the new status field value.
  newStatus: string
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Create the history constant.
  const history = await getStatusHistory(reservationId);
  // Create the found constant.
  const found = history.some((row: Record<string, unknown>) => row.new_status === newStatus);
  // Evaluate the condition and enter the branch when it is true.
  if (!found) {
    // Throw an error to stop the current control flow.
    throw new Error(
      // Continue the surrounding logic with this statement.
      `assertStatusHistoryContains: reservation ${reservationId} missing new_status=${newStatus}; got [${history
        // Call .map to perform this step.
        .map((h: Record<string, unknown>) => h.new_status)
        // Call .join to perform this step.
        .join(', ')}]`
    );
  }
}

// Export the async assertStatusHistorySequence function.
export async function assertStatusHistorySequence(
  // Provide the reservation id field value.
  reservationId: number,
  // Provide the statuses field value.
  statuses: string[]
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Create the history constant.
  const history = await getStatusHistory(reservationId);
  // Create the actual constant.
  const actual = history.map((h: Record<string, unknown>) => h.new_status as string);
  // Initialize the mutable i variable.
  let i = 0;
  // Iterate using the loop initializer, condition, and step.
  for (const expected of statuses) {
    // Keep looping while the condition remains true.
    while (i < actual.length && actual[i] !== expected) {
      // Update i with the right-hand side value.
      i += 1;
    }
    // Evaluate the condition and enter the branch when it is true.
    if (i >= actual.length) {
      // Throw an error to stop the current control flow.
      throw new Error(
        // Continue the surrounding logic with this statement.
        `assertStatusHistorySequence: reservation ${reservationId} missing sequence ${statuses.join(
          // Supply the literal value used by the enclosing expression.
          ' → '
        // Continue the surrounding logic with this statement.
        )}; got [${actual.join(', ')}]`
      );
    }
    // Update i with the right-hand side value.
    i += 1;
  }
}

// Define the isDateOnlyString function.
function isDateOnlyString(value: string): boolean {
  // Return the resulting value to the caller.
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

// Export the async assertDateBlockCovers function.
export async function assertDateBlockCovers(
  // Provide the car id field value.
  carId: number,
  // Provide the start field value.
  start: string | Date,
  // Provide the end field value.
  end: string | Date
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Create the blocks constant.
  const blocks = await getDateBlocksForCar(carId);
  // Create the start str constant.
  const startStr = typeof start === 'string' ? start.trim() : null;
  // Create the end str constant.
  const endStr = typeof end === 'string' ? end.trim() : null;
  // Create the date only constant.
  const dateOnly =
    // Continue the surrounding logic with this statement.
    !!startStr && !!endStr && isDateOnlyString(startStr) && isDateOnlyString(endStr);

  // Create the covers constant.
  const covers = blocks.some((block: Record<string, unknown>) => {
    // Evaluate the condition and enter the branch when it is true.
    if (dateOnly) {
      // Create the block start day constant.
      const blockStartDay = getSofiaIsoDateString(new Date(block.start_date as string | Date));
      // Create the block end day constant.
      const blockEndDay = getSofiaIsoDateString(new Date(block.end_date as string | Date));
      // Return the resulting value to the caller.
      return blockStartDay <= startStr! && blockEndDay >= endStr!;
    }

    // Create the start ms constant.
    const startMs =
      // Contribute this line to the enclosing declaration or statement.
      start instanceof Date
        // Continue the surrounding logic with this statement.
        ? start.getTime()
        // Continue the surrounding logic with this statement.
        : (parseSofiaDate(String(start).slice(0, 10), '00:00')?.getTime() ?? Date.parse(String(start)));
    // Create the end ms constant.
    const endMs =
      // Contribute this line to the enclosing declaration or statement.
      end instanceof Date
        // Continue the surrounding logic with this statement.
        ? end.getTime()
        // Continue the surrounding logic with this statement.
        : (parseSofiaDate(String(end).slice(0, 10), '00:00')?.getTime() ?? Date.parse(String(end)));
    // Create the block start constant.
    const blockStart = new Date(block.start_date as string | Date).getTime();
    // Create the block end constant.
    const blockEnd = new Date(block.end_date as string | Date).getTime();
    // Return the resulting value to the caller.
    return blockStart <= startMs && blockEnd >= endMs;
  });

  // Evaluate the condition and enter the branch when it is true.
  if (!covers) {
    // Throw an error to stop the current control flow.
    throw new Error(
      // Continue the surrounding logic with this statement.
      `assertDateBlockCovers: car ${carId} has no block covering ${toIsoDate(start)} → ${toIsoDate(end)}; blocks=${JSON.stringify(
        // Call blocks.map to perform this step.
        blocks.map((b: Record<string, unknown>) => ({
          // Provide the id field value.
          id: b.id,
          // Provide the start field value.
          start: b.start_date,
          // Provide the end field value.
          end: b.end_date,
          // Provide the type field value.
          type: b.block_type,
        }))
      )}`
    );
  }
}

// Export the async assertPriceSnapshotBasics function.
export async function assertPriceSnapshotBasics(reservationId: number): Promise<void> {
  // Create the reservation constant.
  const reservation = await getReservationById(reservationId);
  // Evaluate the condition and enter the branch when it is true.
  if (!reservation) {
    // Throw an error to stop the current control flow.
    throw new Error(`assertPriceSnapshotBasics: reservation ${reservationId} not found`);
  }
  // Create the snapshot constant.
  const snapshot = reservation.price_snapshot;
  // Evaluate the condition and enter the branch when it is true.
  if (!snapshot || typeof snapshot !== 'object') {
    // Throw an error to stop the current control flow.
    throw new Error(`assertPriceSnapshotBasics: reservation ${reservationId} missing price_snapshot`);
  }
  // Create the currency constant.
  const currency = (snapshot as { currency?: string }).currency;
  // Create the total price constant.
  const totalPrice = (snapshot as { totalPrice?: number }).totalPrice;
  // Evaluate the condition and enter the branch when it is true.
  if (!currency) {
    // Throw an error to stop the current control flow.
    throw new Error(`assertPriceSnapshotBasics: reservation ${reservationId} price_snapshot missing currency`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (totalPrice === undefined || totalPrice === null) {
    // Throw an error to stop the current control flow.
    throw new Error(`assertPriceSnapshotBasics: reservation ${reservationId} price_snapshot missing totalPrice`);
  }
}

// Export the async assertReservationTotalPrice function.
export async function assertReservationTotalPrice(
  // Provide the reservation id field value.
  reservationId: number,
  // Provide the expected total field value.
  expectedTotal: number,
  // Update tolerance with the right-hand side value.
  tolerance = 0.01
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Create the reservation constant.
  const reservation = await getReservationById(reservationId);
  // Evaluate the condition and enter the branch when it is true.
  if (!reservation) {
    // Throw an error to stop the current control flow.
    throw new Error(`assertReservationTotalPrice: reservation ${reservationId} not found`);
  }
  // Create the total constant.
  const total = Number(reservation.total_price);
  // Create the snapshot total constant.
  const snapshotTotal = Number(
    // Continue the surrounding logic with this statement.
    (reservation.price_snapshot as { totalPrice?: number } | null)?.totalPrice
  );
  // Evaluate the condition and enter the branch when it is true.
  if (Math.abs(total - expectedTotal) > tolerance) {
    // Throw an error to stop the current control flow.
    throw new Error(
      // Continue the surrounding logic with this statement.
      `assertReservationTotalPrice: total_price=${total}, expected ${expectedTotal}`
    );
  }
  // Evaluate the condition and enter the branch when it is true.
  if (Number.isFinite(snapshotTotal) && Math.abs(snapshotTotal - expectedTotal) > tolerance) {
    // Throw an error to stop the current control flow.
    throw new Error(
      // Continue the surrounding logic with this statement.
      `assertReservationTotalPrice: price_snapshot.totalPrice=${snapshotTotal}, expected ${expectedTotal}`
    );
  }
}

// Export the eurosToStripeCents function.
export function eurosToStripeCents(amount: number): number {
  // Return the resulting value to the caller.
  return Math.round(Number(amount) * 100);
}

// Export the async assertPaymentEventBasics function.
export async function assertPaymentEventBasics(
  // Provide the reservation id field value.
  reservationId: number,
  // Contribute this line to the enclosing declaration or statement.
  expected?: { eventType?: string; status?: string; stripeSessionId?: string }
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Create the events constant.
  const events = await getPaymentEventsForReservation(reservationId);
  // Evaluate the condition and enter the branch when it is true.
  if (events.length === 0) {
    // Throw an error to stop the current control flow.
    throw new Error(`assertPaymentEventBasics: reservation ${reservationId} has no payment_events`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (!expected) return;

  // Create the match constant.
  const match = events.find((event: Record<string, unknown>) => {
    // Evaluate the condition and enter the branch when it is true.
    if (expected.eventType && event.event_type !== expected.eventType) return false;
    // Evaluate the condition and enter the branch when it is true.
    if (expected.status && event.status !== expected.status) return false;
    // Evaluate the condition and enter the branch when it is true.
    if (expected.stripeSessionId && event.stripe_session_id !== expected.stripeSessionId) {
      // Return the resulting value to the caller.
      return false;
    }
    // Return the resulting value to the caller.
    return true;
  });

  // Evaluate the condition and enter the branch when it is true.
  if (!match) {
    // Throw an error to stop the current control flow.
    throw new Error(
      // Continue the surrounding logic with this statement.
      `assertPaymentEventBasics: reservation ${reservationId} no payment_event matching ${JSON.stringify(
        // Reference the identifier used by the enclosing expression.
        expected
      // Continue the surrounding logic with this statement.
      )}; got ${JSON.stringify(events)}`
    );
  }
}

// Export the async assertPaymentFailureBasics function.
export async function assertPaymentFailureBasics(
  // Provide the reservation id field value.
  reservationId: number,
  // Contribute this line to the enclosing declaration or statement.
  expected?: { reason?: string; stripeSessionId?: string }
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Create the failures constant.
  const failures = await getPaymentFailuresForReservation(reservationId);
  // Evaluate the condition and enter the branch when it is true.
  if (failures.length === 0) {
    // Throw an error to stop the current control flow.
    throw new Error(`assertPaymentFailureBasics: reservation ${reservationId} has no payment_failures`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (!expected) return;

  // Create the match constant.
  const match = failures.find((failure: Record<string, unknown>) => {
    // Evaluate the condition and enter the branch when it is true.
    if (expected.reason && failure.reason !== expected.reason) return false;
    // Evaluate the condition and enter the branch when it is true.
    if (expected.stripeSessionId && failure.stripe_session_id !== expected.stripeSessionId) {
      // Return the resulting value to the caller.
      return false;
    }
    // Return the resulting value to the caller.
    return true;
  });

  // Evaluate the condition and enter the branch when it is true.
  if (!match) {
    // Throw an error to stop the current control flow.
    throw new Error(
      // Continue the surrounding logic with this statement.
      `assertPaymentFailureBasics: reservation ${reservationId} no payment_failure matching ${JSON.stringify(
        // Reference the identifier used by the enclosing expression.
        expected
      // Continue the surrounding logic with this statement.
      )}; got ${JSON.stringify(failures)}`
    );
  }
}

/** Set hold_expires_at in the past without changing status (late-webhook setups). */
export async function setHoldExpired(
  // Provide the reservation id field value.
  reservationId: number,
  // Provide the expired at field value.
  expiredAt: Date = new Date('2020-01-01T00:00:00.000Z')
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Wait until the asynchronous operation resolves.
  await withDb(async (client) => {
    // Wait until the asynchronous operation resolves.
    await client.query(
      // Continue the surrounding logic with this statement.
      `
      UPDATE reservations
      SET hold_expires_at = $2, updated_at = NOW()
      WHERE id = $1
      `,
      // Contribute this line to the enclosing declaration or statement.
      [reservationId, expiredAt]
    );
  });
}

/**
 * Expire an abandoned hold the same way cleanup does: past hold_expires_at → status expired.
 * Skips processing_payment rows that still have a stripe_session_id unless force=true.
 */
export async function expireAbandonedHold(
  // Provide the reservation id field value.
  reservationId: number,
  // Contribute this line to the enclosing declaration or statement.
  options?: { force?: boolean }
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Wait until the asynchronous operation resolves.
  await withDb(async (client) => {
    // Wait until the asynchronous operation resolves.
    await client.query('BEGIN');
    // Start a try block for operations that may fail.
    try {
      // Create the current constant.
      const current = await client.query(
        // Continue the surrounding logic with this statement.
        `SELECT id, status, stripe_session_id, hold_expires_at FROM reservations WHERE id = $1 FOR UPDATE`,
        // Contribute this line to the enclosing declaration or statement.
        [reservationId]
      );
      // Create the row constant.
      const row = current.rows[0];
      // Evaluate the condition and enter the branch when it is true.
      if (!row) {
        // Throw an error to stop the current control flow.
        throw new Error(`expireAbandonedHold: reservation ${reservationId} not found`);
      }

      // Create the is processing with stripe constant.
      const isProcessingWithStripe =
        // Update row.status with the right-hand side value.
        row.status === 'processing_payment' && row.stripe_session_id != null;
      // Evaluate the condition and enter the branch when it is true.
      if (isProcessingWithStripe && !options?.force) {
        // Throw an error to stop the current control flow.
        throw new Error(
          // Continue the surrounding logic with this statement.
          `expireAbandonedHold: reservation ${reservationId} is processing_payment with stripe session (use force or setHoldExpired + late webhook)`
        );
      }

      // Wait until the asynchronous operation resolves.
      await client.query(
        // Continue the surrounding logic with this statement.
        `
        UPDATE reservations
        SET status = 'expired',
            hold_expires_at = LEAST(hold_expires_at, NOW()),
            updated_at = NOW()
        WHERE id = $1
        `,
        // Contribute this line to the enclosing declaration or statement.
        [reservationId]
      );
      // Wait until the asynchronous operation resolves.
      await client.query(
        // Continue the surrounding logic with this statement.
        `
        INSERT INTO reservation_status_history (
          reservation_id, old_status, new_status, changed_by_system, reason
        ) VALUES ($1, $2, 'expired', TRUE, 'abandoned_hold')
        `,
        // Contribute this line to the enclosing declaration or statement.
        [reservationId, row.status]
      );
      // Wait until the asynchronous operation resolves.
      await client.query('COMMIT');
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Wait until the asynchronous operation resolves.
      await client.query('ROLLBACK');
      // Throw an error to stop the current control flow.
      throw err;
    }
  });
}

/** Insert a booking date block for Sofia calendar dates (same shape as linked booking seed). */
export async function insertDateBlock(
  // Provide the car id field value.
  carId: number,
  // Provide the start date field value.
  startDate: string,
  // Provide the end date field value.
  endDate: string,
  // Update startTime with the right-hand side value.
  startTime = '10:00',
  // Update endTime with the right-hand side value.
  endTime = '10:00'
// Continue the surrounding logic with this statement.
): Promise<number> {
  // Create the start at constant.
  const startAt = parseSofiaDate(startDate, startTime);
  // Create the end at constant.
  const endAt = parseSofiaDate(endDate, endTime);
  // Evaluate the condition and enter the branch when it is true.
  if (!startAt || !endAt) {
    // Throw an error to stop the current control flow.
    throw new Error(`insertDateBlock: invalid Sofia dates ${startDate} → ${endDate}`);
  }
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the result constant.
    const result = await client.query(
      // Continue the surrounding logic with this statement.
      `
      INSERT INTO car_date_blocks (car_id, start_date, end_date, block_type)
      VALUES ($1, $2, $3, 'booking')
      RETURNING id
      `,
      // Contribute this line to the enclosing declaration or statement.
      [carId, startAt, endAt]
    );
    // Return the resulting value to the caller.
    return Number(result.rows[0].id);
  });
}

// Export the async countOrdersForCar function.
export async function countOrdersForCar(carId: number): Promise<number> {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the result constant.
    const result = await client.query(
      // Continue the surrounding logic with this statement.
      `SELECT COUNT(*)::int AS count FROM orders WHERE car_id = $1 AND COALESCE(is_deleted, FALSE) = FALSE`,
      // Contribute this line to the enclosing declaration or statement.
      [carId]
    );
    // Return the resulting value to the caller.
    return result.rows[0].count;
  });
}

// Export the async countOrdersByGuestEmail function.
export async function countOrdersByGuestEmail(email: string): Promise<number> {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the result constant.
    const result = await client.query(
      // Continue the surrounding logic with this statement.
      `SELECT COUNT(*)::int AS count FROM orders WHERE LOWER(email) = LOWER($1) AND COALESCE(is_deleted, FALSE) = FALSE`,
      // Contribute this line to the enclosing declaration or statement.
      [email]
    );
    // Return the resulting value to the caller.
    return result.rows[0].count;
  });
}

// Export the async deleteDateBlocksForCar function.
export async function deleteDateBlocksForCar(carId: number): Promise<void> {
  // Wait until the asynchronous operation resolves.
  await withDb(async (client) => {
    // Wait until the asynchronous operation resolves.
    await client.query(`DELETE FROM car_date_blocks WHERE car_id = $1`, [carId]);
  });
}

/** Move reservation.created_at into the past (abandoned-checkout reminder age). */
export async function backdateReservationCreatedAt(
  // Provide the reservation id field value.
  reservationId: number,
  // Provide the minutes ago field value.
  minutesAgo: number
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Wait until the asynchronous operation resolves.
  await withDb(async (client) => {
    // Wait until the asynchronous operation resolves.
    await client.query(
      // Continue the surrounding logic with this statement.
      `
      UPDATE reservations
      SET created_at = NOW() - ($2::text || ' minutes')::interval,
          updated_at = NOW()
      WHERE id = $1
      `,
      // Continue the surrounding logic with this statement.
      [reservationId, String(minutesAgo)]
    );
  });
}

// Export the async countNotificationsByType function.
export async function countNotificationsByType(
  // Provide the type field value.
  type: string,
  // Contribute this line to the enclosing declaration or statement.
  options?: { reservationId?: number; status?: string }
// Continue the surrounding logic with this statement.
): Promise<number> {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the clauses constant.
    const clauses = ['type = $1'];
    // Continue the surrounding logic with this statement.
    const params: unknown[] = [type];
    // Evaluate the condition and enter the branch when it is true.
    if (options?.reservationId != null) {
      // Call params.push to perform this step.
      params.push(options.reservationId);
      // Call clauses.push to perform this step.
      clauses.push(`reservation_id = $${params.length}`);
    }
    // Evaluate the condition and enter the branch when it is true.
    if (options?.status) {
      // Call params.push to perform this step.
      params.push(options.status);
      // Call clauses.push to perform this step.
      clauses.push(`status = $${params.length}`);
    }
    // Create the result constant.
    const result = await client.query(
      // Continue the surrounding logic with this statement.
      `SELECT COUNT(*)::int AS count FROM notifications WHERE ${clauses.join(' AND ')}`,
      // Reference the identifier used by the enclosing expression.
      params
    );
    // Return the resulting value to the caller.
    return result.rows[0].count;
  });
}

// Export the async issueEmailVerificationToken function.
export async function issueEmailVerificationToken(email: string): Promise<string> {
  // Create the token constant.
  const token = randomBytes(32).toString('hex');
  // Create the token hash constant.
  const tokenHash = createHash('sha256').update(token, 'utf8').digest('hex');
  // Wait until the asynchronous operation resolves.
  await withDb(async (client) => {
    // Create the result constant.
    const result = await client.query(
      // Continue the surrounding logic with this statement.
      `
      UPDATE users
      SET
        email_verification_token_hash = $2,
        email_verification_expires_at = NOW() + INTERVAL '1 day',
        updated_at = NOW()
      WHERE LOWER(email) = LOWER($1)
      `,
      // Contribute this line to the enclosing declaration or statement.
      [email, tokenHash]
    );
    // Evaluate the condition and enter the branch when it is true.
    if (!result.rowCount) {
      // Throw an error to stop the current control flow.
      throw new Error(`issueEmailVerificationToken: no user for ${email}`);
    }
  });
  // Return the resulting value to the caller.
  return token;
}
