// Contribute this line to the enclosing declaration or statement.
import type { APIRequestContext } from '@playwright/test';
// Import bcrypt from 'bcrypt'.
import bcrypt from 'bcrypt';
// Import named exports from './db'.
import { withDb } from './db';
// Import named exports from './test-env'.
import { ADMIN_EMAIL } from './test-env';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  apiGet,
  // Contribute this line to the enclosing declaration or statement.
  apiPatch,
  // Contribute this line to the enclosing declaration or statement.
  apiPost,
  // Contribute this line to the enclosing declaration or statement.
  apiPut,
  // Contribute this line to the enclosing declaration or statement.
  loginAsAdmin,
  // Contribute this line to the enclosing declaration or statement.
  loginApi,
  // Declare the ApiSession TypeScript type alias.
  type ApiSession,
// Contribute this line to the enclosing declaration or statement.
} from './csrf';

// Export the staff role slugs const.
export const STAFF_ROLE_SLUGS = [
  // Supply the literal value used by the enclosing expression.
  'owner',
  // Supply the literal value used by the enclosing expression.
  'manager',
  // Supply the literal value used by the enclosing expression.
  'receptionist',
  // Supply the literal value used by the enclosing expression.
  'driver',
  // Supply the literal value used by the enclosing expression.
  'cleaner',
  // Supply the literal value used by the enclosing expression.
  'accountant',
  // Supply the literal value used by the enclosing expression.
  'support',
// Apply the TypeScript type assertion for this value.
] as const;

// Export the staff role slug type.
export type StaffRoleSlug = (typeof STAFF_ROLE_SLUGS)[number];

// Export the staff password const.
export const STAFF_PASSWORD = 'Staff123!';

// Export the test staff user type.
export type TestStaffUser = {
  // Provide the user id field value.
  userId: number;
  // Provide the email field value.
  email: string;
  // Provide the password field value.
  password: string;
  // Provide the role slug field value.
  roleSlug: StaffRoleSlug;
};

// Export the uniqueStaffEmail function.
export function uniqueStaffEmail(roleSlug: string): string {
  // Create the rand constant.
  const rand = Math.random().toString(36).slice(2, 8);
  // Return the resulting value to the caller.
  return `e2e-${roleSlug}-${Date.now()}-${rand}@example.com`;
}

// Export the async getRoleBySlug function.
export async function getRoleBySlug(
  // Provide the slug field value.
  slug: string
// Continue the surrounding logic with this statement.
): Promise<{ id: number; slug: string; name: string } | null> {
  // Return the resulting value to the caller.
  return withDb(async (client) => {
    // Create the result constant.
    const result = await client.query(
      // Continue the surrounding logic with this statement.
      `SELECT id, slug, name FROM roles WHERE slug = $1 LIMIT 1`,
      // Contribute this line to the enclosing declaration or statement.
      [slug]
    );
    // Evaluate the condition and enter the branch when it is true.
    if (!result.rows[0]) return null;
    // Return the resulting value to the caller.
    return {
      // Provide the id field value.
      id: Number(result.rows[0].id),
      // Provide the slug field value.
      slug: String(result.rows[0].slug),
      // Provide the name field value.
      name: String(result.rows[0].name),
    };
  });
}

