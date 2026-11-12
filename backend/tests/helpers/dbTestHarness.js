// Require the '../../src/db/pool' module as pool.
const pool = require('../../src/db/pool');

// Define the async function insertTestCar.
async function insertTestCar(client) {
  // Create the result constant.
  const result = await client.query(
    // Continue the surrounding logic with this statement.
    `
    INSERT INTO cars (
      name, image, transmission, price, seats, fuel_type, availability
    )
    VALUES ('Test Car', '/images/test.jpg', 'Automatic', 50, 4, 'Petrol', TRUE)
    RETURNING id
    `
  );
  // Return the resulting value to the caller.
  return Number(result.rows[0].id);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  insertTestCar,
  // Contribute this line to the enclosing declaration or statement.
  pool,
};
