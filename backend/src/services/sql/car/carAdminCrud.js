const { clientQuery } = require('../../../db/transaction');
const {
  fetchCarRowById,
  mapSqlCar,
  normalizeCarId,
} = require('./carMapper');

async function createAdminCar(payload, client = null) {
  const status = payload.status || (payload.availability === false ? 'inactive' : 'available');
  const availability = status === 'available';

  const result = await clientQuery(
    client,
    `
    INSERT INTO cars (
      name,
      image,
      transmission,
      price,
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
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    RETURNING id
    `,
    [
      payload.name,
      payload.image,
      payload.transmission,
      payload.price,
      payload.priceTier_1_3 ?? null,
      payload.priceTier_7_31 ?? null,
      payload.priceTier_31_plus ?? null,
      payload.seats,
      payload.fuelType,
      availability,
      status,
      payload.registrationNumber || null,
      payload.vin || null,
      payload.mileage ?? null,
      payload.fuelLevel || null,
      payload.currentLocation || null,
      payload.insuranceExpiry || null,
      payload.technicalInspectionExpiry || null,
      payload.categoryId ?? null,
    ]
  );

  const row = await fetchCarRowById(result.rows[0].id, client);
  return mapSqlCar(row);
}

async function updateAdminCar(id, payload, client = null) {
  const carId = normalizeCarId(id);
  if (!carId) {
    throw new Error('Invalid car id');
  }

  const status =
    payload.status ||
    (payload.availability === false ? 'inactive' : 'available');
  const availability = status === 'available';

  const result = await clientQuery(
    client,
    `
    UPDATE cars
    SET
      name = $2,
      transmission = $3,
      price = $4,
      price_tier_1_3 = $5,
      price_tier_7_31 = $6,
      price_tier_31_plus = $7,
      seats = $8,
      fuel_type = $9,
      availability = $10,
      image = COALESCE($11, image),
      category_id = $12,
      status = $13,
      registration_number = $14,
      vin = $15,
      mileage = $16,
      fuel_level = $17,
      current_location = $18,
      insurance_expiry = $19,
      technical_inspection_expiry = $20,
      updated_at = NOW()
    WHERE id = $1
    RETURNING id
    `,
    [
      carId,
      payload.name,
      payload.transmission,
      payload.price,
      payload.priceTier_1_3 ?? null,
      payload.priceTier_7_31 ?? null,
      payload.priceTier_31_plus ?? null,
      payload.seats,
      payload.fuelType,
      availability,
      payload.image || null,
      payload.categoryId ?? null,
      status,
      payload.registrationNumber || null,
      payload.vin || null,
      payload.mileage ?? null,
      payload.fuelLevel || null,
      payload.currentLocation || null,
      payload.insuranceExpiry || null,
      payload.technicalInspectionExpiry || null,
    ]
  );

  if (!result.rowCount) {
    return null;
  }

  const row = await fetchCarRowById(carId, client);
  return mapSqlCar(row);
}

async function deleteCarById(id, client = null) {
  const carId = normalizeCarId(id);
  if (!carId) {
    throw new Error('Invalid car id');
  }

  const result = await clientQuery(
    client,
    `
    UPDATE cars
    SET
      is_deleted = TRUE,
      deleted_at = NOW(),
      availability = FALSE,
      status = 'inactive',
      updated_at = NOW()
    WHERE id = $1
      AND is_deleted = FALSE
    RETURNING id
    `,
    [carId]
  );

  return result.rowCount > 0;
}

module.exports = {
  createAdminCar,
  updateAdminCar,
  deleteCarById,
};