// Export the async insertTestStaff function.
export async function insertTestStaff(options: {
  // Provide the role slug field value.
  roleSlug: StaffRoleSlug;
  // Contribute this line to the enclosing declaration or statement.
  email?: string;
  // Contribute this line to the enclosing declaration or statement.
  password?: string;
// Continue the surrounding logic with this statement.
}): Promise<TestStaffUser> {
  // Create the email constant.
  const email = (options.email || uniqueStaffEmail(options.roleSlug)).toLowerCase();
  // Create the password constant.
  const password = options.password || STAFF_PASSWORD;
  // Create the hashed password constant.
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create the user id constant.
  const userId = await withDb(async (client) => {
    // Create the role constant.
    const role = await client.query(`SELECT id FROM roles WHERE slug = $1 LIMIT 1`, [
      // Contribute this line to the enclosing declaration or statement.
      options.roleSlug,
    ]);
    // Evaluate the condition and enter the branch when it is true.
    if (!role.rows[0]) {
      // Throw an error to stop the current control flow.
      throw new Error(`insertTestStaff: role slug not found: ${options.roleSlug}`);
    }
    // Create the role id constant.
    const roleId = Number(role.rows[0].id);

    // Create the existing constant.
    const existing = await client.query(`SELECT id FROM users WHERE LOWER(email) = $1`, [email]);
    // Contribute this line to the enclosing declaration or statement.
    let id: number;
    // Create the legacy role constant.
    const legacyRole = options.roleSlug === 'owner' ? 'admin' : 'staff';
    // Evaluate the condition and enter the branch when it is true.
    if (existing.rows[0]) {
      // Update id with the right-hand side value.
      id = Number(existing.rows[0].id);
      // Wait until the asynchronous operation resolves.
      await client.query(
        // Continue the surrounding logic with this statement.
        `UPDATE users SET password = $2, role = $3, updated_at = NOW() WHERE id = $1`,
        // Contribute this line to the enclosing declaration or statement.
        [id, hashedPassword, legacyRole]
      );
      // Wait until the asynchronous operation resolves.
      await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [id]);
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // Create the inserted constant.
      const inserted = await client.query(
        // Continue the surrounding logic with this statement.
        `INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id`,
        // Contribute this line to the enclosing declaration or statement.
        [email, hashedPassword, legacyRole]
      );
      // Update id with the right-hand side value.
      id = Number(inserted.rows[0].id);
    }

    // Wait until the asynchronous operation resolves.
    await client.query(
      // Continue the surrounding logic with this statement.
      `
      INSERT INTO user_roles (user_id, role_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, role_id) DO NOTHING
      `,
      // Contribute this line to the enclosing declaration or statement.
      [id, roleId]
    );

    // Return the resulting value to the caller.
    return id;
  });

  // Return the resulting value to the caller.
  return { userId, email, password, roleSlug: options.roleSlug };
}

// Export the async setUserRoleSlugs function.
export async function setUserRoleSlugs(userId: number, slugs: string[]): Promise<void> {
  // Wait until the asynchronous operation resolves.
  await withDb(async (client) => {
    // Create the roles constant.
    const roles = await client.query(`SELECT id, slug FROM roles WHERE slug = ANY($1::text[])`, [
      // Contribute this line to the enclosing declaration or statement.
      slugs,
    ]);
    // Evaluate the condition and enter the branch when it is true.
    if (roles.rows.length !== slugs.length) {
      // Throw an error to stop the current control flow.
      throw new Error(`setUserRoleSlugs: missing roles for ${slugs.join(',')}`);
    }
    // Wait until the asynchronous operation resolves.
    await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
    // Iterate using the loop initializer, condition, and step.
    for (const row of roles.rows) {
      // Wait until the asynchronous operation resolves.
      await client.query(
        // Continue the surrounding logic with this statement.
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        // Continue the surrounding logic with this statement.
        [userId, Number(row.id)]
      );
    }
  });
}

// Export the async cleanupTestStaff function.
export async function cleanupTestStaff(email: string): Promise<void> {
  // Create the normalized constant.
  const normalized = email.toLowerCase();
  // Evaluate the condition and enter the branch when it is true.
  if (normalized === ADMIN_EMAIL.toLowerCase()) {
    // Throw an error to stop the current control flow.
    throw new Error('cleanupTestStaff: refusing to delete sole owner admin email');
  }

  // Wait until the asynchronous operation resolves.
  await withDb(async (client) => {
    // Create the user constant.
    const user = await client.query(`SELECT id FROM users WHERE LOWER(email) = $1`, [normalized]);
    // Evaluate the condition and enter the branch when it is true.
    if (!user.rows[0]) return;
    // Create the user id constant.
    const userId = Number(user.rows[0].id);

    // Create the owner check constant.
    const ownerCheck = await client.query(
      // Continue the surrounding logic with this statement.
      `
      SELECT COUNT(*)::int AS owners
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE r.slug = 'owner'
      `
    );
    // Create the is owner constant.
    const isOwner = await client.query(
      // Continue the surrounding logic with this statement.
      `
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1 AND r.slug = 'owner'
      LIMIT 1
      `,
      // Contribute this line to the enclosing declaration or statement.
      [userId]
    );
    // Evaluate the condition and enter the branch when it is true.
    if (isOwner.rows[0] && Number(ownerCheck.rows[0].owners) <= 1) {
      // Throw an error to stop the current control flow.
      throw new Error('cleanupTestStaff: refusing to delete the last owner');
    }

    // Wait until the asynchronous operation resolves.
    await client.query(
      // Continue the surrounding logic with this statement.
      `DELETE FROM calendar_tasks WHERE assigned_to_user_id = $1 OR created_by_user_id = $1`,
      // Contribute this line to the enclosing declaration or statement.
      [userId]
    );
    // Wait until the asynchronous operation resolves.
    await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
    // Wait until the asynchronous operation resolves.
    await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
  });
}

