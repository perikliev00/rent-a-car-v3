// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  parseEventId,
  // Contribute this line to the enclosing declaration or statement.
  mapReservationEvents,
  // Contribute this line to the enclosing declaration or statement.
  mapBlockEvent,
// Continue the surrounding logic with this statement.
} = require('../../src/modules/calendar/calendar.eventMapper');
// Require the '../../src/modules/calendar/calendar.conflictEngine' module as conflictEngine.
const conflictEngine = require('../../src/modules/calendar/calendar.conflictEngine');

// Declare a test suite grouping related cases.
describe('calendar.eventMapper', () => {
  // Define a single test case and its expectations.
  test('parseEventId splits type and id', () => {
    // Assert that the value matches the intended expectation.
    expect(parseEventId('reservation:42')).toEqual({ type: 'reservation', id: '42' });
    // Assert that the value matches the intended expectation.
    expect(parseEventId('bad')).toBeNull();
  });

  // Define a single test case and its expectations.
  test('mapReservationEvents skips terminal statuses', () => {
    // Assert that the value matches the intended expectation.
    expect(
      // Call mapReservationEvents to perform this step.
      mapReservationEvents({
        // Provide the id field value.
        id: 1,
        // Provide the car id field value.
        car_id: 2,
        // Provide the status field value.
        status: 'cancelled',
        // Provide the pickup date field value.
        pickup_date: new Date(),
        // Provide the return date field value.
        return_date: new Date(),
      })
    // Continue the surrounding logic with this statement.
    ).toEqual([]);
  });

  // Define a single test case and its expectations.
  test('mapReservationEvents emits reservation + markers', () => {
    // Create the events constant.
    const events = mapReservationEvents({
      // Provide the id field value.
      id: 9,
      // Provide the car id field value.
      car_id: 3,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the pickup date field value.
      pickup_date: '2026-08-10T10:00:00Z',
      // Provide the return date field value.
      return_date: '2026-08-12T10:00:00Z',
      // Provide the full name field value.
      full_name: 'Ada',
      // Provide the email field value.
      email: 'a@b.c',
      // Provide the pickup location field value.
      pickup_location: 'office',
      // Provide the return location field value.
      return_location: 'office',
      // Provide the total price field value.
      total_price: 100,
    });
    // Assert that the value matches the intended expectation.
    expect(events.map((e) => e.type)).toEqual(
      // Call expect.arrayContaining to perform this step.
      expect.arrayContaining(['reservation', 'pickup', 'return'])
    );
  });

  // Define a single test case and its expectations.
  test('mapBlockEvent hides booking blocks', () => {
    // Assert that the value matches the intended expectation.
    expect(mapBlockEvent({ id: 1, car_id: 1, block_type: 'booking' })).toBeNull();
    // Assert that the value matches the intended expectation.
    expect(
      // Call mapBlockEvent to perform this step.
      mapBlockEvent({
        // Provide the id field value.
        id: 2,
        // Provide the car id field value.
        car_id: 1,
        // Provide the block type field value.
        block_type: 'manual',
        // Provide the start date field value.
        start_date: '2026-08-01',
        // Provide the end date field value.
        end_date: '2026-08-02',
        // Provide the reason field value.
        reason: 'Wash',
      })
    // Continue the surrounding logic with this statement.
    ).toMatchObject({ type: 'blocked', id: 'blocked:2' });
  });
});

// Declare a test suite grouping related cases.
describe('calendar.conflictEngine.assertWritable', () => {
  // Define a single test case and its expectations.
  test('hard non-overridable blocks always throw', () => {
    // Assert that the value matches the intended expectation.
    expect(() =>
      // Call conflictEngine.assertWritable to perform this step.
      conflictEngine.assertWritable(
        // Contribute this line to the enclosing declaration or statement.
        [{ code: 'HOLD_OVERLAP', severity: 'block', message: 'hold', overridable: false }],
        // Contribute this line to the enclosing declaration or statement.
        { force: true, canOverride: true }
      )
    // Continue the surrounding logic with this statement.
    ).toThrow(/hold/i);
  });

  // Define a single test case and its expectations.
  test('overridable block requires force + permission', () => {
    // Create the conflicts constant.
    const conflicts = [
      // Contribute this line to the enclosing declaration or statement.
      { code: 'CAR_STATUS_BLOCK', severity: 'block', message: 'maint', overridable: true },
    ];
    // Assert that the value matches the intended expectation.
    expect(() => conflictEngine.assertWritable(conflicts, { force: false, canOverride: true })).toThrow(
      // Contribute this line to the enclosing declaration or statement.
      /maint/i
    );
    // Assert that the value matches the intended expectation.
    expect(() =>
      // Call conflictEngine.assertWritable to perform this step.
      conflictEngine.assertWritable(conflicts, { force: true, canOverride: false })
    // Continue the surrounding logic with this statement.
    ).toThrow(/maint/i);
    // Assert that the value matches the intended expectation.
    expect(
      // Call conflictEngine.assertWritable to perform this step.
      conflictEngine.assertWritable(conflicts, { force: true, canOverride: true }).forced
    // Continue the surrounding logic with this statement.
    ).toBe(true);
  });
});
