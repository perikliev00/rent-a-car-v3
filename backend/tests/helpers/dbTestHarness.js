const pool = require('../../src/db/pool');

async function insertTestCar(client) {
  const result = await client.query(
    `
    INSERT INTO cars (
      name, image, transmission, price, seats, fuel_type, availability
    )
    VALUES ('Test Car', '/images/test.jpg', 'Automatic', 50, 4, 'Petrol', TRUE)
    RETURNING id
    `
  );
  return Number(result.rows[0].id);
}

module.exports = {
  insertTestCar,
  pool,
};