// Export the async loginAsStaff function.
export async function loginAsStaff(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the staff field value.
  staff: Pick<TestStaffUser, 'email' | 'password'>
// Continue the surrounding logic with this statement.
): Promise<ApiSession> {
  // Return the resulting value to the caller.
  return loginApi(request, { email: staff.email, password: staff.password });
}

// Export the async putUserRolesViaApi function.
export async function putUserRolesViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the user id field value.
  userId: number | string,
  // Provide the role ids field value.
  roleIds: Array<number | string>,
  // Contribute this line to the enclosing declaration or statement.
  session?: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ ok: boolean; status: number; body: any }> {
  // Create the auth constant.
  const auth = session || (await loginAsAdmin(request));
  // Create the res constant.
  const res = await apiPut(
    // Contribute this line to the enclosing declaration or statement.
    request,
    // Continue the surrounding logic with this statement.
    `/api/admin/users/${userId}/roles`,
    // Continue the surrounding logic with this statement.
    { roleIds: roleIds.map(String) },
    // Reference the identifier used by the enclosing expression.
    auth
  );
  // Return the resulting value to the caller.
  return { ok: res.ok(), status: res.status(), body: await safeJson(res) };
}

// Export the async createStaffUserViaApi function.
export async function createStaffUserViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the body field value.
  body: { email: string; password: string; roleIds: Array<number | string> },
  // Contribute this line to the enclosing declaration or statement.
  session?: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ ok: boolean; status: number; body: any }> {
  // Create the auth constant.
  const auth = session || (await loginAsAdmin(request));
  // Create the res constant.
  const res = await apiPost(
    // Contribute this line to the enclosing declaration or statement.
    request,
    // Supply the literal value used by the enclosing expression.
    '/api/admin/users',
    // Continue the surrounding logic with this statement.
    { ...body, roleIds: body.roleIds.map(String) },
    // Reference the identifier used by the enclosing expression.
    auth
  );
  // Return the resulting value to the caller.
  return { ok: res.ok(), status: res.status(), body: await safeJson(res) };
}

// Export the async updateRolePermissionsViaApi function.
export async function updateRolePermissionsViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the role id field value.
  roleId: number | string,
  // Provide the permission keys field value.
  permissionKeys: string[],
  // Contribute this line to the enclosing declaration or statement.
  session?: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ ok: boolean; status: number; body: any }> {
  // Create the auth constant.
  const auth = session || (await loginAsAdmin(request));
  // Create the res constant.
  const res = await apiPut(
    // Contribute this line to the enclosing declaration or statement.
    request,
    // Continue the surrounding logic with this statement.
    `/api/admin/rbac/roles/${roleId}/permissions`,
    // Contribute this line to the enclosing declaration or statement.
    { permissionKeys },
    // Reference the identifier used by the enclosing expression.
    auth
  );
  // Return the resulting value to the caller.
  return { ok: res.ok(), status: res.status(), body: await safeJson(res) };
}

/** Current permission keys for a role from the RBAC catalog. */
export async function getRolePermissionKeysViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the role id field value.
  roleId: number | string,
  // Contribute this line to the enclosing declaration or statement.
  session?: ApiSession
