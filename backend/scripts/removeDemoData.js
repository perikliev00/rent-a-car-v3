require('dotenv').config();
const pool = require('../src/db/pool');

const DEMO_CAR_NAMES = [
  'Volkswagen Golf 7',
  'BMW 320d',
  'Toyota RAV4',
  'Mercedes-Benz E-Class',
  'Audi A4',
];

const DEMO_USER_EMAILS = ['admin@luxride.local', 'demo@luxride.local'];

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const demoCars = await client.query(
      `SELECT id FROM cars WHERE name = ANY($1::text[])`,
      [DEMO_CAR_NAMES],
    );
    const demoCarIds = demoCars.rows.map((row) => row.id);

    if (demoCarIds.length) {
      await client.query('DELETE FROM car_date_blocks WHERE car_id = ANY($1::bigint[])', [
        demoCarIds,
      ]);
      await client.query('DELETE FROM reservations WHERE car_id = ANY($1::bigint[])', [
        demoCarIds,
      ]);
      await client.query('DELETE FROM orders WHERE car_id = ANY($1::bigint[])', [demoCarIds]);
      const deletedCars = await client.query('DELETE FROM cars WHERE id = ANY($1::bigint[]) RETURNING name', [
        demoCarIds,
      ]);
      console.log(`Removed ${deletedCars.rowCount} demo car(s):`);
      deletedCars.rows.forEach((row) => console.log(`  - ${row.name}`));
    } else {
      console.log('No demo cars found.');
    }

    const deletedContacts = await client.query(
      `DELETE FROM contacts WHERE email LIKE '%@example.com' OR email LIKE '%luxride.local' RETURNING id`,
    );
    console.log(`Removed ${deletedContacts.rowCount} demo contact(s).`);

    const deletedUsers = await client.query(
      `DELETE FROM users WHERE email = ANY($1::text[]) RETURNING email`,
      [DEMO_USER_EMAILS],
    );
    console.log(`Removed ${deletedUsers.rowCount} demo user(s).`);

    const deletedCategories = await client.query(
      `DELETE FROM categories
       WHERE name IN ('Economy', 'SUV', 'Luxury', 'Premium')
         AND NOT EXISTS (SELECT 1 FROM cars c WHERE c.category_id = categories.id)
       RETURNING name`,
    );
    console.log(`Removed ${deletedCategories.rowCount} unused demo categor(ies).`);

    const remaining = await client.query('SELECT count(*)::int AS count FROM cars');
    console.log(`\nRemaining cars in database: ${remaining.rows[0].count}`);

    await client.query('COMMIT');
    console.log('\nDemo cleanup complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Cleanup failed:', err.message);
  process.exit(1);
});
