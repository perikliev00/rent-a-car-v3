// Require the 'express' module as express.
const express = require('express');
// Require the 'express-session' module as session.
const session = require('express-session');
// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  requireAdminApi,
  // Contribute this line to the enclosing declaration or statement.
  requireStaffApi,
  // Contribute this line to the enclosing declaration or statement.
  requirePermission,
  // Contribute this line to the enclosing declaration or statement.
  requireAnyPermission,
// Continue the surrounding logic with this statement.
} = require('../src/middleware/auth');

// Define the createAuthTestApp function.
function createAuthTestApp(sessionSeed = {}, mount) {
  // Create the app constant.
  const app = express();
  // Call app.use to perform this step.
  app.use(
    // Call session to perform this step.
    session({
      // Provide the secret field value.
      secret: 'test-session-secret',
      // Provide the resave field value.
      resave: false,
      // Provide the save uninitialized field value.
      saveUninitialized: false,
      // Provide the store field value.
      store: new session.MemoryStore(),
    })
  );
  // Call app.use to perform this step.
  app.use((req, _res, next) => {
    // Call Object.assign to perform this step.
    Object.assign(req.session, sessionSeed);
    // Call next to perform this step.
    next();
  });
  // Call mount to perform this step.
  mount(app);
  // Return the resulting value to the caller.
  return app;
}