// Continue the surrounding logic with this statement.
): Promise<string[]> {
  // Create the auth constant.
  const auth = session || (await loginAsAdmin(request));
  // Create the res constant.
  const res = await apiGet(request, '/api/admin/rbac', auth);
  // Create the body constant.
  const body = await safeJson(res);
  // Create the matrix constant.
  const matrix = (body?.data?.matrix || body?.matrix || []) as Array<{
    // Provide the role id field value.
    roleId: string | number;
    // Contribute this line to the enclosing declaration or statement.
    permissionKeys?: string[];
  // Continue the surrounding logic with this statement.
  }>;
  // Create the entry constant.
  const entry = matrix.find((m) => String(m.roleId) === String(roleId));
  // Return the resulting value to the caller.
  return [...(entry?.permissionKeys || [])];
}

// Export the async createCalendarTaskViaApi function.
export async function createCalendarTaskViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the body field value.
  body: {
    // Provide the title field value.
    title: string;
    // Provide the task type field value.
    taskType: string;
    // Contribute this line to the enclosing declaration or statement.
    carId?: number | null;
    // Contribute this line to the enclosing declaration or statement.
    reservationId?: number | null;
    // Contribute this line to the enclosing declaration or statement.
    assignedToUserId?: number | null;
    // Contribute this line to the enclosing declaration or statement.
    startsAt?: string | null;
    // Contribute this line to the enclosing declaration or statement.
    dueAt?: string | null;
    // Contribute this line to the enclosing declaration or statement.
    notes?: string;
    // Contribute this line to the enclosing declaration or statement.
    locationText?: string;
  },
  // Contribute this line to the enclosing declaration or statement.
  session?: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ ok: boolean; status: number; body: any; taskId: number | null }> {
  // Create the auth constant.
  const auth = session || (await loginAsAdmin(request));
  // Create the res constant.
  const res = await apiPost(request, '/api/admin/calendar/tasks', body, auth);
  // Create the json constant.
  const json = await safeJson(res);
  // Create the raw id constant.
  const rawId = json?.data?.event?.id || json?.data?.id;
  // Continue the surrounding logic with this statement.
  let taskId: number | null = null;
  // Evaluate the condition and enter the branch when it is true.
  if (typeof rawId === 'string' && rawId.startsWith('task:')) {
    // Update taskId with the right-hand side value.
    taskId = Number(rawId.split(':')[1]);
  // Continue the surrounding logic with this statement.
  } else if (typeof rawId === 'number') {
    // Update taskId with the right-hand side value.
    taskId = rawId;
  // Continue the surrounding logic with this statement.
  } else if (json?.data?.event?.meta?.taskId) {
    // Update taskId with the right-hand side value.
    taskId = Number(json.data.event.meta.taskId);
  }
  // Return the resulting value to the caller.
  return { ok: res.ok(), status: res.status(), body: json, taskId };
}

// Export the async updateTaskStatusViaApi function.
export async function updateTaskStatusViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the task id field value.
  taskId: number | string,
  // Provide the status field value.
  status: string,
  // Provide the session field value.
  session: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ ok: boolean; status: number; body: any }> {
  // Create the res constant.
  const res = await apiPatch(
    // Contribute this line to the enclosing declaration or statement.
    request,
    // Continue the surrounding logic with this statement.
    `/api/admin/calendar/tasks/${taskId}/status`,
    // Contribute this line to the enclosing declaration or statement.
    { status },
    // Reference the identifier used by the enclosing expression.
    session
  );
  // Return the resulting value to the caller.
  return { ok: res.ok(), status: res.status(), body: await safeJson(res) };
}

// Export the async listCalendarTasksViaApi function.
export async function listCalendarTasksViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the query field value.
  query: Record<string, string>,
  // Provide the session field value.
  session: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ ok: boolean; status: number; body: any }> {
  // Create the qs constant.
  const qs = new URLSearchParams(query).toString();
  // Create the res constant.
  const res = await apiGet(request, `/api/admin/calendar/tasks?${qs}`, session);
  // Return the resulting value to the caller.
  return { ok: res.ok(), status: res.status(), body: await safeJson(res) };
}

// Define the async function safeJson.
async function safeJson(res: { json: () => Promise<any>; text: () => Promise<string> }): Promise<any> {
  // Start a try block for operations that may fail.
  try {
    // Return the resulting value to the caller.
    return await res.json();
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Return the resulting value to the caller.
    return { text: await res.text().catch(() => '') };
  }
}
