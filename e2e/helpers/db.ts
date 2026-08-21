import { Client } from 'pg';
import bcrypt from 'bcrypt';
import { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, E2E_GUEST } from './test-env';
import { allocateFutureRange, getSofiaIsoDateString, parseSofiaDate } from './dates';

export async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

type CleanupScope =
  | { kind: 'car'; carId: number; deleteCar: boolean }
  | { kind: 'reservation'; reservationId: number };

async function deleteReservationChildren(
  client: Client,
  reservationIdsSql: string,
  params: unknown[]
): Promise<void> {
  await client.query(
    `DELETE FROM payment_events WHERE reservation_id IN (${reservationIdsSql})`,
    params
  );
  await client.query(
    `DELETE FROM payment_failures WHERE reservation_id IN (${reservationIdsSql})`,
    params
  );
  await client.query(
    `
    DELETE FROM processed_stripe_events
    WHERE stripe_session_id IN (
      SELECT stripe_session_id FROM reservations
      WHERE id IN (${reservationIdsSql}) AND stripe_session_id IS NOT NULL
    )
    `,
    params
  );
  await client.query(
    `DELETE FROM notifications WHERE reservation_id IN (${reservationIdsSql})`,
    params
  );
  await client.query(
    `DELETE FROM calendar_tasks WHERE reservation_id IN (${reservationIdsSql})`,
    params
  );
  await client.query(
    `DELETE FROM customer_documents WHERE reservation_id IN (${reservationIdsSql})`,
    params
  );
  await client.query(
    `DELETE FROM reservation_cancellation_requests WHERE reservation_id IN (${reservationIdsSql})`,
    params
  );
  await client.query(
    `DELETE FROM car_damage_reports WHERE reservation_id IN (${reservationIdsSql})`,
    params
  );
  await client.query(
    `DELETE FROM reservation_pickup_checklists WHERE reservation_id IN (${reservationIdsSql})`,
    params
  );
  await client.query(
    `DELETE FROM reservation_return_checklists WHERE reservation_id IN (${reservationIdsSql})`,
    params
  );
  await client.query(
    `DELETE FROM reservation_status_history WHERE reservation_id IN (${reservationIdsSql})`,
    params
  );
}

async function runFkSafeCleanup(client: Client, scope: CleanupScope): Promise<void> {
  if (scope.kind === 'reservation') {
    const { reservationId } = scope;
    await deleteReservationChildren(client, '$1', [reservationId]);
    await client.query(`DELETE FROM notifications WHERE order_id IN (
      SELECT id FROM orders WHERE reservation_id = $1
    )`, [reservationId]);
    await client.query('DELETE FROM orders WHERE reservation_id = $1', [reservationId]);

    const res = await client.query(
      'SELECT car_id, pickup_date, return_date FROM reservations WHERE id = $1',
      [reservationId]
    );
    const row = res.rows[0];
    await client.query('DELETE FROM reservations WHERE id = $1', [reservationId]);

    if (row) {
      await client.query(
        `
        DELETE FROM car_date_blocks
        WHERE car_id = $1
          AND start_date = $2
          AND end_date = $3
        `,
        [row.car_id, row.pickup_date, row.return_date]
      );
    }
    return;
  }

  const { carId, deleteCar } = scope;
  await deleteReservationChildren(
    client,
    'SELECT id FROM reservations WHERE car_id = $1',
    [carId]
  );
  await client.query(
    `DELETE FROM notifications WHERE order_id IN (SELECT id FROM orders WHERE car_id = $1)
       OR car_id = $1`,
    [carId]
  );
  await client.query(`DELETE FROM calendar_tasks WHERE car_id = $1`, [carId]);
  await client.query('DELETE FROM orders WHERE car_id = $1', [carId]);
  await client.query('DELETE FROM reservations WHERE car_id = $1', [carId]);
  await client.query('DELETE FROM car_date_blocks WHERE car_id = $1', [carId]);
  if (deleteCar) {
    await client.query('DELETE FROM cars WHERE id = $1', [carId]);
  }
}