// Declare a test suite grouping related cases.
describe('RBAC auth middleware', () => {
  // Define a single test case and its expectations.
  test('requireStaffApi returns 401 when logged out', async () => {
    // Create the app constant.
    const app = createAuthTestApp({}, (app) => {
      // Call app.get to perform this step.
      app.get('/x', requireStaffApi, (_req, res) => res.json({ ok: true }));
    });
    // Create the response constant.
    const response = await request(app).get('/x');
    // Assert that the value matches the intended expectation.
    expect(response.status).toBe(401);
  });

  // Define a single test case and its expectations.
  test('requireStaffApi denies customer without roles', async () => {
    // Create the app constant.
    const app = createAuthTestApp(
      // Contribute this line to the enclosing declaration or statement.
      { isLoggedIn: true, user: { role: 'user', roles: [], permissions: [] } },
      // Continue the surrounding logic with this statement.
      (app) => {
        // Call app.get to perform this step.
        app.get('/x', requireStaffApi, (_req, res) => res.json({ ok: true }));
      }
    );
    // Create the response constant.
    const response = await request(app).get('/x');
    // Assert that the value matches the intended expectation.
    expect(response.status).toBe(403);
  });

  // Define a single test case and its expectations.
  test('requireStaffApi allows staff with roles', async () => {
    // Create the app constant.
    const app = createAuthTestApp(
      {
        // Provide the is logged in field value.
        isLoggedIn: true,
        // Provide the user field value.
        user: { role: 'staff', roles: ['driver'], permissions: ['can_view_own_calendar_tasks'] },
      },
      // Continue the surrounding logic with this statement.
      (app) => {
        // Call app.get to perform this step.
        app.get('/x', requireStaffApi, (_req, res) => res.json({ ok: true }));
      }
    );
    // Create the response constant.
    const response = await request(app).get('/x');
    // Assert that the value matches the intended expectation.
    expect(response.status).toBe(200);
  });

  // Define a single test case and its expectations.
  test('requireAdminApi denies legacy admin without RBAC roles', async () => {
    // Create the app constant.
    const app = createAuthTestApp(
      // Contribute this line to the enclosing declaration or statement.
      { isLoggedIn: true, user: { role: 'admin', email: 'admin@example.com', roles: [], permissions: [] } },
      // Continue the surrounding logic with this statement.
      (app) => {
        // Call app.get to perform this step.
        app.get('/x', requireAdminApi, (_req, res) => res.json({ ok: true }));
      }
    );
    // Create the response constant.
    const response = await request(app).get('/x');
    // Assert that the value matches the intended expectation.
    expect(response.status).toBe(403);
  });

  // Define a single test case and its expectations.
  test('requireStaffApi denies stale staff role without RBAC roles', async () => {
    // Create the app constant.
    const app = createAuthTestApp(
      {
        // Provide the is logged in field value.
        isLoggedIn: true,
        // Provide the user field value.
        user: { role: 'staff', email: 'ex@example.com', roles: [], permissions: [] },
      },
      // Continue the surrounding logic with this statement.
      (app) => {
        // Call app.get to perform this step.
        app.get('/x', requireStaffApi, (_req, res) => res.json({ ok: true }));
      }
    );
    // Create the response constant.
    const response = await request(app).get('/x');
    // Assert that the value matches the intended expectation.
    expect(response.status).toBe(403);
  });

  // Define a single test case and its expectations.
  test('requirePermission denies missing permission', async () => {
    // Create the app constant.
    const app = createAuthTestApp(
      {
        // Provide the is logged in field value.
        isLoggedIn: true,
        // Provide the user field value.
        user: {
          // Provide the role field value.
          role: 'staff',
          // Provide the roles field value.
          roles: ['driver'],
          // Provide the permissions field value.
          permissions: ['can_view_reservations_ops'],
        },
      },
      // Continue the surrounding logic with this statement.
      (app) => {
        // Call app.get to perform this step.
        app.get('/x', requirePermission('can_manage_users'), (_req, res) =>
          // Call res.json to perform this step.
          res.json({ ok: true })
        );
      }
    );
    // Create the response constant.
    const response = await request(app).get('/x');
    // Assert that the value matches the intended expectation.
    expect(response.status).toBe(403);
  });

  // Define a single test case and its expectations.
  test('requirePermission allows matching permission', async () => {
    // Create the app constant.
    const app = createAuthTestApp(
      {
        // Provide the is logged in field value.
        isLoggedIn: true,
        // Provide the user field value.
        user: {
          // Provide the role field value.
          role: 'staff',
          // Provide the roles field value.
          roles: ['receptionist'],
          // Provide the permissions field value.
          permissions: ['can_view_orders', 'can_edit_orders'],
        },
      },
      // Continue the surrounding logic with this statement.
      (app) => {
        // Call app.get to perform this step.
        app.get('/x', requirePermission('can_view_orders'), (_req, res) =>
          // Call res.json to perform this step.
          res.json({ ok: true })
        );
      }
    );
    // Create the response constant.
    const response = await request(app).get('/x');
    // Assert that the value matches the intended expectation.
    expect(response.status).toBe(200);
  });

  // Define a single test case and its expectations.
  test('owner role bypasses permission checks', async () => {
    // Create the app constant.
    const app = createAuthTestApp(
      {
        // Provide the is logged in field value.
        isLoggedIn: true,
        // Provide the user field value.
        user: {
          // Provide the role field value.
          role: 'admin',
          // Provide the roles field value.
          roles: ['owner'],
          // Provide the permissions field value.
          permissions: [],
        },
      },
      // Continue the surrounding logic with this statement.
      (app) => {
        // Call app.get to perform this step.
        app.get('/x', requirePermission('can_manage_users'), (_req, res) =>
          // Call res.json to perform this step.
          res.json({ ok: true })
        );
      }
    );
    // Create the response constant.
    const response = await request(app).get('/x');
    // Assert that the value matches the intended expectation.
    expect(response.status).toBe(200);
  });

  // Define a single test case and its expectations.
  test('requireAnyPermission allows if any key matches', async () => {
    // Create the app constant.
    const app = createAuthTestApp(
      {
        // Provide the is logged in field value.
        isLoggedIn: true,
        // Provide the user field value.
        user: {
          // Provide the role field value.
          role: 'staff',
          // Provide the roles field value.
          roles: ['accountant'],
          // Provide the permissions field value.
          permissions: ['can_view_revenue'],
        },
      },
      // Continue the surrounding logic with this statement.
      (app) => {
        // Call app.get to perform this step.
        app.get(
          // Supply the literal value used by the enclosing expression.
          '/x',
          // Call requireAnyPermission to perform this step.
          requireAnyPermission(['can_manage_payments_monitor', 'can_view_revenue']),
          // Continue the surrounding logic with this statement.
          (_req, res) => res.json({ ok: true })
        );
      }
    );
    // Create the response constant.
    const response = await request(app).get('/x');
    // Assert that the value matches the intended expectation.
    expect(response.status).toBe(200);
  });
});
