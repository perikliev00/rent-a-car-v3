/**
 * Populate order rows with nested car objects for admin list/detail views.
 */
const { clientQuery } = require('../../../db/transaction');
// Destructure object properties into local variables.
const { mapSqlCar } = require('../carSqlService');
// Destructure object properties into local variables.
const { normalizeId, attachCarToOrder } = require('./orderMapper');

/**
 * Load cars by ids.
 * @param {Array<*>} carIds
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function fetchCarsByIds(carIds, client = null) {
  // Create the normalized ids constant.
  const normalizedIds = [...new Set(
    // Call carIds.map to perform this step.
    carIds.map(normalizeId).filter((id) => id !== null)
  )];

  // Create the map constant.
  const map = new Map();
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedIds.length) {
    // Return the resulting value to the caller.
    return map;
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT
      c.id,
      c.name,
      c.image,
      c.transmission,
      c.price,
      c.price_per_day,
      c.price_tier_1_3,
      c.price_tier_7_31,
      c.price_tier_31_plus,
      c.seats,
      c.fuel_type,
      c.availability,
      c.category_id,
      cat.name AS category_name,
      c.created_at,
      c.updated_at
    FROM cars c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.id = ANY($1::bigint[])
    `,
    // Contribute this line to the enclosing declaration or statement.
    [normalizedIds]
  );

  // Iterate using the loop initializer, condition, and step.
  for (const row of result.rows) {
    // Call map.set to perform this step.
    map.set(Number(row.id), mapSqlCar(row));
  }

  // Return the resulting value to the caller.
  return map;
}

/**
 * populate orders with cars.
 * @param {object} orders
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function populateOrdersWithCars(orders, client = null) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Array.isArray(orders) || !orders.length) {
    // Return the resulting value to the caller.
    return orders || [];
  }

  // Create the car ids constant.
  const carIds = orders.map((order) => order.carId);
  // Create the car map constant.
  const carMap = await fetchCarsByIds(carIds, client);

  // Return the resulting value to the caller.
  return orders.map((order) => {
    // Create the car id constant.
    const carId = normalizeId(order.carId);
    // Return the resulting value to the caller.
    return attachCarToOrder(order, carId ? carMap.get(carId) : undefined);
  });
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  fetchCarsByIds,
  // Contribute this line to the enclosing declaration or statement.
  populateOrdersWithCars,
};
