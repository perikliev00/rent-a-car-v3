#!/usr/bin/env node
/**
 * Seeds staff users (driver/cleaner/receptionist/manager) + calendar_tasks samples.
 * Idempotent: removes previous seed tasks by title prefix and recreates users' roles.
 *
 * Usage: node sql/seedStaffTasks.js
 *        npm run db:seed:tasks
 */
require('dotenv').config();

const bcrypt = require('bcrypt');
const pool = require('../src/db/pool');
const userSql = require('../src/services/sql/userSqlService');
const userRoleSql = require('../src/services/sql/userRoleSqlService');
const { requireDatabaseUrl } = require('./dbCliUtils');

const TITLE_PREFIX = '[Seed]';
const PASSWORD = 'Staff123!';

const STAFF = [
  { email: 'driver@luxride.local', roleSlug: 'driver', label: 'Driver' },
  { email: 'cleaner@luxride.local', roleSlug: 'cleaner', label: 'Cleaner' },
  { email: 'receptionist@luxride.local', roleSlug: 'receptionist', label: 'Receptionist' },
  { email: 'manager@luxride.local', roleSlug: 'manager', label: 'Manager' },
];

async function ensureStaffUser(email) {
  let user = await userSql.findUserByEmail(email);
  if (!user) {
    const hashed = await bcrypt.hash(PASSWORD, 10);
    user = await userSql.createUser({
      email,
      password: hashed,
      role: 'staff',
    });
    console.log(`→ created staff user ${email}`);
  } else {
    console.log(`⊘ skip user ${email} (already exists)`);
  }
  return user;
}

async function assignRoleBySlug(userId, slug, client) {
  const roleRes = await client.query(`SELECT id FROM roles WHERE slug = $1 LIMIT 1`, [slug]);
  const roleId = roleRes.rows[0]?.id;
  if (!roleId) {
    throw new Error(`Role not found: ${slug}`);
  }
  await userRoleSql.replaceUserRoles(userId, [roleId], null, client);
}

async function clearPreviousTasks(client) {
  await client.query(`DELETE FROM calendar_tasks WHERE title LIKE $1`, [`${TITLE_PREFIX}%`]);
}

async function pickCars(client) {
  const result = await client.query(
    `
    SELECT id, name
    FROM cars
    WHERE is_deleted = FALSE
    ORDER BY id ASC
    LIMIT 5
    `
  );
  return result.rows;
}

async function pickReservation(client, carId) {
  const result = await client.query(
    `
    SELECT id
    FROM reservations
    WHERE car_id = $1
      AND status NOT IN ('cancelled', 'expired', 'refunded')
    ORDER BY pickup_date DESC
    LIMIT 1
    `,
    [carId]
  );
  return result.rows[0]?.id || null;
}

async function insertTask(client, row) {
  await client.query(
    `
    INSERT INTO calendar_tasks (
      car_id, reservation_id, task_type, title, notes, location_text,
      starts_at, due_at, status, assigned_to_user_id, created_by_user_id, completed_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    `,
    [
      row.carId,
      row.reservationId,
      row.taskType,
      row.title,
      row.notes,
      row.locationText,
      row.startsAt,
      row.dueAt,
      row.status,
      row.assignedToUserId,
      row.createdByUserId,
      row.completedAt || null,
    ]
  );
}

function hoursFromNow(h) {
  return new Date(Date.now() + h * 60 * 60 * 1000);
}

