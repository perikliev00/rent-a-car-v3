import type { APIRequestContext } from '@playwright/test';
import bcrypt from 'bcrypt';
import { withDb } from './db';
import { ADMIN_EMAIL } from './test-env';
import {
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  loginAsAdmin,
  loginApi,
  type ApiSession,
} from './csrf';

export const STAFF_ROLE_SLUGS = [
  'owner',
  'manager',
  'receptionist',
  'driver',
  'cleaner',
  'accountant',
  'support',
] as const;

export type StaffRoleSlug = (typeof STAFF_ROLE_SLUGS)[number];

export const STAFF_PASSWORD = 'Staff123!';

export type TestStaffUser = {
  userId: number;
  email: string;
  password: string;
  roleSlug: StaffRoleSlug;
};

export function uniqueStaffEmail(roleSlug: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `e2e-${roleSlug}-${Date.now()}-${rand}@example.com`;
}

export async function getRoleBySlug(
  slug: string
): Promise<{ id: number; slug: string; name: string } | null> {
  return withDb(async (client) => {
    const result = await client.query(
      `SELECT id, slug, name FROM roles WHERE slug = $1 LIMIT 1`,
      [slug]
    );
    if (!result.rows[0]) return null;
    return {
      id: Number(result.rows[0].id),
      slug: String(result.rows[0].slug),
      name: String(result.rows[0].name),
    };
  });
}

export async function insertTestStaff(options: {
  roleSlug: StaffRoleSlug;
  email?: string;
  password?: string;
}): Promise<TestStaffUser> {
  const email = (options.email || uniqueStaffEmail(options.roleSlug)).toLowerCase();
  const password = options.password || STAFF_PASSWORD;
  const hashedPassword = await bcrypt.hash(password, 10);

  const userId = await withDb(async (client) => {
    const role = await client.query(`SELECT id FROM roles WHERE slug = $1 LIMIT 1`, [
      options.roleSlug,
    ]);
    if (!role.rows[0]) {
      throw new Error(`insertTestStaff: role slug not found: ${options.roleSlug}`);
    }
    const roleId = Number(role.rows[0].id);

    const existing = await client.query(`SELECT id FROM users WHERE LOWER(email) = $1`, [email]);
    let id: number;
    const legacyRole = options.roleSlug === 'owner' ? 'admin' : 'staff';
    if (existing.rows[0]) {
      id = Number(existing.rows[0].id);
      await client.query(
        `UPDATE users
         SET password = $2,
             role = $3,
             email_verified_at = COALESCE(email_verified_at, NOW()),
             updated_at = NOW()
         WHERE id = $1`,
        [id, hashedPassword, legacyRole]
      );
      await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [id]);
    } else {
      const inserted = await client.query(
        `INSERT INTO users (email, password, role, email_verified_at)
         VALUES ($1, $2, $3, NOW()) RETURNING id`,
        [email, hashedPassword, legacyRole]
      );
      id = Number(inserted.rows[0].id);
    }

    await client.query(
      `
      INSERT INTO user_roles (user_id, role_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, role_id) DO NOTHING
      `,
      [id, roleId]
    );

    return id;
  });

  return { userId, email, password, roleSlug: options.roleSlug };
}

export async function setUserRoleSlugs(userId: number, slugs: string[]): Promise<void> {
  await withDb(async (client) => {
    const roles = await client.query(`SELECT id, slug FROM roles WHERE slug = ANY($1::text[])`, [
      slugs,
    ]);
    if (roles.rows.length !== slugs.length) {
      throw new Error(`setUserRoleSlugs: missing roles for ${slugs.join(',')}`);
    }
    await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
    for (const row of roles.rows) {
      await client.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, Number(row.id)]
      );
    }
  });
}

export async function cleanupTestStaff(email: string): Promise<void> {
  const normalized = email.toLowerCase();
  if (normalized === ADMIN_EMAIL.toLowerCase()) {
    throw new Error('cleanupTestStaff: refusing to delete sole owner admin email');
  }

  await withDb(async (client) => {
    const user = await client.query(`SELECT id FROM users WHERE LOWER(email) = $1`, [normalized]);
    if (!user.rows[0]) return;
    const userId = Number(user.rows[0].id);

    const ownerCheck = await client.query(
      `
      SELECT COUNT(*)::int AS owners
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE r.slug = 'owner'
      `
    );
    const isOwner = await client.query(
      `
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1 AND r.slug = 'owner'
      LIMIT 1
      `,
      [userId]
    );
    if (isOwner.rows[0] && Number(ownerCheck.rows[0].owners) <= 1) {
      throw new Error('cleanupTestStaff: refusing to delete the last owner');
    }

    await client.query(
      `DELETE FROM calendar_tasks WHERE assigned_to_user_id = $1 OR created_by_user_id = $1`,
      [userId]
    );
    await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
  });
}

