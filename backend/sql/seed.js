#!/usr/bin/env node
/**
 * Seeds demo data and development users.
 * Usage: node sql/seed.js
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const pool = require('../src/db/pool');
const userSql = require('../src/services/sql/userSqlService');
const { requireDatabaseUrl } = require('./dbCliUtils');

const DEMO_DATA_SQL = path.join(__dirname, 'seed', 'demo-data.sql');

const DEFAULTS = {
  adminEmail: 'admin@luxride.local',
  adminPassword: 'Admin123!',
  demoUserEmail: 'demo@luxride.local',
  demoUserPassword: 'Demo123!',
};

function getSeedConfig() {
  return {
    adminEmail: process.env.SEED_ADMIN_EMAIL || DEFAULTS.adminEmail,
    adminPassword: process.env.SEED_ADMIN_PASSWORD || DEFAULTS.adminPassword,
    demoUserEmail: process.env.SEED_DEMO_USER_EMAIL || DEFAULTS.demoUserEmail,
    demoUserPassword: process.env.SEED_DEMO_USER_PASSWORD || DEFAULTS.demoUserPassword,
  };
}

async function seedUser({ email, password, role }) {
  const existing = await userSql.findUserByEmail(email);
  if (existing) {
    console.log(`⊘ skip user ${email} (already exists)`);
    return existing;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await userSql.createUser({
    email,
    password: hashedPassword,
    role,
    emailVerifiedAt: new Date(),
  });

  console.log(`→ created ${role} user ${email}`);
  return user;
}

async function seed({ endPool = true } = {}) {
  requireDatabaseUrl();

  const config = getSeedConfig();
  const sql = fs.readFileSync(DEMO_DATA_SQL, 'utf8');

  const client = await pool.connect();

  try {
    console.log('→ demo-data.sql');
    await client.query(sql);
    console.log('✓ Demo data seeded');

    await seedUser({
      email: config.adminEmail,
      password: config.adminPassword,
      role: 'admin',
    });

    await seedUser({
      email: config.demoUserEmail,
      password: config.demoUserPassword,
      role: 'user',
    });

    const { seedOpsLifecycle } = require('./seedOpsLifecycle');
    await seedOpsLifecycle({ endPool: false });

    const { seedFleetAlerts } = require('./seedFleetAlerts');
    await seedFleetAlerts({ endPool: false });

    const { seedCustomerPortal } = require('./seedCustomerPortal');
    await seedCustomerPortal({ endPool: false });

    const { seedStaffTasks } = require('./seedStaffTasks');
    await seedStaffTasks({ endPool: false });

    console.log('✓ Seed complete');
    console.log('');
    console.log('Demo credentials:');
    console.log(`  Admin: ${config.adminEmail} / ${config.adminPassword}`);
    console.log(`  User:  ${config.demoUserEmail} / ${config.demoUserPassword}`);
    console.log('  Portal:/account (demo user reservations, docs, PDFs)');
    console.log('  Ops:   /admin/reservations (lifecycle + checklists + cancel requests)');
    console.log('  Fleet: /admin/fleet-alerts (compliance + damage alerts)');
    console.log('  Tasks: /admin/tasks (staff dashboards; see seedStaffTasks output)');
    console.log('         driver@ / cleaner@ / receptionist@ / manager@luxride.local — Staff123!');
  } finally {
    client.release();
    if (endPool) {
      await pool.end();
    }
  }
}

if (require.main === module) {
  seed().catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  });
}

module.exports = { seed, getSeedConfig };
