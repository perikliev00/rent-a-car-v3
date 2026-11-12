const {
  parseEventId,
  mapReservationEvents,
  mapBlockEvent,
} = require('../../src/modules/calendar/calendar.eventMapper');
const conflictEngine = require('../../src/modules/calendar/calendar.conflictEngine');

describe('calendar.eventMapper', () => {
  test('parseEventId splits type and id', () => {
    expect(parseEventId('reservation:42')).toEqual({ type: 'reservation', id: '42' });
    expect(parseEventId('bad')).toBeNull();
  });

  test('mapReservationEvents skips terminal statuses', () => {
    expect(
      mapReservationEvents({
        id: 1,
        car_id: 2,
        status: 'cancelled',
        pickup_date: new Date(),
        return_date: new Date(),
      })
    ).toEqual([]);
  });

  test('mapReservationEvents emits reservation + markers', () => {
    const events = mapReservationEvents({
      id: 9,
      car_id: 3,
      status: 'confirmed',
      pickup_date: '2026-08-10T10:00:00Z',
      return_date: '2026-08-12T10:00:00Z',
      full_name: 'Ada',
      email: 'a@b.c',
      pickup_location: 'office',
      return_location: 'office',
      total_price: 100,
    });
    expect(events.map((e) => e.type)).toEqual(
      expect.arrayContaining(['reservation', 'pickup', 'return'])
    );
  });

  test('mapBlockEvent hides booking blocks', () => {
    expect(mapBlockEvent({ id: 1, car_id: 1, block_type: 'booking' })).toBeNull();
    expect(
      mapBlockEvent({
        id: 2,
        car_id: 1,
        block_type: 'manual',
        start_date: '2026-08-01',
        end_date: '2026-08-02',
        reason: 'Wash',
      })
    ).toMatchObject({ type: 'blocked', id: 'blocked:2' });
  });
});

describe('calendar.conflictEngine.assertWritable', () => {
  test('hard non-overridable blocks always throw', () => {
    expect(() =>
      conflictEngine.assertWritable(
        [{ code: 'HOLD_OVERLAP', severity: 'block', message: 'hold', overridable: false }],
        { force: true, canOverride: true }
      )
    ).toThrow(/hold/i);
  });

  test('overridable block requires force + permission', () => {
    const conflicts = [
      { code: 'CAR_STATUS_BLOCK', severity: 'block', message: 'maint', overridable: true },
    ];
    expect(() => conflictEngine.assertWritable(conflicts, { force: false, canOverride: true })).toThrow(
      /maint/i
    );
    expect(() =>
      conflictEngine.assertWritable(conflicts, { force: true, canOverride: false })
    ).toThrow(/maint/i);
    expect(
      conflictEngine.assertWritable(conflicts, { force: true, canOverride: true }).forced
    ).toBe(true);
  });
});