export async function loginAsStaff(
  request: APIRequestContext,
  staff: Pick<TestStaffUser, 'email' | 'password'>
): Promise<ApiSession> {
  return loginApi(request, { email: staff.email, password: staff.password });
}

export async function putUserRolesViaApi(
  request: APIRequestContext,
  userId: number | string,
  roleIds: Array<number | string>,
  session?: ApiSession
): Promise<{ ok: boolean; status: number; body: any }> {
  const auth = session || (await loginAsAdmin(request));
  const res = await apiPut(
    request,
    `/api/admin/users/${userId}/roles`,
    { roleIds: roleIds.map(String) },
    auth
  );
  return { ok: res.ok(), status: res.status(), body: await safeJson(res) };
}

export async function createStaffUserViaApi(
  request: APIRequestContext,
  body: { email: string; password: string; roleIds: Array<number | string> },
  session?: ApiSession
): Promise<{ ok: boolean; status: number; body: any }> {
  const auth = session || (await loginAsAdmin(request));
  const res = await apiPost(
    request,
    '/api/admin/users',
    { ...body, roleIds: body.roleIds.map(String) },
    auth
  );
  return { ok: res.ok(), status: res.status(), body: await safeJson(res) };
}

export async function updateRolePermissionsViaApi(
  request: APIRequestContext,
  roleId: number | string,
  permissionKeys: string[],
  session?: ApiSession
): Promise<{ ok: boolean; status: number; body: any }> {
  const auth = session || (await loginAsAdmin(request));
  const res = await apiPut(
    request,
    `/api/admin/rbac/roles/${roleId}/permissions`,
    { permissionKeys },
    auth
  );
  return { ok: res.ok(), status: res.status(), body: await safeJson(res) };
}

/** Current permission keys for a role from the RBAC catalog. */
export async function getRolePermissionKeysViaApi(
  request: APIRequestContext,
  roleId: number | string,
  session?: ApiSession
): Promise<string[]> {
  const auth = session || (await loginAsAdmin(request));
  const res = await apiGet(request, '/api/admin/rbac', auth);
  const body = await safeJson(res);
  const matrix = (body?.data?.matrix || body?.matrix || []) as Array<{
    roleId: string | number;
    permissionKeys?: string[];
  }>;
  const entry = matrix.find((m) => String(m.roleId) === String(roleId));
  return [...(entry?.permissionKeys || [])];
}

export async function createCalendarTaskViaApi(
  request: APIRequestContext,
  body: {
    title: string;
    taskType: string;
    carId?: number | null;
    reservationId?: number | null;
    assignedToUserId?: number | null;
    startsAt?: string | null;
    dueAt?: string | null;
    notes?: string;
    locationText?: string;
  },
  session?: ApiSession
): Promise<{ ok: boolean; status: number; body: any; taskId: number | null }> {
  const auth = session || (await loginAsAdmin(request));
  const res = await apiPost(request, '/api/admin/calendar/tasks', body, auth);
  const json = await safeJson(res);
  const rawId = json?.data?.event?.id || json?.data?.id;
  let taskId: number | null = null;
  if (typeof rawId === 'string' && rawId.startsWith('task:')) {
    taskId = Number(rawId.split(':')[1]);
  } else if (typeof rawId === 'number') {
    taskId = rawId;
  } else if (json?.data?.event?.meta?.taskId) {
    taskId = Number(json.data.event.meta.taskId);
  }
  return { ok: res.ok(), status: res.status(), body: json, taskId };
}

export async function updateTaskStatusViaApi(
  request: APIRequestContext,
  taskId: number | string,
  status: string,
  session: ApiSession
): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await apiPatch(
    request,
    `/api/admin/calendar/tasks/${taskId}/status`,
    { status },
    session
  );
  return { ok: res.ok(), status: res.status(), body: await safeJson(res) };
}

export async function listCalendarTasksViaApi(
  request: APIRequestContext,
  query: Record<string, string>,
  session: ApiSession
): Promise<{ ok: boolean; status: number; body: any }> {
  const qs = new URLSearchParams(query).toString();
  const res = await apiGet(request, `/api/admin/calendar/tasks?${qs}`, session);
  return { ok: res.ok(), status: res.status(), body: await safeJson(res) };
}

async function safeJson(res: { json: () => Promise<any>; text: () => Promise<string> }): Promise<any> {
  try {
    return await res.json();
  } catch {
    return { text: await res.text().catch(() => '') };
  }
}
