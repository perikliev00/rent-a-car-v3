const request = require('supertest');
const { createApiTestApp } = require('../../helpers/apiTestApp');
const { loginAsAdmin } = require('../../helpers/apiAdminLogin');
const { ALL_PERMISSIONS } = require('../../helpers/rbacTestAccess');

jest.mock('../../../src/middleware/rateLimit', () =>
  require('../../helpers/rateLimitPassthrough')
);
jest.mock('../../../src/services/rbac/rbacService', () =>
  require('../../helpers/rbacTestAccess').createOwnerRbacMock()
);
jest.mock('../../../src/services/sql/userSqlService', () => ({
  findUserByEmail: jest.fn(),
}));
jest.mock('../../../src/services/account/accountClaimService', () => ({
  claimReservationsForUser: jest.fn().mockResolvedValue({ reservations: 0, orders: 0 }),
}));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const rbacService = require('../../../src/services/rbac/rbacService');

describe('Admin realtime SSE API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rbacService.getUserAccess.mockResolvedValue({
      roles: ['owner'],
      permissions: [...ALL_PERMISSIONS],
      roleDetails: [{ id: '1', slug: 'owner', name: 'Owner' }],
    });
  });

  test('GET /api/admin/realtime/stream returns 401 when unauthenticated', async () => {
    const app = createApiTestApp();
    const res = await request(app).get('/api/admin/realtime/stream').expect(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('authenticated staff receives published events on the stream', async () => {
    const app = createApiTestApp();
    // Require hub AFTER createApiTestApp so we share the cache-busted instance.
    // eslint-disable-next-line global-require
    const hub = require('../../../src/modules/realtime/realtime.hub');
    // eslint-disable-next-line global-require
    const { buildLiveEvent } = require('../../../src/modules/realtime/realtime.events');
    hub._resetForTests();

    const agent = await loginAsAdmin(app);

    const event = buildLiveEvent('manual_review_needed', {
      reservationId: '42',
      message: 'Manual review needed · reservation #42',
    });

    const body = await new Promise((resolve, reject) => {
      let data = '';
      let settled = false;
      let published = false;

      const finish = (err, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          hub.closeAll();
        } catch {
          // ignore
        }
        if (err) reject(err);
        else resolve(value);
      };

      const timer = setTimeout(() => {
        finish(new Error(`Timed out waiting for SSE event. Got: ${data.slice(0, 500)}`));
      }, 4000);

      agent
        .get('/api/admin/realtime/stream')
        .buffer(false)
        .parse((res, callback) => {
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            data += chunk;
            // Publish after the connection is open so the live subscriber receives it.
            if (!published && data.includes(': connected')) {
              published = true;
              hub.publish(event);
            }
            if (
              data.includes('event: manual_review_needed') &&
              data.includes('"reservationId":"42"')
            ) {
              callback(null, data);
              try {
                res.destroy();
              } catch {
                // ignore
              }
            }
          });
          res.on('error', () => {
            if (data.includes('event: manual_review_needed')) {
              callback(null, data);
            }
          });
          res.on('end', () => callback(null, data));
        })
        .end((err) => {
          if (settled) return;
          if (data.includes('event: manual_review_needed')) {
            finish(null, data);
            return;
          }
          if (err) {
            finish(err);
            return;
          }
          finish(null, data);
        });
    });

    expect(body).toContain('event: manual_review_needed');
    expect(body).toContain('"reservationId":"42"');
    expect(body).toContain(`id: ${event.id}`);
    hub._resetForTests();
  });
});