async function seedStaffTasks({ endPool = true } = {}) {
  requireDatabaseUrl();
  const client = await pool.connect();

  try {
    // Fail fast with a clear message if migration 020 is missing
    const col = await client.query(
      `
      SELECT column_default
      FROM information_schema.columns
      WHERE table_name = 'calendar_tasks' AND column_name = 'status'
      `
    );
    if (!col.rows[0]) {
      throw new Error('calendar_tasks missing — run npm run db:migrate first');
    }

    console.log('→ staff users + calendar_tasks');
    await clearPreviousTasks(client);

    const bySlug = {};
    for (const s of STAFF) {
      const user = await ensureStaffUser(s.email);
      await assignRoleBySlug(user.id, s.roleSlug, client);
      bySlug[s.roleSlug] = user;
      console.log(`→ role ${s.roleSlug} → ${s.email}`);
    }

    // Ensure admin has owner for full task board
    const admin = await userSql.findUserByEmail(
      process.env.SEED_ADMIN_EMAIL || 'admin@luxride.local'
    );
    if (admin) {
      const ownerRes = await client.query(`SELECT id FROM roles WHERE slug = 'owner' LIMIT 1`);
      if (ownerRes.rows[0]) {
        await client.query(
          `
          INSERT INTO user_roles (user_id, role_id, assigned_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT DO NOTHING
          `,
          [admin.id, ownerRes.rows[0].id]
        );
      }
    }

    const cars = await pickCars(client);
    if (cars.length === 0) {
      throw new Error('No cars found — run npm run db:seed first');
    }

    const car0 = cars[0];
    const car1 = cars[1] || cars[0];
    const car2 = cars[2] || cars[0];
    const car3 = cars[3] || cars[0];

    const res0 = await pickReservation(client, car0.id);
    const res1 = await pickReservation(client, car1.id);

    const managerId = bySlug.manager.id;
    const driverId = bySlug.driver.id;
    const cleanerId = bySlug.cleaner.id;
    const receptionistId = bySlug.receptionist.id;

    const samples = [
      {
        carId: car0.id,
        reservationId: res0,
        taskType: 'pickup',
        title: `${TITLE_PREFIX} Airport pickup — ${car0.name}`,
        notes: 'Meet customer at Terminal 2 arrivals.',
        locationText: 'Sofia Airport T2',
        startsAt: hoursFromNow(2),
        dueAt: hoursFromNow(4),
        status: 'assigned',
        assignedToUserId: driverId,
        createdByUserId: managerId,
      },
      {
        carId: car1.id,
        reservationId: res1,
        taskType: 'delivery',
        title: `${TITLE_PREFIX} Hotel delivery — ${car1.name}`,
        notes: 'Deliver keys to reception desk.',
        locationText: 'Grand Hotel Sofia',
        startsAt: hoursFromNow(5),
        dueAt: hoursFromNow(7),
        status: 'in_progress',
        assignedToUserId: driverId,
        createdByUserId: managerId,
      },
      {
        carId: car2.id,
        reservationId: null,
        taskType: 'return',
        title: `${TITLE_PREFIX} Customer return assist — ${car2.name}`,
        notes: 'Inspect exterior on return.',
        locationText: 'Sofia Office',
        startsAt: hoursFromNow(26),
        dueAt: hoursFromNow(28),
        status: 'assigned',
        assignedToUserId: driverId,
        createdByUserId: managerId,
      },
      {
        carId: car0.id,
        reservationId: null,
        taskType: 'maintenance_dropoff',
        title: `${TITLE_PREFIX} Drop off for service — ${car0.name}`,
        notes: 'Oil change appointment.',
        locationText: 'Service center Mladost',
        startsAt: hoursFromNow(30),
        dueAt: hoursFromNow(32),
        status: 'pending',
        assignedToUserId: null,
        createdByUserId: managerId,
      },
      {
        carId: car1.id,
        reservationId: null,
        taskType: 'maintenance_pickup',
        title: `${TITLE_PREFIX} Collect from service — ${car1.name}`,
        notes: 'Ask for invoice.',
        locationText: 'Service center Mladost',
        startsAt: hoursFromNow(48),
        dueAt: hoursFromNow(50),
        status: 'pending',
        assignedToUserId: null,
        createdByUserId: managerId,
      },
      {
        carId: car2.id,
        reservationId: null,
        taskType: 'cleaning',
        title: `${TITLE_PREFIX} Full clean — ${car2.name}`,
        notes: 'Interior + exterior wash.',
        locationText: 'Wash bay',
        startsAt: hoursFromNow(1),
        dueAt: hoursFromNow(3),
        status: 'assigned',
        assignedToUserId: cleanerId,
        createdByUserId: managerId,
      },
      {
        carId: car3.id,
        reservationId: null,
        taskType: 'inspection',
        title: `${TITLE_PREFIX} Pre-rental inspection — ${car3.name}`,
        notes: 'Check tire pressure and lights.',
        locationText: 'Yard A',
        startsAt: hoursFromNow(3),
        dueAt: hoursFromNow(5),
        status: 'in_progress',
        assignedToUserId: cleanerId,
        createdByUserId: managerId,
      },
      {
        carId: car0.id,
        reservationId: res0,
        taskType: 'document_check',
        title: `${TITLE_PREFIX} Verify customer documents`,
        notes: 'License + passport before handover.',
        locationText: 'Reception',
        startsAt: hoursFromNow(1),
        dueAt: hoursFromNow(2),
        status: 'assigned',
        assignedToUserId: receptionistId,
        createdByUserId: managerId,
      },
      {
        carId: car1.id,
        reservationId: res1,
        taskType: 'pickup',
        title: `${TITLE_PREFIX} Office pickup (unassigned)`,
        notes: 'Needs a driver assigned.',
        locationText: 'Sofia Office',
        startsAt: hoursFromNow(8),
        dueAt: hoursFromNow(10),
        status: 'pending',
        assignedToUserId: null,
        createdByUserId: managerId,
      },
      {
        carId: car2.id,
        reservationId: null,
        taskType: 'cleaning',
        title: `${TITLE_PREFIX} Completed wash — ${car2.name}`,
        notes: 'Done earlier today.',
        locationText: 'Wash bay',
        startsAt: hoursFromNow(-6),
        dueAt: hoursFromNow(-4),
        status: 'completed',
        assignedToUserId: cleanerId,
        createdByUserId: managerId,
        completedAt: hoursFromNow(-3),
      },
      {
        carId: car3.id,
        reservationId: null,
        taskType: 'delivery',
        title: `${TITLE_PREFIX} Failed delivery attempt`,
        notes: 'Customer not at address.',
        locationText: '15 Demo St',
        startsAt: hoursFromNow(-10),
        dueAt: hoursFromNow(-8),
        status: 'failed',
        assignedToUserId: driverId,
        createdByUserId: managerId,
      },
    ];

    for (const row of samples) {
      await insertTask(client, row);
    }

    console.log(`✓ Seeded ${samples.length} calendar tasks`);
    console.log('');
    console.log('Staff credentials (password for all: Staff123!):');
    for (const s of STAFF) {
      console.log(`  ${s.label.padEnd(14)} ${s.email}`);
    }
    console.log('');
    console.log('Try:');
    console.log('  /admin/tasks              (admin or manager@luxride.local)');
    console.log('  /admin/tasks/driver       (driver@luxride.local)');
    console.log('  /admin/tasks/cleaner      (cleaner@luxride.local)');
    console.log('  /admin/tasks/receptionist (receptionist@luxride.local)');
    console.log('  /admin/calendar           (tasks also appear on calendar)');
  } finally {
    client.release();
    if (endPool) {
      await pool.end();
    }
  }
}

if (require.main === module) {
  seedStaffTasks().catch((err) => {
    console.error('Staff task seed failed:', err.message);
    process.exit(1);
  });
}

module.exports = { seedStaffTasks };
