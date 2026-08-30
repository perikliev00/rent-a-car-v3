const { clientQuery } = require('../../../db/transaction');

async function listCarsForCalendar({ filters = {}, carIds = null } = {}, client = null) {
  const where = ['c.is_deleted = FALSE'];
  const params = [];

  if (Array.isArray(carIds) && carIds.length > 0) {
    params.push(carIds.map(Number).filter((n) => Number.isInteger(n) && n > 0));
    where.push(`c.id = ANY($${params.length}::bigint[])`);
  }
  if (filters.categoryId) {
    params.push(Number(filters.categoryId));
    where.push(`c.category_id = $${params.length}`);
  }
  if (filters.transmission) {
    params.push(filters.transmission);
    where.push(`c.transmission = $${params.length}`);
  }
  if (filters.fuelType) {
    params.push(filters.fuelType);
    where.push(`c.fuel_type = $${params.length}`);
  }
  if (filters.carStatus) {
    params.push(filters.carStatus);
    where.push(`c.status = $${params.length}`);
  }
  if (filters.location) {
    params.push(`%${filters.location}%`);
    where.push(`c.current_location ILIKE $${params.length}`);
  }

  const result = await clientQuery(
    client,
    `
    SELECT
      c.id, c.name, c.transmission, c.fuel_type, c.status,
      c.current_location, c.insurance_expiry, c.technical_inspection_expiry,
      c.category_id, cat.name AS category_name
    FROM cars c
    LEFT JOIN categories cat ON cat.id = c.category_id
    WHERE ${where.join(' AND ')}
    ORDER BY c.name ASC
    `,
    params
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    transmission: row.transmission,
    fuelType: row.fuel_type,
    status: row.status,
    currentLocation: row.current_location || null,
    insuranceExpiry: row.insurance_expiry,
    technicalInspectionExpiry: row.technical_inspection_expiry,
    categoryId: row.category_id != null ? String(row.category_id) : null,
    categoryName: row.category_name || null,
  }));
}

async function listInsuranceWarnings(dateIso, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT id, name, insurance_expiry, technical_inspection_expiry, status
    FROM cars
    WHERE is_deleted = FALSE
      AND (
        (insurance_expiry IS NOT NULL AND insurance_expiry <= ($1::date + INTERVAL '14 days'))
        OR (technical_inspection_expiry IS NOT NULL AND technical_inspection_expiry <= ($1::date + INTERVAL '14 days'))
      )
    ORDER BY name ASC
    `,
    [dateIso]
  );
  return result.rows;
}

module.exports = {
  listCarsForCalendar,
  listInsuranceWarnings,
};
