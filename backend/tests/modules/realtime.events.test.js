// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  LIVE_EVENT_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  mapStatusChangeToEvents,
  // Contribute this line to the enclosing declaration or statement.
  buildLiveEvent,
  // Contribute this line to the enclosing declaration or statement.
  buildNewBookingEvent,
  // Contribute this line to the enclosing declaration or statement.
  buildPaymentFailedEvent,
  // Contribute this line to the enclosing declaration or statement.
  buildCalendarUpdatedEvent,
// Continue the surrounding logic with this statement.
} = require('../../src/modules/realtime/realtime.events');

// Declare a test suite grouping related cases.
describe('realtime.events', () => {
  // Define a single test case and its expectations.
  test('exposes all live event types including quiet refresh types', () => {
    // Assert that the value matches the intended expectation.
    expect(LIVE_EVENT_TYPES).toEqual([
      // Supply the literal value used by the enclosing expression.
      'new_booking',
      // Supply the literal value used by the enclosing expression.
      'payment_succeeded',
      // Supply the literal value used by the enclosing expression.
      'payment_failed',
      // Supply the literal value used by the enclosing expression.
      'reservation_confirmed',
      // Supply the literal value used by the enclosing expression.
      'car_returned',
      // Supply the literal value used by the enclosing expression.
      'manual_review_needed',
      // Supply the literal value used by the enclosing expression.
      'paid_but_not_confirmed',
      // Supply the literal value used by the enclosing expression.
      'reservation_updated',
      // Supply the literal value used by the enclosing expression.
      'calendar_updated',
    ]);
  });

  // Define a single test case and its expectations.
  test('entering paid emits payment_succeeded and paid_but_not_confirmed', () => {
    // Create the events constant.
    const events = mapStatusChangeToEvents({
      // Provide the reservation id field value.
      reservationId: '10',
      // Provide the old status field value.
      oldStatus: 'processing_payment',
      // Provide the new status field value.
      newStatus: 'paid',
      // Provide the reason field value.
      reason: 'stripe_payment_received',
      // Provide the reservation field value.
      reservation: {
        // Provide the id field value.
        id: '10',
        // Provide the full name field value.
        fullName: 'Ada Lovelace',
        // Provide the car id field value.
        carId: { id: '3', name: 'BMW 3' },
        // Provide the status field value.
        status: 'paid',
      },
    });

    // Assert that the value matches the intended expectation.
    expect(events.map((e) => e.type)).toEqual([
      // Supply the literal value used by the enclosing expression.
      'payment_succeeded',
      // Supply the literal value used by the enclosing expression.
      'paid_but_not_confirmed',
    ]);
    // Assert that the value matches the intended expectation.
    expect(events[0].reservationId).toBe('10');
    // Assert that the value matches the intended expectation.
    expect(events[0].carName).toBe('BMW 3');
    // Assert that the value matches the intended expectation.
    expect(events[0].customerName).toBe('Ada Lovelace');
    // Assert that the value matches the intended expectation.
    expect(events[0].oldStatus).toBe('processing_payment');
    // Assert that the value matches the intended expectation.
    expect(events[0].status).toBe('paid');
    // Assert that the value matches the intended expectation.
    expect(events[0].message).toContain('Payment succeeded');
  });

  // Define a single test case and its expectations.
  test('maps confirmed, returned, manual_review, expired', () => {
    // Assert that the value matches the intended expectation.
    expect(mapStatusChangeToEvents({ newStatus: 'confirmed' })[0].type).toBe(
      // Supply the literal value used by the enclosing expression.
      'reservation_confirmed'
    );
    // Assert that the value matches the intended expectation.
    expect(mapStatusChangeToEvents({ newStatus: 'returned' })[0].type).toBe('car_returned');
    // Assert that the value matches the intended expectation.
    expect(mapStatusChangeToEvents({ newStatus: 'manual_review' })[0].type).toBe(
      // Supply the literal value used by the enclosing expression.
      'manual_review_needed'
    );
    // Assert that the value matches the intended expectation.
    expect(mapStatusChangeToEvents({ newStatus: 'expired' })[0].type).toBe('payment_failed');
  });

  // Define a single test case and its expectations.
  test('unmapped status changes emit reservation_updated only', () => {
    // Assert that the value matches the intended expectation.
    expect(
      // Call mapStatusChangeToEvents to perform this step.
      mapStatusChangeToEvents({
        // Provide the reservation id field value.
        reservationId: '8',
        // Provide the old status field value.
        oldStatus: 'confirmed',
        // Provide the new status field value.
        newStatus: 'picked_up',
      // Continue the surrounding logic with this statement.
      }).map((e) => e.type)
    // Continue the surrounding logic with this statement.
    ).toEqual(['reservation_updated']);

    // Assert that the value matches the intended expectation.
    expect(
      // Call mapStatusChangeToEvents to perform this step.
      mapStatusChangeToEvents({
        // Provide the reservation id field value.
        reservationId: '8',
        // Provide the old status field value.
        oldStatus: 'confirmed',
        // Provide the new status field value.
        newStatus: 'cancelled',
      // Continue the surrounding logic with this statement.
      })[0].type
    // Continue the surrounding logic with this statement.
    ).toBe('reservation_updated');

    // Assert that the value matches the intended expectation.
    expect(
      // Call mapStatusChangeToEvents to perform this step.
      mapStatusChangeToEvents({
        // Provide the reservation id field value.
        reservationId: '8',
        // Provide the old status field value.
        oldStatus: 'confirmed',
        // Provide the new status field value.
        newStatus: 'car_prepared',
      // Continue the surrounding logic with this statement.
      })[0].type
    // Continue the surrounding logic with this statement.
    ).toBe('reservation_updated');
  });

  // Define a single test case and its expectations.
  test('confirmed stays high-signal only (no reservation_updated duplicate)', () => {
    // Create the events constant.
    const events = mapStatusChangeToEvents({
      // Provide the old status field value.
      oldStatus: 'paid',
      // Provide the new status field value.
      newStatus: 'confirmed',
    });
    // Assert that the value matches the intended expectation.
    expect(events.map((e) => e.type)).toEqual(['reservation_confirmed']);
  });

  // Define a single test case and its expectations.
  test('same-status unmapped change emits nothing', () => {
    // Assert that the value matches the intended expectation.
    expect(
      // Call mapStatusChangeToEvents to perform this step.
      mapStatusChangeToEvents({
        // Provide the old status field value.
        oldStatus: 'picked_up',
        // Provide the new status field value.
        newStatus: 'picked_up',
      })
    // Continue the surrounding logic with this statement.
    ).toEqual([]);
  });

  // Define a single test case and its expectations.
  test('buildNewBookingEvent and buildPaymentFailedEvent produce required fields', () => {
    // Create the booking constant.
    const booking = buildNewBookingEvent({
      // Provide the order field value.
      order: { id: '5', fullName: 'Test', reservationId: '9', carId: 2 },
      // Provide the reservation field value.
      reservation: { id: '9', status: 'confirmed' },
      // Provide the car name field value.
      carName: 'Audi A4',
    });
    // Assert that the value matches the intended expectation.
    expect(booking.type).toBe('new_booking');
    // Assert that the value matches the intended expectation.
    expect(booking.id).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(booking.occurredAt).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(booking.orderId).toBe('5');
    // Assert that the value matches the intended expectation.
    expect(booking.carName).toBe('Audi A4');

    // Create the failed constant.
    const failed = buildPaymentFailedEvent({
      // Provide the reservation id field value.
      reservationId: '9',
      // Provide the reason field value.
      reason: 'card_declined',
    });
    // Assert that the value matches the intended expectation.
    expect(failed.type).toBe('payment_failed');
    // Assert that the value matches the intended expectation.
    expect(failed.meta.reason).toBe('card_declined');
  });

  // Define a single test case and its expectations.
  test('buildCalendarUpdatedEvent includes action meta', () => {
    // Create the event constant.
    const event = buildCalendarUpdatedEvent({
      // Provide the action field value.
      action: 'block_created',
      // Provide the entity type field value.
      entityType: 'car_date_block',
      // Provide the entity id field value.
      entityId: '12',
    });
    // Assert that the value matches the intended expectation.
    expect(event.type).toBe('calendar_updated');
    // Assert that the value matches the intended expectation.
    expect(event.meta.action).toBe('block_created');
    // Assert that the value matches the intended expectation.
    expect(event.meta.entityId).toBe('12');
  });

  // Define a single test case and its expectations.
  test('buildLiveEvent rejects unknown types', () => {
    // Assert that the value matches the intended expectation.
    expect(() => buildLiveEvent('not_a_real_type')).toThrow(/Unknown live event type/);
  });
});
