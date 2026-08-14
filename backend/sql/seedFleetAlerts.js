#!/usr/bin/env node
/**
 * Idempotent fleet-alert demo fixtures (compliance + damage) and reconcile.
 * Markers use reference_number / description prefixes seed-fleet-*.
 *
 * Usage: node sql/seedFleetAlerts.js
 */
require('dotenv').config();

const pool = require('../src/db/pool');
const { requireDatabaseUrl } = require('./dbCliUtils');
const { reconcileFleetAlerts } = require('../src/services/carFleetAlertReconcileService');

const MARKER = 'seed-fleet';

const SCENARIOS = [
  {
    key: 'insurance-7d',
    carName: 'Volkswagen Golf 7',
    itemType: 'civil_insurance',
    expiresOffsetDays: 7,
    referenceNumber: `${MARKER}-insurance-7d`,
  },
  {
    key: 'insurance-expired',
    carName: 'BMW 320d',
    itemType: 'civil_insurance',
    expiresOffsetDays: -10,
    referenceNumber: `${MARKER}-insurance-expired`,
  },
  {
    key: 'vignette-soon',
    carName: 'Audi A4',
    itemType: 'vignette',
    expiresOffsetDays: 5,
    referenceNumber: `${MARKER}-vignette-soon`,
  },
  {
    key: 'inspection-expired',
    carName: 'Mercedes-Benz E-Class',
    itemType: 'technical_inspection',
    expiresOffsetDays: -3,
    referenceNumber: `${MARKER}-inspection-expired`,
  },
];

function dateOffsetSql(days) {
  if (days >= 0) return `CURRENT_DATE + INTERVAL '${days} days'`;
  return `CURRENT_DATE - INTERVAL '${Math.abs(days)} days'`;
}

async function findCarIdByName(client, name) {
  const result = await client.query(
    `SELECT id FROM cars WHERE name = $1 AND is_deleted = FALSE ORDER BY id ASC LIMIT 1`,
    [name]
  );
  return result.rows[0]?.id ?? null;
}

async function upsertCompliance(client, carId, scenario) {
  const existing = await client.query(
    `
    SELECT id FROM car_compliance_items
    WHERE car_id = $1 AND reference_number = $2
    LIMIT 1
    `,
    [carId, scenario.referenceNumber]
  );

  const expiresExpr = dateOffsetSql(scenario.expiresOffsetDays);
  const statusExpr =
    scenario.expiresOffsetDays < 0 ? `'expired'` : `'valid'`;

  if (existing.rows[0]) {
    await client.query(
      `
      UPDATE car_compliance_items
      SET
        item_type = $2,
        expires_at = ${expiresExpr},
        status = ${statusExpr},
        notes = $3,
        updated_at = NOW()
      WHERE id = $1
      `,
      [existing.rows[0].id, scenario.itemType, `${MARKER} ${scenario.key}`]
    );
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    `
    INSERT INTO car_compliance_items (
      car_id, item_type, reference_number, expires_at, status, notes
    )
    VALUES ($1, $2, $3, ${expiresExpr}, ${statusExpr}, $4)
    RETURNING id
    `,
    [carId, scenario.itemType, scenario.referenceNumber, `${MARKER} ${scenario.key}`]
  );
  return inserted.rows[0].id;
}

async function syncCarExpiryCaches(client, carId) {
  await client.query(
    `
    UPDATE cars c
    SET
      insurance_expiry = (
        SELECT expires_at FROM car_compliance_items
        WHERE car_id = c.id AND item_type = 'civil_insurance'
        ORDER BY expires_at DESC NULLS LAST, id DESC LIMIT 1
      ),
      technical_inspection_expiry = (
        SELECT expires_at FROM car_compliance_items
        WHERE car_id = c.id AND item_type = 'technical_inspection'
        ORDER BY expires_at DESC NULLS LAST, id DESC LIMIT 1
      ),
      updated_at = NOW()
    WHERE c.id = $1
    `,
    [carId]
  );
}

