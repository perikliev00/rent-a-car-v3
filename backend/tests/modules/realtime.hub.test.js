// Require the '../../src/modules/realtime/realtime.hub' module as hub.
const hub = require('../../src/modules/realtime/realtime.hub');
// Destructure object properties into local variables.
const { buildLiveEvent } = require('../../src/modules/realtime/realtime.events');

// Create the authorized access constant.
const authorizedAccess = {
  // Provide the user id field value.
  userId: '1',
  // Provide the roles field value.
  roles: ['manager'],
  // Provide the permissions field value.
  permissions: ['can_view_reservations_ops', 'can_view_calendar'],
};

// Define the mockRes function.
function mockRes() {
  // Create the chunks constant.
  const chunks = [];
  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    chunks,
    // Call write to perform this step.
    write(chunk) {
      // Call chunks.push to perform this step.
      chunks.push(String(chunk));
      // Return the resulting value to the caller.
      return true;
    },
    // Call end to perform this step.
    end() {
      // Update this.ended with the right-hand side value.
      this.ended = true;
    },
    // Provide the ended field value.
    ended: false,
  };
}

// Declare a test suite grouping related cases.
describe('realtime.hub', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call hub._resetForTests to perform this step.
    hub._resetForTests();
  });

  // Register cleanup that runs after the tests.
  afterEach(() => {
    // Call hub._resetForTests to perform this step.
    hub._resetForTests();
  });

  // Define a single test case and its expectations.
  test('publish delivers to subscribers', () => {
    // Create the res constant.
    const res = mockRes();
    // Call hub.subscribe to perform this step.
    hub.subscribe(res, { access: authorizedAccess, sessionId: 'sess-1' });

    // Create the event constant.
    const event = buildLiveEvent('payment_succeeded', { reservationId: '1' });
    // Call hub.publish to perform this step.
    hub.publish(event);

    // Create the body constant.
    const body = res.chunks.join('');
    // Assert that the value matches the intended expectation.
    expect(body).toContain(`id: ${event.id}`);
    // Assert that the value matches the intended expectation.
    expect(body).toContain('event: payment_succeeded');
    // Assert that the value matches the intended expectation.
    expect(body).toContain('"reservationId":"1"');
  });

  // Define a single test case and its expectations.
  test('ring buffer replays events after Last-Event-ID', () => {
    // Create the first constant.
    const first = buildLiveEvent('new_booking', { reservationId: '1' });
    // Create the second constant.
    const second = buildLiveEvent('reservation_confirmed', { reservationId: '1' });
    // Call hub.publish to perform this step.
    hub.publish(first);
    // Call hub.publish to perform this step.
    hub.publish(second);

    // Create the res constant.
    const res = mockRes();
    // Call hub.subscribe to perform this step.
    hub.subscribe(res, { lastEventId: first.id, access: authorizedAccess, sessionId: 'sess-1' });

    // Create the body constant.
    const body = res.chunks.join('');
    // Assert that the value matches the intended expectation.
    expect(body).not.toContain(`id: ${first.id}\n`);
    // Assert that the value matches the intended expectation.
    expect(body).toContain(`id: ${second.id}`);
    // Assert that the value matches the intended expectation.
    expect(body).toContain('event: reservation_confirmed');
  });

  // Define a single test case and its expectations.
  test('unsubscribe stops delivery', () => {
    // Create the res constant.
    const res = mockRes();
    // Create the id constant.
    const id = hub.subscribe(res, { access: authorizedAccess, sessionId: 'sess-1' });
    // Call hub.unsubscribe to perform this step.
    hub.unsubscribe(id);

    // Call hub.publish to perform this step.
    hub.publish(buildLiveEvent('car_returned', { reservationId: '2' }));
    // Assert that the value matches the intended expectation.
    expect(res.chunks.join('')).not.toContain('car_returned');
  });

  // Define a single test case and its expectations.
  test('closeAll ends open responses', () => {
    // Create the res constant.
    const res = mockRes();
    // Call hub.subscribe to perform this step.
    hub.subscribe(res, { access: authorizedAccess, sessionId: 'sess-1' });
    // Assert that the value matches the intended expectation.
    expect(hub.getSubscriberCount()).toBe(1);
    // Call hub.closeAll to perform this step.
    hub.closeAll();
    // Assert that the value matches the intended expectation.
    expect(hub.getSubscriberCount()).toBe(0);
    // Assert that the value matches the intended expectation.
    expect(res.ended).toBe(true);
  });
});
