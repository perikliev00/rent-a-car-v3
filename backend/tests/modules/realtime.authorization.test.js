const hub = require('../../src/modules/realtime/realtime.hub');
const { buildLiveEvent } = require('../../src/modules/realtime/realtime.events');

function mockRes() {
  const chunks = [];
  return {
    chunks,
    write(chunk) {
      chunks.push(String(chunk));
      return true;
    },
    end() {
      this.ended = true;
    },
    ended: false,
  };
}

const foreignEvent = () =>
  buildLiveEvent('new_booking', {
    reservationId: '77',
    customerName: 'Foreign Customer',
    status: 'confirmed',
    meta: { stripeSessionId: 'cs_test_foreign', reason: 'paid' },
  });

describe('realtime authorization', () => {
  beforeEach(() => {
    hub._resetForTests();
  });

  afterEach(() => {
    hub._resetForTests();
  });

  test('owner receives reservation details and a driver does not', () => {
    const owner = mockRes();
    const driver = mockRes();
    hub.subscribe(owner, {
      access: { userId: '1', roles: ['owner'], permissions: [] },
      sessionId: 'owner-session',
    });
    hub.subscribe(driver, {
      access: {
        userId: '9',
        roles: ['driver'],
        permissions: ['can_view_own_calendar_tasks'],
      },
      sessionId: 'driver-session',
    });

    hub.publish(foreignEvent());

    expect(owner.chunks.join('')).toContain('Foreign Customer');
    const driverBody = driver.chunks.join('');
    expect(driverBody).not.toContain('Foreign Customer');
    expect(driverBody).not.toContain('cs_test_foreign');
    expect(driverBody).not.toContain('new_booking');
  });

  test('replay uses the same scope as live delivery', () => {
    const event = foreignEvent();
    hub.publish(event);

    const driver = mockRes();
    hub.subscribe(driver, {
      access: {
        userId: '9',
        roles: ['driver'],
        permissions: ['can_view_own_calendar_tasks'],
      },
      sessionId: 'driver-session',
      lastEventId: 'missing-event',
    });

    const body = driver.chunks.join('');
    expect(body).not.toContain('Foreign Customer');
    expect(body).not.toContain(event.id);
  });

  test('own-task staff receive only their redacted calendar invalidation', () => {
    const driver = mockRes();
    hub.subscribe(driver, {
      access: {
        userId: '9',
        roles: ['driver'],
        permissions: ['can_view_own_calendar_tasks'],
      },
      sessionId: 'driver-session',
    });

    hub.publish(
      buildLiveEvent('calendar_updated', {
        customerName: 'Hidden Name',
        meta: {
          action: 'task_updated',
          entityType: 'task',
          entityId: '4',
          assignedToUserId: '8',
          phoneNumber: '+359000',
        },
      })
    );
    hub.publish(
      buildLiveEvent('calendar_updated', {
        meta: {
          action: 'task_updated',
          entityType: 'task',
          entityId: '5',
          assignedToUserId: '9',
          phoneNumber: '+359111',
        },
      })
    );

    const body = driver.chunks.join('');
    expect(body).not.toContain('Hidden Name');
    expect(body).not.toContain('+359');
    expect(body).toContain('"entityId":"5"');
    expect(body).not.toContain('"entityId":"4"');
  });

  test('logout, expiry, and permission changes stop an open stream', async () => {
    const res = mockRes();
    hub.subscribe(res, {
      access: {
        userId: '3',
        roles: ['manager'],
        permissions: ['can_view_reservations_ops'],
      },
      sessionId: 'sess-live',
      maxLifetimeMs: 1_000,
      connectedAt: Date.now(),
    });

    hub.revokeSession('sess-live');
    hub.publish(foreignEvent());
    expect(res.ended).toBe(true);
    expect(res.chunks.join('')).toContain('session_revoked');
    expect(res.chunks.join('')).not.toContain('Foreign Customer');

    hub._resetForTests();
    const expired = mockRes();
    hub.subscribe(expired, {
      access: {
        userId: '3',
        roles: ['manager'],
        permissions: ['can_view_reservations_ops'],
      },
      sessionId: 'sess-old',
      connectedAt: Date.now() - 5_000,
      maxLifetimeMs: 1_000,
    });
    await hub.revalidateSubscribers(async () => ({ valid: true, access: {
      userId: '3',
      roles: ['manager'],
      permissions: ['can_view_reservations_ops'],
    } }));
    expect(expired.ended).toBe(true);
    expect(expired.chunks.join('')).toContain('max_lifetime');

    hub._resetForTests();
    const demoted = mockRes();
    hub.subscribe(demoted, {
      access: {
        userId: '3',
        roles: ['manager'],
        permissions: ['can_view_reservations_ops'],
      },
      sessionId: 'sess-demoted',
    });
    await hub.revalidateSubscribers(async () => ({
      valid: true,
      access: { userId: '3', roles: ['driver'], permissions: ['can_view_own_calendar_tasks'] },
    }));
    hub.publish(foreignEvent());
    expect(demoted.ended).toBe(true);
    expect(demoted.chunks.join('')).toContain('authorization_changed');
    expect(demoted.chunks.join('')).not.toContain('Foreign Customer');
  });

  test('a lookup that reports a dead session stops delivery on every subscriber with that id', async () => {
    const first = mockRes();
    const second = mockRes();
    const access = {
      userId: '3',
      roles: ['manager'],
      permissions: ['can_view_reservations_ops'],
    };
    hub.subscribe(first, { access, sessionId: 'shared' });
    hub.subscribe(second, { access, sessionId: 'shared' });

    await hub.revalidateSubscribers(async () => ({ valid: false }));
    hub.publish(foreignEvent());

    expect(first.chunks.join('')).not.toContain('Foreign Customer');
    expect(second.chunks.join('')).not.toContain('Foreign Customer');
    expect(first.ended).toBe(true);
    expect(second.ended).toBe(true);
  });
});