async function upsertDamage(client, carId) {
  const description = `${MARKER}-damage: dent on front bumper`;
  const existing = await client.query(
    `
    SELECT id FROM car_damage_reports
    WHERE car_id = $1 AND description = $2
    LIMIT 1
    `,
    [carId, description]
  );
  if (existing.rows[0]) {
    await client.query(
      `
      UPDATE car_damage_reports
      SET status = 'unresolved', resolved_at = NULL, updated_at = NOW()
      WHERE id = $1
      `,
      [existing.rows[0].id]
    );
    return existing.rows[0].id;
  }
  const inserted = await client.query(
    `
    INSERT INTO car_damage_reports (car_id, description, status)
    VALUES ($1, $2, 'unresolved')
    RETURNING id
    `,
    [carId, description]
  );
  return inserted.rows[0].id;
}

async function clearSeedProblemsOnCleanCar(client, carId) {
  await client.query(
    `
    DELETE FROM car_compliance_items
    WHERE car_id = $1 AND reference_number LIKE $2
    `,
    [carId, `${MARKER}-%`]
  );
  await client.query(
    `
    DELETE FROM car_damage_reports
    WHERE car_id = $1 AND description LIKE $2
    `,
    [carId, `${MARKER}-%`]
  );
}

async function seedFleetAlerts({ endPool = true } = {}) {
  requireDatabaseUrl();
  const client = await pool.connect();

  try {
    console.log('→ seedFleetAlerts');

    const usedCarIds = [];

    for (const scenario of SCENARIOS) {
      const carId = await findCarIdByName(client, scenario.carName);
      if (!carId) {
        console.warn(`⊘ skip ${scenario.key}: car "${scenario.carName}" not found`);
        continue;
      }
      await upsertCompliance(client, carId, scenario);
      await syncCarExpiryCaches(client, carId);
      usedCarIds.push(carId);
      console.log(`  ✓ ${scenario.key} on ${scenario.carName}`);
    }

    const damageCarName = 'Toyota RAV4';
    const damageCarId = await findCarIdByName(client, damageCarName);
    if (damageCarId) {
      await upsertDamage(client, damageCarId);
      usedCarIds.push(damageCarId);
      console.log(`  ✓ unresolved damage on ${damageCarName}`);
    } else {
      console.warn(`⊘ skip damage: car "${damageCarName}" not found`);
    }

    // Clean car: pick any remaining demo car without seed markers (reuse Golf after clearing non-scenario noise)
    // Use a dedicated approach — clear seed problems on first car not in used set.
    // With 5 demo cars and 5 scenarios above, there is no 6th car; create a synthetic clean state
    // by ensuring Golf only has the intended insurance-7d item (already) and document that as "has warning only".
    // Per plan we need a car with no problems: insert a dedicated seed car if missing.
    let cleanCar = await client.query(
      `
      SELECT id, name FROM cars
      WHERE name = 'Fleet Seed Clean Car' AND is_deleted = FALSE
      LIMIT 1
      `
    );
    if (!cleanCar.rows[0]) {
      const cat = await client.query(`SELECT id FROM categories ORDER BY id ASC LIMIT 1`);
      if (cat.rows[0]) {
        const inserted = await client.query(
          `
          INSERT INTO cars (
            name, image, transmission, price, price_per_day,
            price_tier_1_3, price_tier_7_31, price_tier_31_plus,
            seats, fuel_type, availability, category_id, status
          )
          VALUES (
            'Fleet Seed Clean Car',
            '/images/demo/golf.jpg',
            'Automatic',
            40, 40, 40, 35, 30,
            5, 'Petrol', TRUE, $1, 'available'
          )
          RETURNING id, name
          `,
          [cat.rows[0].id]
        );
        cleanCar = inserted;
      }
    }
    if (cleanCar.rows[0]) {
      await clearSeedProblemsOnCleanCar(client, cleanCar.rows[0].id);
      console.log(`  ✓ clean car ${cleanCar.rows[0].name} (no seed problems)`);
    }

    const result = await reconcileFleetAlerts({ now: new Date() });
    console.log(
      `✓ Fleet alerts reconciled (desired=${result.desired}, upserted=${result.upserted}, resolved=${result.resolved})`
    );
  } finally {
    client.release();
    if (endPool) {
      await pool.end();
    }
  }
}

if (require.main === module) {
  seedFleetAlerts().catch((err) => {
    console.error('Fleet alerts seed failed:', err.message);
    process.exit(1);
  });
}

module.exports = { seedFleetAlerts };