export async function cleanupReservationsForCar(carId: number): Promise<void> {
  await withDb(async (client) => {
    await client.query('BEGIN');
    try {
      await runFkSafeCleanup(client, { kind: 'car', carId, deleteCar: false });
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

export async function cleanupTestCar(carId: number): Promise<void> {
  if (!carId) return;
  await withDb(async (client) => {
    await client.query('BEGIN');
    try {
      await runFkSafeCleanup(client, { kind: 'car', carId, deleteCar: true });
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

export async function cleanupReservationGraph(reservationId: number): Promise<void> {
  await withDb(async (client) => {
    await client.query('BEGIN');
    try {
      await runFkSafeCleanup(client, { kind: 'reservation', reservationId });
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

export async function cleanupE2eCarsByName(name: string): Promise<void> {
  const ids = await withDb(async (client) => {
    const { rows } = await client.query('SELECT id FROM cars WHERE name = $1', [name]);
    return rows.map((row: Record<string, unknown>) => Number(row.id));
  });
  for (const id of ids) {
    await cleanupTestCar(id);
  }
}

export async function insertIsolatedTestCar(
  name = 'E2E Test Car',
  price = 55,
  options?: { transmission?: string; fuelType?: string; seats?: number }
): Promise<number> {
  return withDb(async (client) => {
    const result = await client.query(
      `
      INSERT INTO cars (
        name, image, transmission, price, seats, fuel_type, availability
      )
      VALUES ($1, '/images/test.jpg', $2, $3, $4, $5, TRUE)
      RETURNING id
    `,
      [
        name,
        options?.transmission ?? 'Automatic',
        price,
        options?.seats ?? 4,
        options?.fuelType ?? 'Petrol',
      ]
    );
    return Number(result.rows[0].id);
  });
}

export async function insertTestAdmin(): Promise<void> {
  await withDb(async (client) => {
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const email = ADMIN_EMAIL.toLowerCase();

    const existing = await client.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
    let userId: number;
    if (existing.rows.length > 0) {
      userId = Number(existing.rows[0].id);
      await client.query(
        `UPDATE users SET password = $2, role = 'admin', updated_at = NOW() WHERE id = $1`,
        [userId, hashedPassword]
      );
    } else {
      const inserted = await client.query(
        `INSERT INTO users (email, password, role) VALUES ($1, $2, 'admin') RETURNING id`,
        [email, hashedPassword]
      );
      userId = Number(inserted.rows[0].id);
    }

    await client.query(
      `
      INSERT INTO user_roles (user_id, role_id)
      SELECT $1, r.id
      FROM roles r
      WHERE r.slug = 'owner'
      ON CONFLICT (user_id, role_id) DO NOTHING
      `,
      [userId]
    );
  });
}

export async function getOrderById(orderId: number) {
  return withDb(async (client) => {
    const result = await client.query(
      `
      SELECT id, car_id, reservation_id, status, email, full_name,
             pickup_date, return_date, pickup_time, return_time,
             total_price, price_snapshot, is_deleted, deleted_at
      FROM orders
      WHERE id = $1
      `,
      [orderId]
    );
    return result.rows[0] || null;
  });
}

export async function setOrderDeletedAt(orderId: number, deletedAt: Date): Promise<void> {
  await withDb(async (client) => {
    await client.query(
      `UPDATE orders SET deleted_at = $2, is_deleted = TRUE, updated_at = NOW() WHERE id = $1`,
      [orderId, deletedAt]
    );
  });
}

export type LinkedBookingStatus =
  | 'pending_payment'
  | 'processing_payment'
  | 'paid'
  | 'confirmed'
  | 'car_prepared'
  | 'picked_up'
  | 'active_rental'
  | 'returned'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'expired'
  | 'manual_review'
  | 'refunded';

const HOLD_SEED_STATUSES = new Set(['pending_payment', 'processing_payment']);

export type SeedLinkedBookingOptions = {
  carId: number;
  status: LinkedBookingStatus | string;
  pickupDate?: string;
  returnDate?: string;
  pickupTime?: string;
  returnTime?: string;
  pickupLocation?: string;
  returnLocation?: string;
  rentalDays?: number;
  totalPrice?: number;
  deliveryPrice?: number;
  returnPrice?: number;
  dayPrice?: number;
  orderStatus?: 'pending' | 'active' | 'expired' | 'cancelled';
  guest?: Partial<typeof E2E_GUEST>;
  sessionId?: string;
  stripeSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  holdExpiresAt?: Date;
  withHistory?: boolean;
  /** When set, reservation (and order if created) are owned by this user. */
  userId?: number | null;
  /** Defaults to false for hold statuses, true otherwise. */
  withOrder?: boolean;
  /** Defaults to false for hold statuses, true otherwise. */
  withBlock?: boolean;
};

export type SeedLinkedBookingResult = {
  reservationId: number;
  orderId: number | null;
  blockId: number | null;
  sessionId: string;
  pickupDate: string;
  returnDate: string;
};

function rentalDaysBetween(pickupDate: string, returnDate: string): number {
  const start = parseSofiaDate(pickupDate, '00:00');
  const end = parseSofiaDate(returnDate, '00:00');
  if (!start || !end) {
    throw new Error(`Invalid Sofia dates for rentalDays: ${pickupDate} → ${returnDate}`);
  }
  const ms = end.getTime() - start.getTime();
  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  return Math.max(1, days);
}

export async function insertLinkedBooking(
  options: SeedLinkedBookingOptions
): Promise<SeedLinkedBookingResult> {
  const range =
    options.pickupDate && options.returnDate
      ? {
          pickupDate: options.pickupDate,
          returnDate: options.returnDate,
          pickupTime: options.pickupTime ?? '10:00',
          returnTime: options.returnTime ?? '10:00',
        }
      : allocateFutureRange({
          pickupTime: options.pickupTime,
          returnTime: options.returnTime,
        });

  const pickupAt = parseSofiaDate(range.pickupDate, range.pickupTime);
  const returnAt = parseSofiaDate(range.returnDate, range.returnTime);
  if (!pickupAt || !returnAt) {
    throw new Error(`Failed to parse Sofia pickup/return for linked booking`);
  }

  const rentalDays = options.rentalDays ?? rentalDaysBetween(range.pickupDate, range.returnDate);
  const dayPrice = options.dayPrice ?? 55;
  const totalPrice = options.totalPrice ?? dayPrice * rentalDays;
  const deliveryPrice = options.deliveryPrice ?? 0;
  const returnPrice = options.returnPrice ?? 0;
  const guest = { ...E2E_GUEST, ...options.guest };
  const sessionId = options.sessionId ?? `e2e-linked-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const priceSnapshot = {
    currency: 'EUR',
    rentalDays,
    dayPrice,
    totalPrice,
  };
  const withHistory = options.withHistory !== false;
  const orderStatus = options.orderStatus ?? 'active';
  const holdExpiresAt = options.holdExpiresAt ?? new Date(Date.now() + 60 * 60 * 1000);
  const isHold = HOLD_SEED_STATUSES.has(String(options.status));
  const withOrder = options.withOrder ?? !isHold;
  const withBlock = options.withBlock ?? !isHold;
  const userId = options.userId ?? null;

  return withDb(async (client) => {
    await client.query('BEGIN');
    try {
      const reservationResult = await client.query(
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
          options.carId,
          sessionId,
          userId,
          pickupAt,
          range.pickupTime,
          returnAt,
          range.returnTime,
          options.pickupLocation || 'office',
          options.returnLocation || 'office',
          rentalDays,
          deliveryPrice,
          returnPrice,
          totalPrice,
          guest.fullName,
          guest.phoneNumber,
          guest.email,
          guest.address,
          guest.hotelName,
          options.status,
          holdExpiresAt,
          options.stripeSessionId ?? null,
          options.stripePaymentIntentId ?? null,
          JSON.stringify(priceSnapshot),
        ]
      );
      const reservationId = Number(reservationResult.rows[0].id);

      if (withHistory) {
        await client.query(
          `
          INSERT INTO reservation_status_history (
            reservation_id, old_status, new_status,
            changed_by_system, reason, metadata
          )
          VALUES ($1, NULL, $2, TRUE, $3, $4::jsonb)
          `,
          [
            reservationId,
            options.status,
            'seed_linked_booking',
            JSON.stringify({ source: 'e2e_seed_linked_booking' }),
          ]
        );
      }

      let orderId: number | null = null;
      if (withOrder) {
        const orderResult = await client.query(
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
            reservationId,
            options.carId,
            userId,
            pickupAt,
            range.pickupTime,
            returnAt,
            range.returnTime,
            options.pickupLocation || 'office',
            options.returnLocation || 'office',
            rentalDays,
            deliveryPrice,
            returnPrice,
            totalPrice,
            guest.fullName,
            guest.phoneNumber,
            guest.email,
            guest.address,
            guest.hotelName,
            orderStatus,
            JSON.stringify(priceSnapshot),
          ]
        );
        orderId = Number(orderResult.rows[0].id);
      }

      let blockId: number | null = null;
      if (withBlock) {
        const blockResult = await client.query(
          `
          INSERT INTO car_date_blocks (car_id, start_date, end_date, block_type)
          VALUES ($1, $2, $3, 'booking')
          RETURNING id
          `,
          [options.carId, pickupAt, returnAt]
        );
        blockId = Number(blockResult.rows[0].id);
      }

      await client.query('COMMIT');
      return {
        reservationId,
        orderId,
        blockId,
        sessionId,
        pickupDate: range.pickupDate,
        returnDate: range.returnDate,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

export async function getReservationByStripeSessionId(stripeSessionId: string) {
  return withDb(async (client) => {
    const result = await client.query(
      `SELECT id, car_id, status, stripe_session_id, session_id, total_price, email
       FROM reservations WHERE stripe_session_id = $1`,
      [stripeSessionId]
    );
    return result.rows[0] || null;
  });
}

export async function getReservationById(reservationId: number) {
  return withDb(async (client) => {
    const result = await client.query(
      `SELECT id, car_id, user_id, status, stripe_session_id, session_id, total_price, email,
              pickup_date, return_date, price_snapshot, flight_number, hotel_name, address,
              special_requests
       FROM reservations WHERE id = $1`,
      [reservationId]
    );
    return result.rows[0] || null;
  });
}

export async function getReservationUserId(reservationId: number): Promise<number | null> {
  const row = await getReservationById(reservationId);
  if (!row || row.user_id == null) return null;
  return Number(row.user_id);
}

export async function getPendingCancellationRequest(reservationId: number) {
  return withDb(async (client) => {
    const result = await client.query(
      `
      SELECT id, reservation_id, user_id, status, reason, created_at
      FROM reservation_cancellation_requests
      WHERE reservation_id = $1 AND status = 'pending'
      ORDER BY id DESC
      LIMIT 1
      `,
      [reservationId]
    );
    return result.rows[0] || null;
  });
}

export async function getLatestCancellationRequest(reservationId: number) {
  return withDb(async (client) => {
    const result = await client.query(
      `
      SELECT id, reservation_id, user_id, status, reason, created_at
      FROM reservation_cancellation_requests
      WHERE reservation_id = $1
      ORDER BY id DESC
      LIMIT 1
      `,
      [reservationId]
    );
    return result.rows[0] || null;
  });
}

export async function getOrderByGuestEmail(email: string) {
  return withDb(async (client) => {
    const result = await client.query(
      `SELECT id, car_id, status, email, pickup_date, return_date, reservation_id
       FROM orders WHERE email = $1 AND is_deleted = FALSE
       ORDER BY id DESC LIMIT 1`,
      [email]
    );
    return result.rows[0] || null;
  });
}

export async function getOrderByReservationId(reservationId: number) {
  return withDb(async (client) => {
    const result = await client.query(
      `
      SELECT id, car_id, reservation_id, status, stripe_session_id, email, total_price,
             price_snapshot, is_deleted, deleted_at
      FROM orders
      WHERE reservation_id = $1
      ORDER BY id DESC
      LIMIT 1
      `,
      [reservationId]
    );
    return result.rows[0] || null;
  });
}

export async function getRefundOperationByReservationId(reservationId: number) {
  return withDb(async (client) => {
    const result = await client.query(
      `
      SELECT id, reservation_id, status, stripe_refund_id, stripe_payment_intent_id,
             amount_cents, idempotency_key
      FROM refund_operations
      WHERE reservation_id = $1
      ORDER BY id DESC
      LIMIT 1
      `,
      [reservationId]
    );
    return result.rows[0] || null;
  });
}

export async function getDateBlocksForCar(carId: number) {
  return withDb(async (client) => {
    const result = await client.query(
      `
      SELECT id, car_id, start_date, end_date, block_type
      FROM car_date_blocks
      WHERE car_id = $1
      ORDER BY start_date
      `,
      [carId]
    );
    return result.rows;
  });
}

export async function getStatusHistory(reservationId: number) {
  return withDb(async (client) => {
    const result = await client.query(
      `
      SELECT id, reservation_id, old_status, new_status, changed_by_system, reason, metadata, created_at
      FROM reservation_status_history
      WHERE reservation_id = $1
      ORDER BY id ASC
      `,
      [reservationId]
    );
    return result.rows;
  });
}

export async function getPaymentEventsForReservation(reservationId: number) {
  return withDb(async (client) => {
    const result = await client.query(
      `
      SELECT id, event_id, event_type, stripe_session_id, reservation_id, status, payload, created_at
      FROM payment_events
      WHERE reservation_id = $1
      ORDER BY id ASC
      `,
      [reservationId]
    );
    return result.rows;
  });
}

export async function getPaymentFailuresForReservation(reservationId: number) {
  return withDb(async (client) => {
    const result = await client.query(
      `
      SELECT id, reason, correlation_id, stripe_session_id, reservation_id, event_id, context, resolved, created_at
      FROM payment_failures
      WHERE reservation_id = $1
      ORDER BY id ASC
      `,
      [reservationId]
    );
    return result.rows;
  });
}

export async function countProcessedStripeEvents(eventId: string): Promise<number> {
  return withDb(async (client) => {
    const result = await client.query(
      'SELECT COUNT(*)::int AS count FROM processed_stripe_events WHERE event_id = $1',
      [eventId]
    );
    return result.rows[0].count;
  });
}

export async function countDateBlocksForCar(carId: number): Promise<number> {
  return withDb(async (client) => {
    const result = await client.query(
      'SELECT COUNT(*)::int AS count FROM car_date_blocks WHERE car_id = $1',
      [carId]
    );
    return result.rows[0].count;
  });
}

export async function getCarStatus(carId: number): Promise<string | null> {
  return withDb(async (client) => {
    const result = await client.query('SELECT status FROM cars WHERE id = $1', [carId]);
    return (result.rows[0]?.status as string) ?? null;
  });
}

export async function countActiveReservationsForCar(carId: number): Promise<number> {
  return withDb(async (client) => {
    const result = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM reservations
      WHERE car_id = $1
        AND status IN ('pending_payment', 'processing_payment')
        AND hold_expires_at > NOW()
      `,
      [carId]
    );
    return result.rows[0].count;
  });
}

export async function getActiveReservationForCar(carId: number) {
  return withDb(async (client) => {
    const result = await client.query(
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
      [carId]
    );
    return result.rows[0] || null;
  });
}

function toIsoDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

export async function assertOrderLinkedToReservation(
  orderId: number,
  reservationId: number
): Promise<void> {
  const order = await withDb(async (client) => {
    const result = await client.query(
      'SELECT id, reservation_id FROM orders WHERE id = $1',
      [orderId]
    );
    return result.rows[0] || null;
  });
  if (!order) {
    throw new Error(`assertOrderLinkedToReservation: order ${orderId} not found`);
  }
  if (Number(order.reservation_id) !== Number(reservationId)) {
    throw new Error(
      `assertOrderLinkedToReservation: order ${orderId} reservation_id=${order.reservation_id}, expected ${reservationId}`
    );
  }
}

export async function assertReservationStatus(
  reservationId: number,
  status: string
): Promise<void> {
  const reservation = await getReservationById(reservationId);
  if (!reservation) {
    throw new Error(`assertReservationStatus: reservation ${reservationId} not found`);
  }
  if (reservation.status !== status) {
    throw new Error(
      `assertReservationStatus: reservation ${reservationId} status=${reservation.status}, expected ${status}`
    );
  }
}

export async function assertStatusHistoryContains(
  reservationId: number,
  newStatus: string
): Promise<void> {
  const history = await getStatusHistory(reservationId);
  const found = history.some((row: Record<string, unknown>) => row.new_status === newStatus);
  if (!found) {
    throw new Error(
      `assertStatusHistoryContains: reservation ${reservationId} missing new_status=${newStatus}; got [${history
        .map((h: Record<string, unknown>) => h.new_status)
        .join(', ')}]`
    );
  }
}

export async function assertStatusHistorySequence(
  reservationId: number,
  statuses: string[]
): Promise<void> {
  const history = await getStatusHistory(reservationId);
  const actual = history.map((h: Record<string, unknown>) => h.new_status as string);
  let i = 0;
  for (const expected of statuses) {
    while (i < actual.length && actual[i] !== expected) {
      i += 1;
    }
    if (i >= actual.length) {
      throw new Error(
        `assertStatusHistorySequence: reservation ${reservationId} missing sequence ${statuses.join(
          ' → '
        )}; got [${actual.join(', ')}]`
      );
    }
    i += 1;
  }
}

function isDateOnlyString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export async function assertDateBlockCovers(
  carId: number,
  start: string | Date,
  end: string | Date
): Promise<void> {
  const blocks = await getDateBlocksForCar(carId);
  const startStr = typeof start === 'string' ? start.trim() : null;
  const endStr = typeof end === 'string' ? end.trim() : null;
  const dateOnly =
    !!startStr && !!endStr && isDateOnlyString(startStr) && isDateOnlyString(endStr);

  const covers = blocks.some((block: Record<string, unknown>) => {
    if (dateOnly) {
      const blockStartDay = getSofiaIsoDateString(new Date(block.start_date as string | Date));
      const blockEndDay = getSofiaIsoDateString(new Date(block.end_date as string | Date));
      return blockStartDay <= startStr! && blockEndDay >= endStr!;
    }

    const startMs =
      start instanceof Date
        ? start.getTime()
        : (parseSofiaDate(String(start).slice(0, 10), '00:00')?.getTime() ?? Date.parse(String(start)));
    const endMs =
      end instanceof Date
        ? end.getTime()
        : (parseSofiaDate(String(end).slice(0, 10), '00:00')?.getTime() ?? Date.parse(String(end)));
    const blockStart = new Date(block.start_date as string | Date).getTime();
    const blockEnd = new Date(block.end_date as string | Date).getTime();
    return blockStart <= startMs && blockEnd >= endMs;
  });

  if (!covers) {
    throw new Error(
      `assertDateBlockCovers: car ${carId} has no block covering ${toIsoDate(start)} → ${toIsoDate(end)}; blocks=${JSON.stringify(
        blocks.map((b: Record<string, unknown>) => ({
          id: b.id,
          start: b.start_date,
          end: b.end_date,
          type: b.block_type,
        }))
      )}`
    );
  }
}

export async function assertPriceSnapshotBasics(reservationId: number): Promise<void> {
  const reservation = await getReservationById(reservationId);
  if (!reservation) {
    throw new Error(`assertPriceSnapshotBasics: reservation ${reservationId} not found`);
  }
  const snapshot = reservation.price_snapshot;
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error(`assertPriceSnapshotBasics: reservation ${reservationId} missing price_snapshot`);
  }
  const currency = (snapshot as { currency?: string }).currency;
  const totalPrice = (snapshot as { totalPrice?: number }).totalPrice;
  if (!currency) {
    throw new Error(`assertPriceSnapshotBasics: reservation ${reservationId} price_snapshot missing currency`);
  }
  if (totalPrice === undefined || totalPrice === null) {
    throw new Error(`assertPriceSnapshotBasics: reservation ${reservationId} price_snapshot missing totalPrice`);
  }
}

export async function assertReservationTotalPrice(
  reservationId: number,
  expectedTotal: number,
  tolerance = 0.01
): Promise<void> {
  const reservation = await getReservationById(reservationId);
  if (!reservation) {
    throw new Error(`assertReservationTotalPrice: reservation ${reservationId} not found`);
  }
  const total = Number(reservation.total_price);
  const snapshotTotal = Number(
    (reservation.price_snapshot as { totalPrice?: number } | null)?.totalPrice
  );
  if (Math.abs(total - expectedTotal) > tolerance) {
    throw new Error(
      `assertReservationTotalPrice: total_price=${total}, expected ${expectedTotal}`
    );
  }
  if (Number.isFinite(snapshotTotal) && Math.abs(snapshotTotal - expectedTotal) > tolerance) {
    throw new Error(
      `assertReservationTotalPrice: price_snapshot.totalPrice=${snapshotTotal}, expected ${expectedTotal}`
    );
  }
}

export function eurosToStripeCents(amount: number): number {
  return Math.round(Number(amount) * 100);
}

export async function assertPaymentEventBasics(
  reservationId: number,
  expected?: { eventType?: string; status?: string; stripeSessionId?: string }
): Promise<void> {
  const events = await getPaymentEventsForReservation(reservationId);
  if (events.length === 0) {
    throw new Error(`assertPaymentEventBasics: reservation ${reservationId} has no payment_events`);
  }
  if (!expected) return;

  const match = events.find((event: Record<string, unknown>) => {
    if (expected.eventType && event.event_type !== expected.eventType) return false;
    if (expected.status && event.status !== expected.status) return false;
    if (expected.stripeSessionId && event.stripe_session_id !== expected.stripeSessionId) {
      return false;
    }
    return true;
  });

  if (!match) {
    throw new Error(
      `assertPaymentEventBasics: reservation ${reservationId} no payment_event matching ${JSON.stringify(
        expected
      )}; got ${JSON.stringify(events)}`
    );
  }
}

export async function assertPaymentFailureBasics(
  reservationId: number,
  expected?: { reason?: string; stripeSessionId?: string }
): Promise<void> {
  const failures = await getPaymentFailuresForReservation(reservationId);
  if (failures.length === 0) {
    throw new Error(`assertPaymentFailureBasics: reservation ${reservationId} has no payment_failures`);
  }
  if (!expected) return;

  const match = failures.find((failure: Record<string, unknown>) => {
    if (expected.reason && failure.reason !== expected.reason) return false;
    if (expected.stripeSessionId && failure.stripe_session_id !== expected.stripeSessionId) {
      return false;
    }
    return true;
  });

  if (!match) {
    throw new Error(
      `assertPaymentFailureBasics: reservation ${reservationId} no payment_failure matching ${JSON.stringify(
        expected
      )}; got ${JSON.stringify(failures)}`
    );
  }
}

/** Set hold_expires_at in the past without changing status (late-webhook setups). */
export async function setHoldExpired(
  reservationId: number,
  expiredAt: Date = new Date('2020-01-01T00:00:00.000Z')
): Promise<void> {
  await withDb(async (client) => {
    await client.query(
      `
      UPDATE reservations
      SET hold_expires_at = $2, updated_at = NOW()
      WHERE id = $1
      `,
      [reservationId, expiredAt]
    );
  });
}

/**
 * Expire an abandoned hold the same way cleanup does: past hold_expires_at → status expired.
 * Skips processing_payment rows that still have a stripe_session_id unless force=true.
 */
export async function expireAbandonedHold(
  reservationId: number,
  options?: { force?: boolean }
): Promise<void> {
  await withDb(async (client) => {
    await client.query('BEGIN');
    try {
      const current = await client.query(
        `SELECT id, status, stripe_session_id, hold_expires_at FROM reservations WHERE id = $1 FOR UPDATE`,
        [reservationId]
      );
      const row = current.rows[0];
      if (!row) {
        throw new Error(`expireAbandonedHold: reservation ${reservationId} not found`);
      }

      const isProcessingWithStripe =
        row.status === 'processing_payment' && row.stripe_session_id != null;
      if (isProcessingWithStripe && !options?.force) {
        throw new Error(
          `expireAbandonedHold: reservation ${reservationId} is processing_payment with stripe session (use force or setHoldExpired + late webhook)`
        );
      }

      await client.query(
        `
        UPDATE reservations
        SET status = 'expired',
            hold_expires_at = LEAST(hold_expires_at, NOW()),
            updated_at = NOW()
        WHERE id = $1
        `,
        [reservationId]
      );
      await client.query(
        `
        INSERT INTO reservation_status_history (
          reservation_id, old_status, new_status, changed_by_system, reason
        ) VALUES ($1, $2, 'expired', TRUE, 'abandoned_hold')
        `,
        [reservationId, row.status]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

/** Insert a booking date block for Sofia calendar dates (same shape as linked booking seed). */
export async function insertDateBlock(
  carId: number,
  startDate: string,
  endDate: string,
  startTime = '10:00',
  endTime = '10:00'
): Promise<number> {
  const startAt = parseSofiaDate(startDate, startTime);
  const endAt = parseSofiaDate(endDate, endTime);
  if (!startAt || !endAt) {
    throw new Error(`insertDateBlock: invalid Sofia dates ${startDate} → ${endDate}`);
  }
  return withDb(async (client) => {
    const result = await client.query(
      `
      INSERT INTO car_date_blocks (car_id, start_date, end_date, block_type)
      VALUES ($1, $2, $3, 'booking')
      RETURNING id
      `,
      [carId, startAt, endAt]
    );
    return Number(result.rows[0].id);
  });
}

export async function countOrdersForCar(carId: number): Promise<number> {
  return withDb(async (client) => {
    const result = await client.query(
      `SELECT COUNT(*)::int AS count FROM orders WHERE car_id = $1 AND COALESCE(is_deleted, FALSE) = FALSE`,
      [carId]
    );
    return result.rows[0].count;
  });
}

export async function countOrdersByGuestEmail(email: string): Promise<number> {
  return withDb(async (client) => {
    const result = await client.query(
      `SELECT COUNT(*)::int AS count FROM orders WHERE LOWER(email) = LOWER($1) AND COALESCE(is_deleted, FALSE) = FALSE`,
      [email]
    );
    return result.rows[0].count;
  });
}

export async function deleteDateBlocksForCar(carId: number): Promise<void> {
  await withDb(async (client) => {
    await client.query(`DELETE FROM car_date_blocks WHERE car_id = $1`, [carId]);
  });
}

/** Move reservation.created_at into the past (abandoned-checkout reminder age). */
export async function backdateReservationCreatedAt(
  reservationId: number,
  minutesAgo: number
): Promise<void> {
  await withDb(async (client) => {
    await client.query(
      `
      UPDATE reservations
      SET created_at = NOW() - ($2::text || ' minutes')::interval,
          updated_at = NOW()
      WHERE id = $1
      `,
      [reservationId, String(minutesAgo)]
    );
  });
}

export async function countNotificationsByType(
  type: string,
  options?: { reservationId?: number; status?: string }
): Promise<number> {
  return withDb(async (client) => {
    const clauses = ['type = $1'];
    const params: unknown[] = [type];
    if (options?.reservationId != null) {
      params.push(options.reservationId);
      clauses.push(`reservation_id = $${params.length}`);
    }
    if (options?.status) {
      params.push(options.status);
      clauses.push(`status = $${params.length}`);
    }
    const result = await client.query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE ${clauses.join(' AND ')}`,
      params
    );
    return result.rows[0].count;
  });
}
