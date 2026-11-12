const {
  LIVE_EVENT_TYPES,
  mapStatusChangeToEvents,
  buildLiveEvent,
  buildNewBookingEvent,
  buildPaymentFailedEvent,
  buildCalendarUpdatedEvent,
} = require('../../src/modules/realtime/realtime.events');

describe('realtime.events', () => {
  test('exposes all live event types including quiet refresh types', () => {
    expect(LIVE_EVENT_TYPES).toEqual([
      'new_booking',
      'payment_succeeded',
      'payment_failed',
      'reservation_confirmed',
      'car_returned',
      'manual_review_needed',
      'paid_but_not_confirmed',
      'reservation_updated',
      'calendar_updated',
    ]);
  });

  test('entering paid emits payment_succeeded and paid_but_not_confirmed', () => {
    const events = mapStatusChangeToEvents({
      reservationId: '10',
      oldStatus: 'processing_payment',
      newStatus: 'paid',
      reason: 'stripe_payment_received',
      reservation: {
        id: '10',
        fullName: 'Ada Lovelace',
        carId: { id: '3', name: 'BMW 3' },
        status: 'paid',
      },
    });

    expect(events.map((e) => e.type)).toEqual([
      'payment_succeeded',
      'paid_but_not_confirmed',
    ]);
    expect(events[0].reservationId).toBe('10');
    expect(events[0].carName).toBe('BMW 3');
    expect(events[0].customerName).toBe('Ada Lovelace');
    expect(events[0].oldStatus).toBe('processing_payment');
    expect(events[0].status).toBe('paid');
    expect(events[0].message).toContain('Payment succeeded');
  });

  test('maps confirmed, returned, manual_review, expired', () => {
    expect(mapStatusChangeToEvents({ newStatus: 'confirmed' })[0].type).toBe(
      'reservation_confirmed'
    );
    expect(mapStatusChangeToEvents({ newStatus: 'returned' })[0].type).toBe('car_returned');
    expect(mapStatusChangeToEvents({ newStatus: 'manual_review' })[0].type).toBe(
      'manual_review_needed'
    );
    expect(mapStatusChangeToEvents({ newStatus: 'expired' })[0].type).toBe('payment_failed');
  });

  test('unmapped status changes emit reservation_updated only', () => {
    expect(
      mapStatusChangeToEvents({
        reservationId: '8',
        oldStatus: 'confirmed',
        newStatus: 'picked_up',
      }).map((e) => e.type)
    ).toEqual(['reservation_updated']);

    expect(
      mapStatusChangeToEvents({
        reservationId: '8',
        oldStatus: 'confirmed',
        newStatus: 'cancelled',
      })[0].type
    ).toBe('reservation_updated');

    expect(
      mapStatusChangeToEvents({
        reservationId: '8',
        oldStatus: 'confirmed',
        newStatus: 'car_prepared',
      })[0].type
    ).toBe('reservation_updated');
  });

  test('confirmed stays high-signal only (no reservation_updated duplicate)', () => {
    const events = mapStatusChangeToEvents({
      oldStatus: 'paid',
      newStatus: 'confirmed',
    });
    expect(events.map((e) => e.type)).toEqual(['reservation_confirmed']);
  });

  test('same-status unmapped change emits nothing', () => {
    expect(
      mapStatusChangeToEvents({
        oldStatus: 'picked_up',
        newStatus: 'picked_up',
      })
    ).toEqual([]);
  });

  test('buildNewBookingEvent and buildPaymentFailedEvent produce required fields', () => {
    const booking = buildNewBookingEvent({
      order: { id: '5', fullName: 'Test', reservationId: '9', carId: 2 },
      reservation: { id: '9', status: 'confirmed' },
      carName: 'Audi A4',
    });
    expect(booking.type).toBe('new_booking');
    expect(booking.id).toBeTruthy();
    expect(booking.occurredAt).toBeTruthy();
    expect(booking.orderId).toBe('5');
    expect(booking.carName).toBe('Audi A4');

    const failed = buildPaymentFailedEvent({
      reservationId: '9',
      reason: 'card_declined',
    });
    expect(failed.type).toBe('payment_failed');
    expect(failed.meta.reason).toBe('card_declined');
  });

  test('buildCalendarUpdatedEvent includes action meta', () => {
    const event = buildCalendarUpdatedEvent({
      action: 'block_created',
      entityType: 'car_date_block',
      entityId: '12',
    });
    expect(event.type).toBe('calendar_updated');
    expect(event.meta.action).toBe('block_created');
    expect(event.meta.entityId).toBe('12');
  });

  test('buildLiveEvent rejects unknown types', () => {
    expect(() => buildLiveEvent('not_a_real_type')).toThrow(/Unknown live event type/);
  });
});
