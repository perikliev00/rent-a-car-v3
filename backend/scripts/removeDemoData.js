/**
 * Destructive cleanup: delete known demo cars/users and related reservation/order rows.
 * Intended for development databases after replacing demo fleet with realistic seed data.
 */

require('dotenv').config();
// Require the '../src/db/pool' module as pool.
const pool = require('../src/db/pool');

// Create the demo car names constant.
const DEMO_CAR_NAMES = [
  // Supply the literal value used by the enclosing expression.
  'Volkswagen Golf 7',
  // Supply the literal value used by the enclosing expression.
  'BMW 320d',
  // Supply the literal value used by the enclosing expression.
  'Toyota RAV4',
  // Supply the literal value used by the enclosing expression.
  'Mercedes-Benz E-Class',
  // Supply the literal value used by the enclosing expression.
  'Audi A4',
];

// Create the demo user emails constant.
const DEMO_USER_EMAILS = ['admin@luxride.local', 'demo@luxride.local'];

/**
 * CLI entry point for this script.
 *
 * @returns {Promise<*>}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
async function main() {
  // Create the client constant.
  const client = await pool.connect();

  // Start a try block for operations that may fail.
  try {
    // Wait until the asynchronous operation resolves.
    await client.query('BEGIN');

    // Create the demo cars constant.
    const demoCars = await client.query(
      // Continue the surrounding logic with this statement.
      `SELECT id FROM cars WHERE name = ANY($1::text[])`,
      // Contribute this line to the enclosing declaration or statement.
      [DEMO_CAR_NAMES],
    );
    // Create the demo car ids constant.
    const demoCarIds = demoCars.rows.map((row) => row.id);

    // Evaluate the condition and enter the branch when it is true.
    if (demoCarIds.length) {
      // Wait until the asynchronous operation resolves.
      await client.query('DELETE FROM car_date_blocks WHERE car_id = ANY($1::bigint[])', [
        // Contribute this line to the enclosing declaration or statement.
        demoCarIds,
      ]);
      // Wait until the asynchronous operation resolves.
      await client.query(
        // Continue the surrounding logic with this statement.
        'DELETE FROM refund_operations WHERE reservation_id IN (SELECT id FROM reservations WHERE car_id = ANY($1::bigint[]))',
        // Contribute this line to the enclosing declaration or statement.
        [demoCarIds]
      );
      // Wait until the asynchronous operation resolves.
      await client.query('DELETE FROM reservations WHERE car_id = ANY($1::bigint[])', [
        // Contribute this line to the enclosing declaration or statement.
        demoCarIds,
      ]);
      // Wait until the asynchronous operation resolves.
      await client.query('DELETE FROM orders WHERE car_id = ANY($1::bigint[])', [demoCarIds]);
      // Create the deleted cars constant.
      const deletedCars = await client.query('DELETE FROM cars WHERE id = ANY($1::bigint[]) RETURNING name', [
        // Contribute this line to the enclosing declaration or statement.
        demoCarIds,
      ]);
      // Emit a diagnostic log message.
      console.log(`Removed ${deletedCars.rowCount} demo car(s):`);
      // Call deletedCars.rows.forEach to perform this step.
      deletedCars.rows.forEach((row) => console.log(`  - ${row.name}`));
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // Emit a diagnostic log message.
      console.log('No demo cars found.');
    }

    // Create the deleted contacts constant.
    const deletedContacts = await client.query(
      // Continue the surrounding logic with this statement.
      `DELETE FROM contacts WHERE email LIKE '%@example.com' OR email LIKE '%luxride.local' RETURNING id`,
    );
    // Emit a diagnostic log message.
    console.log(`Removed ${deletedContacts.rowCount} demo contact(s).`);

    // Create the deleted users constant.
    const deletedUsers = await client.query(
      // Continue the surrounding logic with this statement.
      `DELETE FROM users WHERE email = ANY($1::text[]) RETURNING email`,
      // Contribute this line to the enclosing declaration or statement.
      [DEMO_USER_EMAILS],
    );
    // Emit a diagnostic log message.
    console.log(`Removed ${deletedUsers.rowCount} demo user(s).`);

    // Create the deleted categories constant.
    const deletedCategories = await client.query(
      `DELETE FROM categories
       WHERE name IN ('Economy', 'SUV', 'Luxury', 'Premium')
         AND NOT EXISTS (SELECT 1 FROM cars c WHERE c.category_id = categories.id)
       RETURNING name`,
    );
    // Emit a diagnostic log message.
    console.log(`Removed ${deletedCategories.rowCount} unused demo categor(ies).`);

    // Create the remaining constant.
    const remaining = await client.query('SELECT count(*)::int AS count FROM cars');
    // Emit a diagnostic log message.
    console.log(`\nRemaining cars in database: ${remaining.rows[0].count}`);

    // Wait until the asynchronous operation resolves.
    await client.query('COMMIT');
    // Emit a diagnostic log message.
    console.log('\nDemo cleanup complete.');
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Wait until the asynchronous operation resolves.
    await client.query('ROLLBACK');
    // Throw an error to stop the current control flow.
    throw err;
  // Contribute this line to the enclosing declaration or statement.
  } finally {
    // Call client.release to perform this step.
    client.release();
    // Wait until the asynchronous operation resolves.
    await pool.end();
  }
}

// Call main to perform this step.
main().catch((err) => {
  // Emit a diagnostic log message.
  console.error('Cleanup failed:', err.message);
  // Call process.exit to perform this step.
  process.exit(1);
});
