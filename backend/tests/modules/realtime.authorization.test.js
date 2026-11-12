// Require the '../../src/modules/realtime/realtime.hub' module as hub.
const hub = require('../../src/modules/realtime/realtime.hub');
// Destructure object properties into local variables.
const { buildLiveEvent } = require('../../src/modules/realtime/realtime.events');

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

// Create the foreign event constant.
const foreignEvent = () =>
  // Call buildLiveEvent to perform this step.
  buildLiveEvent('new_booking', {
    // Provide the reservation id field value.
    reservationId: '77',
    // Provide the customer name field value.
    customerName: 'Foreign Customer',
    // Provide the status field value.
    status: 'confirmed',
    // Provide the meta field value.
    meta: { stripeSessionId: 'cs_test_foreign', reason: 'paid' },
  });

// Declare a test suite grouping related cases.
describe('realtime authorization', () => {
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
  test('owner receives reservation details and a driver does not', () => {
    // Create the owner constant.
    const owner = mockRes();
    // Create the driver constant.
    const driver = mockRes();
    // Call hub.subscribe to perform this step.
    hub.subscribe(owner, {
      // Provide the access field value.
      access: { userId: '1', roles: ['owner'], permissions: [] },
      // Provide the session id field value.
      sessionId: 'owner-session',
    });
    // Call hub.subscribe to perform this step.
    hub.subscribe(driver, {
      // Provide the access field value.
      access: {
        // Provide the user id field value.
        userId: '9',
        // Provide the roles field value.
        roles: ['driver'],
        // Provide the permissions field value.
        permissions: ['can_view_own_calendar_tasks'],
      },
      // Provide the session id field value.
      sessionId: 'driver-session',
    });

    // Call hub.publish to perform this step.
    hub.publish(foreignEvent());

    // Assert that the value matches the intended expectation.
    expect(owner.chunks.join('')).toContain('Foreign Customer');
    // Create the driver body constant.
    const driverBody = driver.chunks.join('');
    // Assert that the value matches the intended expectation.
    expect(driverBody).not.toContain('Foreign Customer');
    // Assert that the value matches the intended expectation.
    expect(driverBody).not.toContain('cs_test_foreign');
    // Assert that the value matches the intended expectation.
    expect(driverBody).not.toContain('new_booking');
  });

  // Define a single test case and its expectations.
  test('replay uses the same scope as live delivery', () => {
    // Create the event constant.
    const event = foreignEvent();
    // Call hub.publish to perform this step.
    hub.publish(event);

    // Create the driver constant.
    const driver = mockRes();
    // Call hub.subscribe to perform this step.
    hub.subscribe(driver, {
      // Provide the access field value.
      access: {
        // Provide the user id field value.
        userId: '9',
        // Provide the roles field value.
        roles: ['driver'],
        // Provide the permissions field value.
        permissions: ['can_view_own_calendar_tasks'],
      },
      // Provide the session id field value.
      sessionId: 'driver-session',
      // Provide the last event id field value.
      lastEventId: 'missing-event',
    });

    // Create the body constant.
    const body = driver.chunks.join('');
    // Assert that the value matches the intended expectation.
    expect(body).not.toContain('Foreign Customer');
    // Assert that the value matches the intended expectation.
    expect(body).not.toContain(event.id);
  });

  // Define a single test case and its expectations.
  test('own-task staff receive only their redacted calendar invalidation', () => {
    // Create the driver constant.
    const driver = mockRes();
    // Call hub.subscribe to perform this step.
    hub.subscribe(driver, {
      // Provide the access field value.
      access: {
        // Provide the user id field value.
        userId: '9',
        // Provide the roles field value.
        roles: ['driver'],
        // Provide the permissions field value.
        permissions: ['can_view_own_calendar_tasks'],
      },
      // Provide the session id field value.
      sessionId: 'driver-session',
    });

    // Call hub.publish to perform this step.
    hub.publish(
      // Call buildLiveEvent to perform this step.
      buildLiveEvent('calendar_updated', {
        // Provide the customer name field value.
        customerName: 'Hidden Name',
        // Provide the meta field value.
        meta: {
          // Provide the action field value.
          action: 'task_updated',
          // Provide the entity type field value.
          entityType: 'task',
          // Provide the entity id field value.
          entityId: '4',
          // Provide the assigned to user id field value.
          assignedToUserId: '8',
          // Provide the phone number field value.
          phoneNumber: '+359000',
        },
      })
    );
    // Call hub.publish to perform this step.
    hub.publish(
      // Call buildLiveEvent to perform this step.
      buildLiveEvent('calendar_updated', {
        // Provide the meta field value.
        meta: {
          // Provide the action field value.
          action: 'task_updated',
          // Provide the entity type field value.
          entityType: 'task',
          // Provide the entity id field value.
          entityId: '5',
          // Provide the assigned to user id field value.
          assignedToUserId: '9',
          // Provide the phone number field value.
          phoneNumber: '+359111',
        },
      })
    );

    // Create the body constant.
    const body = driver.chunks.join('');
    // Assert that the value matches the intended expectation.
    expect(body).not.toContain('Hidden Name');
    // Assert that the value matches the intended expectation.
    expect(body).not.toContain('+359');
    // Assert that the value matches the intended expectation.
    expect(body).toContain('"entityId":"5"');
    // Assert that the value matches the intended expectation.
    expect(body).not.toContain('"entityId":"4"');
  });

  // Define a single test case and its expectations.
  test('logout, expiry, and permission changes stop an open stream', async () => {
    // Create the res constant.
    const res = mockRes();
    // Call hub.subscribe to perform this step.
    hub.subscribe(res, {
      // Provide the access field value.
      access: {
        // Provide the user id field value.
        userId: '3',
        // Provide the roles field value.
        roles: ['manager'],
        // Provide the permissions field value.
        permissions: ['can_view_reservations_ops'],
      },
      // Provide the session id field value.
      sessionId: 'sess-live',
      // Provide the max lifetime ms field value.
      maxLifetimeMs: 1_000,
      // Provide the connected at field value.
      connectedAt: Date.now(),
    });

    // Call hub.revokeSession to perform this step.
    hub.revokeSession('sess-live');
    // Call hub.publish to perform this step.
    hub.publish(foreignEvent());
    // Assert that the value matches the intended expectation.
    expect(res.ended).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(res.chunks.join('')).toContain('session_revoked');
    // Assert that the value matches the intended expectation.
    expect(res.chunks.join('')).not.toContain('Foreign Customer');

    // Call hub._resetForTests to perform this step.
    hub._resetForTests();
    // Create the expired constant.
    const expired = mockRes();
    // Call hub.subscribe to perform this step.
    hub.subscribe(expired, {
      // Provide the access field value.
      access: {
        // Provide the user id field value.
        userId: '3',
        // Provide the roles field value.
        roles: ['manager'],
        // Provide the permissions field value.
        permissions: ['can_view_reservations_ops'],
      },
      // Provide the session id field value.
      sessionId: 'sess-old',
      // Provide the connected at field value.
      connectedAt: Date.now() - 5_000,
      // Provide the max lifetime ms field value.
      maxLifetimeMs: 1_000,
    });
    // Wait until the asynchronous operation resolves.
    await hub.revalidateSubscribers(async () => ({ valid: true, access: {
      // Provide the user id field value.
      userId: '3',
      // Provide the roles field value.
      roles: ['manager'],
      // Provide the permissions field value.
      permissions: ['can_view_reservations_ops'],
    // Continue the surrounding logic with this statement.
    } }));
    // Assert that the value matches the intended expectation.
    expect(expired.ended).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(expired.chunks.join('')).toContain('max_lifetime');

    // Call hub._resetForTests to perform this step.
    hub._resetForTests();
    // Create the demoted constant.
    const demoted = mockRes();
    // Call hub.subscribe to perform this step.
    hub.subscribe(demoted, {
      // Provide the access field value.
      access: {
        // Provide the user id field value.
        userId: '3',
        // Provide the roles field value.
        roles: ['manager'],
        // Provide the permissions field value.
        permissions: ['can_view_reservations_ops'],
      },
      // Provide the session id field value.
      sessionId: 'sess-demoted',
    });
    // Wait until the asynchronous operation resolves.
    await hub.revalidateSubscribers(async () => ({
      // Provide the valid field value.
      valid: true,
      // Provide the access field value.
      access: { userId: '3', roles: ['driver'], permissions: ['can_view_own_calendar_tasks'] },
    }));
    // Call hub.publish to perform this step.
    hub.publish(foreignEvent());
    // Assert that the value matches the intended expectation.
    expect(demoted.ended).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(demoted.chunks.join('')).toContain('authorization_changed');
    // Assert that the value matches the intended expectation.
    expect(demoted.chunks.join('')).not.toContain('Foreign Customer');
  });

  // Define a single test case and its expectations.
  test('a lookup that reports a dead session stops delivery on every subscriber with that id', async () => {
    // Create the first constant.
    const first = mockRes();
    // Create the second constant.
    const second = mockRes();
    // Create the access constant.
    const access = {
      // Provide the user id field value.
      userId: '3',
      // Provide the roles field value.
      roles: ['manager'],
      // Provide the permissions field value.
      permissions: ['can_view_reservations_ops'],
    };
    // Call hub.subscribe to perform this step.
    hub.subscribe(first, { access, sessionId: 'shared' });
    // Call hub.subscribe to perform this step.
    hub.subscribe(second, { access, sessionId: 'shared' });

    // Wait until the asynchronous operation resolves.
    await hub.revalidateSubscribers(async () => ({ valid: false }));
    // Call hub.publish to perform this step.
    hub.publish(foreignEvent());

    // Assert that the value matches the intended expectation.
    expect(first.chunks.join('')).not.toContain('Foreign Customer');
    // Assert that the value matches the intended expectation.
    expect(second.chunks.join('')).not.toContain('Foreign Customer');
    // Assert that the value matches the intended expectation.
    expect(first.ended).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(second.ended).toBe(true);
  });
});
