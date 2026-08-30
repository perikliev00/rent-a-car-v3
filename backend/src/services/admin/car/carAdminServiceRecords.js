const carRepository = require('../../../repositories/carRepository');
const serviceRecordSql = require('../../sql/carServiceRecordSqlService');
const {
  emptyToNull,
  parseOptionalInt,
  parseOptionalFloat,
} = require('./carAdminHelpers');

async function listServiceRecords(carId) {
  const car = await carRepository.findByIdForAdmin(carId);
  if (!car || car.isDeleted) throw new Error('Car not found');
  return serviceRecordSql.listByCarId(carId);
}

async function createServiceRecord(carId, body, userId = null) {
  const car = await carRepository.findByIdForAdmin(carId);
  if (!car || car.isDeleted) throw new Error('Car not found');
  return serviceRecordSql.create(carId, {
    serviceType: body.serviceType,
    description: body.description || null,
    cost: parseOptionalFloat(body.cost),
    mileage: parseOptionalInt(body.mileage),
    serviceDate: body.serviceDate,
    nextServiceDate: emptyToNull(body.nextServiceDate),
    createdByUserId: userId,
  });
}

async function updateServiceRecord(carId, recordId, body) {
  const existing = await serviceRecordSql.findById(carId, recordId);
  if (!existing) throw new Error('Service record not found');
  return serviceRecordSql.update(carId, recordId, {
    serviceType: body.serviceType ?? existing.serviceType,
    description: body.description !== undefined ? body.description : existing.description,
    cost: body.cost !== undefined ? parseOptionalFloat(body.cost) : existing.cost,
    mileage: body.mileage !== undefined ? parseOptionalInt(body.mileage) : existing.mileage,
    serviceDate: body.serviceDate ?? existing.serviceDate,
    nextServiceDate:
      body.nextServiceDate !== undefined
        ? emptyToNull(body.nextServiceDate)
        : existing.nextServiceDate,
  });
}

async function deleteServiceRecord(carId, recordId) {
  const ok = await serviceRecordSql.remove(carId, recordId);
  if (!ok) throw new Error('Service record not found');
}

module.exports = {
  listServiceRecords,
  createServiceRecord,
  updateServiceRecord,
  deleteServiceRecord,
};
