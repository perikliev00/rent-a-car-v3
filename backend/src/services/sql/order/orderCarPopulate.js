/**
 * Populate order rows with nested car objects for admin list/detail views.
 */
const { clientQuery } = require('../../../db/transaction');
const { mapSqlCar } = require('../carSqlService');
const { normalizeId, attachCarToOrder } = require('./orderMapper');

/**
 * Load cars by ids.
 * @param {Array<*>} carIds
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function fetchCarsByIds(carIds, client = null) {
  const normalizedIds = [...new Set(
    carIds.map(normalizeId).filter((id) => id !== null)
  )];

  const map = new Map();
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedIds.length) {
    return map;
  }

  const result = await clientQuery(
    client,
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
    [normalizedIds]
  );

  for (const row of result.rows) {
    map.set(Number(row.id), mapSqlCar(row));
  }

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
    return orders || [];
  }

  const carIds = orders.map((order) => order.carId);
  const carMap = await fetchCarsByIds(carIds, client);

  return orders.map((order) => {
    const carId = normalizeId(order.carId);
    return attachCarToOrder(order, carId ? carMap.get(carId) : undefined);
  });
}

module.exports = {
  fetchCarsByIds,
  populateOrdersWithCars,
};
