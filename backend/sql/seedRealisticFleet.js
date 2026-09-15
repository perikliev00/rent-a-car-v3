#!/usr/bin/env node
/**
 * Idempotent production-safe seed of the 20-car realistic fleet.
 *
 * Lookup keys: registration_number and VIN (partial unique indexes).
 * Re-runs skip existing rows. Never updates, deletes, or overwrites cars.
 * Does not insert bookings, payments, or car_date_blocks.
 *
 * Usage: node sql/seedRealisticFleet.js
 */
require('dotenv').config();

const pool = require('../src/db/pool');
const { requireDatabaseUrl } = require('./dbCliUtils');
const { REALISTIC_FLEET, REALISTIC_FLEET_CATEGORIES } = require('./seed/realisticFleetData');

const INSERT_CAR_SQL = `
  INSERT INTO cars (
    name,
    image,
    transmission,
    price,
    price_per_day,
    price_tier_1_3,
    price_tier_7_31,
    price_tier_31_plus,
    seats,
    fuel_type,
    availability,
    status,
    registration_number,
    vin,
    mileage,
    fuel_level,
    current_location,
    insurance_expiry,
    technical_inspection_expiry,
    category_id
  )
  VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
    TRUE, 'available', $11, $12, $13, $14, $15, $16, $17, $18
  )
  RETURNING id
`;

async function ensureCategoryId(client, name) {
  await client.query(`INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [
    name,
  ]);
  const result = await client.query(`SELECT id FROM categories WHERE name = $1`, [name]);
  if (!result.rows[0]) {
    throw new Error(`Failed to resolve category "${name}"`);
  }
  return result.rows[0].id;
}

async function findExistingCar(client, car) {
  const result = await client.query(
    `
    SELECT id, name, registration_number, vin
    FROM cars
    WHERE registration_number = $1
       OR vin = $2
    LIMIT 1
    `,
    [car.registrationNumber, car.vin]
  );
  return result.rows[0] || null;
}

function insertParams(car, categoryId) {
  return [
    car.name,
    car.image,
    car.transmission,
    car.price,
    car.pricePerDay,
    car.priceTier_1_3,
    car.priceTier_7_31,
    car.priceTier_31_plus,
    car.seats,
    car.fuelType,
    car.registrationNumber,
    car.vin,
    car.mileage,
    car.fuelLevel,
    car.currentLocation,
    car.insuranceExpiry,
    car.technicalInspectionExpiry,
    categoryId,
  ];
}

async function seedRealisticFleet({ endPool = true } = {}) {
  requireDatabaseUrl();
  const client = await pool.connect();

  let inserted = 0;
  let skipped = 0;

  try {
    console.log('→ seedRealisticFleet (20 cars; fictional plates/VINs)');
    await client.query('BEGIN');

    const categoryIds = {};
    for (const name of REALISTIC_FLEET_CATEGORIES) {
      categoryIds[name] = await ensureCategoryId(client, name);
    }

    for (const car of REALISTIC_FLEET) {
      const existing = await findExistingCar(client, car);
      if (existing) {
        skipped += 1;
        console.log(
          `⊘ skip ${car.name} (${car.registrationNumber}) — already present as id=${existing.id}`
        );
        continue;
      }

      const categoryId = categoryIds[car.categoryName];
      if (!categoryId) {
        throw new Error(`Unknown category "${car.categoryName}" for ${car.name}`);
      }

      await client.query('SAVEPOINT car_insert');
      try {
        const result = await client.query(INSERT_CAR_SQL, insertParams(car, categoryId));
        await client.query('RELEASE SAVEPOINT car_insert');
        inserted += 1;
        console.log(`→ created ${car.name} id=${result.rows[0].id} ${car.registrationNumber}`);
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT car_insert');
        if (err && err.code === '23505') {
          skipped += 1;
          console.log(
            `⊘ skip ${car.name} (${car.registrationNumber}) — unique constraint already held`
          );
          continue;
        }
        throw err;
      }
    }

    await client.query('COMMIT');
    console.log(`✓ Realistic fleet seeded (inserted=${inserted}, skipped=${skipped})`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    if (endPool) {
      await pool.end();
    }
  }

  return { inserted, skipped };
}

if (require.main === module) {
  seedRealisticFleet().catch((err) => {
    console.error('Realistic fleet seed failed:', err.message);
    process.exit(1);
  });
}

module.exports = { seedRealisticFleet, findExistingCar, insertParams };
