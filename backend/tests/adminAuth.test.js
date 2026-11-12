const express = require('express');
const session = require('express-session');
const request = require('supertest');
const {
  requireAdminApi,
  requireStaffApi,
  requirePermission,
  requireAnyPermission,
} = require('../src/middleware/auth');

function createAuthTestApp(sessionSeed = {}, mount) {
  const app = express();
  app.use(
    session({
      secret: 'test-session-secret',
      resave: false,
      saveUninitialized: false,
      store: new session.MemoryStore(),
    })
  );
  app.use((req, _res, next) => {
    Object.assign(req.session, sessionSeed);
    next();
  });
  mount(app);
  return app;
}

describe('RBAC auth middleware', () => {
  test('requireStaffApi returns 401 when logged out', async () => {
    const app = createAuthTestApp({}, (app) => {
      app.get('/x', requireStaffApi, (_req, res) => res.json({ ok: true }));
    });
    const response = await request(app).get('/x');
    expect(response.status).toBe(401);
  });

  test('requireStaffApi denies customer without roles', async () => {
    const app = createAuthTestApp(
      { isLoggedIn: true, user: { role: 'user', roles: [], permissions: [] } },
      (app) => {
        app.get('/x', requireStaffApi, (_req, res) => res.json({ ok: true }));
      }
    );
    const response = await request(app).get('/x');
    expect(response.status).toBe(403);
  });

  test('requireStaffApi allows staff with roles', async () => {
    const app = createAuthTestApp(
      {
        isLoggedIn: true,
        user: { role: 'staff', roles: ['driver'], permissions: ['can_view_own_calendar_tasks'] },
      },
      (app) => {
        app.get('/x', requireStaffApi, (_req, res) => res.json({ ok: true }));
      }
    );
    const response = await request(app).get('/x');
    expect(response.status).toBe(200);
  });

  test('requireAdminApi denies legacy admin without RBAC roles', async () => {
    const app = createAuthTestApp(
      { isLoggedIn: true, user: { role: 'admin', email: 'admin@example.com', roles: [], permissions: [] } },
      (app) => {
        app.get('/x', requireAdminApi, (_req, res) => res.json({ ok: true }));
      }
    );
    const response = await request(app).get('/x');
    expect(response.status).toBe(403);
  });

  test('requireStaffApi denies stale staff role without RBAC roles', async () => {
    const app = createAuthTestApp(
      {
        isLoggedIn: true,
        user: { role: 'staff', email: 'ex@example.com', roles: [], permissions: [] },
      },
      (app) => {
        app.get('/x', requireStaffApi, (_req, res) => res.json({ ok: true }));
      }
    );
    const response = await request(app).get('/x');
    expect(response.status).toBe(403);
  });

  test('requirePermission denies missing permission', async () => {
    const app = createAuthTestApp(
      {
        isLoggedIn: true,
        user: {
          role: 'staff',
          roles: ['driver'],
          permissions: ['can_view_reservations_ops'],
        },
      },
      (app) => {
        app.get('/x', requirePermission('can_manage_users'), (_req, res) =>
          res.json({ ok: true })
        );
      }
    );
    const response = await request(app).get('/x');
    expect(response.status).toBe(403);
  });

  test('requirePermission allows matching permission', async () => {
    const app = createAuthTestApp(
      {
        isLoggedIn: true,
        user: {
          role: 'staff',
          roles: ['receptionist'],
          permissions: ['can_view_orders', 'can_edit_orders'],
        },
      },
      (app) => {
        app.get('/x', requirePermission('can_view_orders'), (_req, res) =>
          res.json({ ok: true })
        );
      }
    );
    const response = await request(app).get('/x');
    expect(response.status).toBe(200);
  });

  test('owner role bypasses permission checks', async () => {
    const app = createAuthTestApp(
      {
        isLoggedIn: true,
        user: {
          role: 'admin',
          roles: ['owner'],
          permissions: [],
        },
      },
      (app) => {
        app.get('/x', requirePermission('can_manage_users'), (_req, res) =>
          res.json({ ok: true })
        );
      }
    );
    const response = await request(app).get('/x');
    expect(response.status).toBe(200);
  });

  test('requireAnyPermission allows if any key matches', async () => {
    const app = createAuthTestApp(
      {
        isLoggedIn: true,
        user: {
          role: 'staff',
          roles: ['accountant'],
          permissions: ['can_view_revenue'],
        },
      },
      (app) => {
        app.get(
          '/x',
          requireAnyPermission(['can_manage_payments_monitor', 'can_view_revenue']),
          (_req, res) => res.json({ ok: true })
        );
      }
    );
    const response = await request(app).get('/x');
    expect(response.status).toBe(200);
  });
});
