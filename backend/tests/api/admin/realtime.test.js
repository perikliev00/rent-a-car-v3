// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createApiTestApp } = require('../../helpers/apiTestApp');
// Destructure object properties into local variables.
const { loginAsAdmin } = require('../../helpers/apiAdminLogin');
// Destructure object properties into local variables.
const { ALL_PERMISSIONS } = require('../../helpers/rbacTestAccess');

// Call jest.mock to perform this step.
jest.mock('../../../src/middleware/rateLimit', () =>
  // Call require to perform this step.
  require('../../helpers/rateLimitPassthrough')
);
// Call jest.mock to perform this step.
jest.mock('../../../src/services/rbac/rbacService', () =>
  // Call require to perform this step.
  require('../../helpers/rbacTestAccess').createOwnerRbacMock()
);
// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/userSqlService', () => ({
  // Provide the find user by email field value.
  findUserByEmail: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/account/accountClaimService', () => ({
  // Provide the claim reservations for user field value.
  claimReservationsForUser: jest.fn().mockResolvedValue({ reservations: 0, orders: 0 }),
}));
// Call jest.mock to perform this step.
jest.mock('bcrypt', () => ({
  // Provide the compare field value.
  compare: jest.fn(),
  // Provide the hash field value.
  hash: jest.fn(),
}));

// Require the '../../../src/services/rbac/rbacService' module as rbacService.
const rbacService = require('../../../src/services/rbac/rbacService');

// Declare a test suite grouping related cases.
describe('Admin realtime SSE API', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call rbacService.getUserAccess.mockResolvedValue to perform this step.
    rbacService.getUserAccess.mockResolvedValue({
      // Provide the roles field value.
      roles: ['owner'],
      // Provide the permissions field value.
      permissions: [...ALL_PERMISSIONS],
      // Provide the role details field value.
      roleDetails: [{ id: '1', slug: 'owner', name: 'Owner' }],
    });
  });

  // Define a single test case and its expectations.
  test('GET /api/admin/realtime/stream returns 401 when unauthenticated', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the res constant.
    const res = await request(app).get('/api/admin/realtime/stream').expect(401);
    // Assert that the value matches the intended expectation.
    expect(res.body.success).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  // Define a single test case and its expectations.
  test('authenticated staff receives published events on the stream', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Require hub AFTER createApiTestApp so we share the cache-busted instance.
    // eslint-disable-next-line global-require
    const hub = require('../../../src/modules/realtime/realtime.hub');
    // eslint-disable-next-line global-require
    const { buildLiveEvent } = require('../../../src/modules/realtime/realtime.events');
    // Call hub._resetForTests to perform this step.
    hub._resetForTests();

    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the event constant.
    const event = buildLiveEvent('manual_review_needed', {
      // Provide the reservation id field value.
      reservationId: '42',
      // Provide the message field value.
      message: 'Manual review needed · reservation #42',
    });

    // Create the body constant.
    const body = await new Promise((resolve, reject) => {
      // Initialize the mutable data variable.
      let data = '';
      // Initialize the mutable settled variable.
      let settled = false;
      // Initialize the mutable published variable.
      let published = false;

      // Create the finish constant.
      const finish = (err, value) => {
        // Evaluate the condition and enter the branch when it is true.
        if (settled) return;
        // Update settled with the right-hand side value.
        settled = true;
        // Call clearTimeout to perform this step.
        clearTimeout(timer);
        // Start a try block for operations that may fail.
        try {
          // Call hub.closeAll to perform this step.
          hub.closeAll();
        // Contribute this line to the enclosing declaration or statement.
        } catch {
          // ignore
        }
        // Evaluate the condition and enter the branch when it is true.
        if (err) reject(err);
        // Run the fallback path after earlier conditions failed.
        else resolve(value);
      };

      // Create the timer constant.
      const timer = setTimeout(() => {
        // Call finish to perform this step.
        finish(new Error(`Timed out waiting for SSE event. Got: ${data.slice(0, 500)}`));
      // Continue the surrounding logic with this statement.
      }, 4000);

      // Reference the identifier used by the enclosing expression.
      agent
        // Call .get to perform this step.
        .get('/api/admin/realtime/stream')
        // Call .buffer to perform this step.
        .buffer(false)
        // Call .parse to perform this step.
        .parse((res, callback) => {
          // Call res.setEncoding to perform this step.
          res.setEncoding('utf8');
          // Call res.on to perform this step.
          res.on('data', (chunk) => {
            // Update data with the right-hand side value.
            data += chunk;
            // Publish after the connection is open so the live subscriber receives it.
            if (!published && data.includes(': connected')) {
              // Update published with the right-hand side value.
              published = true;
              // Call hub.publish to perform this step.
              hub.publish(event);
            }
            // Evaluate the condition and enter the branch when it is true.
            if (
              // Call data.includes to perform this step.
              data.includes('event: manual_review_needed') &&
              // Call data.includes to perform this step.
              data.includes('"reservationId":"42"')
            // Continue the surrounding logic with this statement.
            ) {
              // Call callback to perform this step.
              callback(null, data);
              // Start a try block for operations that may fail.
              try {
                // Call res.destroy to perform this step.
                res.destroy();
              // Contribute this line to the enclosing declaration or statement.
              } catch {
                // ignore
              }
            }
          });
          // Call res.on to perform this step.
          res.on('error', () => {
            // Evaluate the condition and enter the branch when it is true.
            if (data.includes('event: manual_review_needed')) {
              // Call callback to perform this step.
              callback(null, data);
            }
          });
          // Call res.on to perform this step.
          res.on('end', () => callback(null, data));
        })
        // Call .end to perform this step.
        .end((err) => {
          // Evaluate the condition and enter the branch when it is true.
          if (settled) return;
          // Evaluate the condition and enter the branch when it is true.
          if (data.includes('event: manual_review_needed')) {
            // Call finish to perform this step.
            finish(null, data);
            // Return control to the caller with the following value.
            return;
          }
          // Evaluate the condition and enter the branch when it is true.
          if (err) {
            // Call finish to perform this step.
            finish(err);
            // Return control to the caller with the following value.
            return;
          }
          // Call finish to perform this step.
          finish(null, data);
        });
    });

    // Assert that the value matches the intended expectation.
    expect(body).toContain('event: manual_review_needed');
    // Assert that the value matches the intended expectation.
    expect(body).toContain('"reservationId":"42"');
    // Assert that the value matches the intended expectation.
    expect(body).toContain(`id: ${event.id}`);
    // Call hub._resetForTests to perform this step.
    hub._resetForTests();
  });
});
