const carRepository = require('../../repositories/carRepository');
const carSql = require('../sql/carSqlService');
const serviceRecordSql = require('../sql/carServiceRecordSqlService');
const damageReportSql = require('../sql/carDamageReportSqlService');
const documentSql = require('../sql/carDocumentSqlService');
const complianceSql = require('../sql/carComplianceSqlService');
const storage = require('../storage');
const { ConflictError } = require('../../utils/appError');
const { CAR_STATUSES, FUEL_LEVELS, COMPLIANCE_TYPES } = require('../../constants/carEnums');

function parsePriceTier(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseCategoryId(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function resolveCategoryId(payload, existingCar) {
  if (Object.prototype.hasOwnProperty.call(payload, 'categoryId')) {
    return parseCategoryId(payload.categoryId);
  }
  if (existingCar && existingCar.categoryId !== undefined) {
    return existingCar.categoryId;
  }
  return null;
}

function deriveBasePrice({ tierShort, tierMedium, tierLong }) {
  if (tierShort !== undefined) return tierShort;
  if (tierMedium !== undefined) return tierMedium;
  if (tierLong !== undefined) return tierLong;
  return undefined;
}

function buildImagePath(file, fallback = '') {
  if (!file) return fallback;
  return file.publicUrl || storage.buildPublicUrl(file.filename);
}

async function deleteManagedImageIfUnused(publicUrl) {
  if (!publicUrl || !storage.isManagedPublicUrl(publicUrl)) {
    return;
  }
  await storage.deleteByPublicUrl(publicUrl);
}

function emptyToNull(value) {
  if (value === undefined || value === null || value === '') return null;
  return value;
}

function parseOptionalInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = parseInt(String(value), 10);
  return Number.isInteger(n) ? n : null;
}

function parseOptionalFloat(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function resolveFleetStatus(payload, existingCar) {
  if (payload.status && CAR_STATUSES.includes(payload.status)) {
    return payload.status;
  }

  const hasAvailability = Object.prototype.hasOwnProperty.call(payload, 'availability');
  const availabilityOn = hasAvailability
    ? payload.availability === 'on' || payload.availability === true || payload.availability === 'true'
    : null;

  if (existingCar) {
    const current = existingCar.status || (existingCar.availability ? 'available' : 'inactive');
    if (availabilityOn === false) return 'inactive';
    if (availabilityOn === true) {
      if (current === 'inactive') return 'available';
      return current;
    }
    return current;
  }

  if (availabilityOn === false) return 'inactive';
  return 'available';
}

function buildCarFormState(body = {}, existingCar = null) {
  const car = existingCar ?? {};

  const pick = (key, fallback = '') => {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== '') {
      return body[key];
    }
    if (existingCar && car[key] !== undefined) {
      return car[key];
    }
    return fallback;
  };

  const pickAvailability = () => {
    if (Object.prototype.hasOwnProperty.call(body, 'availability')) {
      return body.availability === 'on';
    }
    if (existingCar) return !!car.availability;
    return true;
  };

  const pickTier = (key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      return body[key] === '' ? undefined : body[key];
    }
    if (existingCar && car[key] !== undefined) return car[key];
    return undefined;
  };

  const base = existingCar
    ? { id: car.id, image: car.image, price: car.price }
    : {};

  return {
    ...base,
    name: pick('name', ''),
    transmission: pick('transmission', ''),
    seats: pick('seats', ''),
    fuelType: pick('fuelType', ''),
    availability: pickAvailability(),
    priceTier_1_3: pickTier('priceTier_1_3'),
    priceTier_7_31: pickTier('priceTier_7_31'),
    priceTier_31_plus: pickTier('priceTier_31_plus'),
    categoryId: Object.prototype.hasOwnProperty.call(body, 'categoryId')
      ? parseCategoryId(body.categoryId)
      : existingCar?.categoryId ?? null,
  };
}

function buildCarPayload(payload, file, existingCar = null) {
  const tierShort = parsePriceTier(payload.priceTier_1_3);
  const tierMedium = parsePriceTier(payload.priceTier_7_31);
  const tierLong = parsePriceTier(payload.priceTier_31_plus);

  const finalTierShort =
    tierShort !== undefined
      ? tierShort
      : existingCar
        ? existingCar.priceTier_1_3
        : undefined;
  const finalTierMedium =
    tierMedium !== undefined
      ? tierMedium
      : existingCar
        ? existingCar.priceTier_7_31
        : undefined;
  const finalTierLong =
    tierLong !== undefined
      ? tierLong
      : existingCar
        ? existingCar.priceTier_31_plus
        : undefined;

  const derivedBase = deriveBasePrice({
    tierShort: finalTierShort,
    tierMedium: finalTierMedium,
    tierLong: finalTierLong,
  });

  const seats = parseInt(payload.seats, 10);
  if (!Number.isInteger(seats) || seats <= 0) {
    throw new Error('Seats must be a positive number.');
  }

  const price =
    derivedBase !== undefined
      ? derivedBase
      : existingCar
        ? existingCar.price
        : undefined;

  if (price === undefined) {
    throw new Error('At least one price tier is required.');
  }

  const image = file
    ? buildImagePath(file)
    : existingCar
      ? existingCar.image
      : buildImagePath(file);

  if (!image) {
    throw new Error('Car image is required.');
  }

  const status = resolveFleetStatus(payload, existingCar);
  const fuelLevel = emptyToNull(payload.fuelLevel);
  if (fuelLevel && !FUEL_LEVELS.includes(fuelLevel)) {
    throw new Error('Invalid fuel level.');
  }

  const pickFleet = (key, existingKey = key) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      return emptyToNull(payload[key]);
    }
    if (existingCar && existingCar[existingKey] !== undefined) {
      return existingCar[existingKey] ?? null;
    }
    return null;
  };

  return {
    name: payload.name,
    transmission: payload.transmission,
    seats,
    fuelType: payload.fuelType,
    price,
    priceTier_1_3: finalTierShort,
    priceTier_7_31: finalTierMedium,
    priceTier_31_plus: finalTierLong,
    image,
    status,
    availability: status === 'available',
    registrationNumber: pickFleet('registrationNumber'),
    vin: pickFleet('vin'),
    mileage: Object.prototype.hasOwnProperty.call(payload, 'mileage')
      ? parseOptionalInt(payload.mileage)
      : existingCar?.mileage ?? null,
    fuelLevel: Object.prototype.hasOwnProperty.call(payload, 'fuelLevel')
      ? fuelLevel
      : existingCar?.fuelLevel ?? null,
    currentLocation: pickFleet('currentLocation'),
    insuranceExpiry: pickFleet('insuranceExpiry'),
    technicalInspectionExpiry: pickFleet('technicalInspectionExpiry'),
    categoryId: resolveCategoryId(payload, existingCar),
  };
}

async function listCars() {
  return carRepository.listAll();
}

async function getCarById(id) {
  return carRepository.findByIdForAdmin(id);
}

async function createCar(payload, file) {
  const carPayload = buildCarPayload(payload, file);
  const car = await carRepository.create(carPayload);
  await syncInsuranceInspectionCompliance(car.id, carPayload, null);
  return carRepository.findByIdForAdmin(car.id);
}

function extractPriceTiers(car) {
  return {
    priceTier_1_3: car?.priceTier_1_3 ?? null,
    priceTier_7_31: car?.priceTier_7_31 ?? null,
    priceTier_31_plus: car?.priceTier_31_plus ?? null,
  };
}

function priceTiersChanged(previousTiers, nextTiers) {
  return (
    Number(previousTiers.priceTier_1_3) !== Number(nextTiers.priceTier_1_3) ||
    Number(previousTiers.priceTier_7_31) !== Number(nextTiers.priceTier_7_31) ||
    Number(previousTiers.priceTier_31_plus) !== Number(nextTiers.priceTier_31_plus)
  );
}

async function updateCar(id, payload, file) {
  const existingCar = await carRepository.findByIdForAdmin(id);
  if (!existingCar) {
    throw new Error('Car not found');
  }

  const previousImage = existingCar.image;
  const previousTiers = extractPriceTiers(existingCar);
  const carPayload = buildCarPayload(payload, file, existingCar);
  const newTiers = extractPriceTiers(carPayload);
  const updated = await carRepository.update(id, carPayload);
  if (!updated) {
    throw new Error('Car not found');
  }

  await syncInsuranceInspectionCompliance(id, carPayload, null);
  await reconcileFleetAlertsQuietly();

  if (
    file &&
    previousImage &&
    previousImage !== carPayload.image &&
    storage.isManagedPublicUrl(previousImage)
  ) {
    await deleteManagedImageIfUnused(previousImage);
  }

  const refreshed = await carRepository.findByIdForAdmin(id);

  return {
    car: refreshed || updated,
    audit: {
      priceChanged: priceTiersChanged(previousTiers, newTiers),
      previousTiers,
      newTiers,
      name: refreshed?.name ?? updated?.name ?? carPayload.name,
    },
  };
}

async function deleteCar(id) {
  const existingCar = await carRepository.findByIdForAdmin(id);
  if (!existingCar) {
    throw new Error('Car not found');
  }

  const activeBookings = await carSql.countActiveFleetReservations(id);
  if (activeBookings > 0) {
    throw new ConflictError('Cannot delete car with active bookings', {
      activeBookings,
    });
  }

  const deleted = await carRepository.deleteById(id);
  if (!deleted) {
    throw new Error('Car not found');
  }

  if (existingCar.image && storage.isManagedPublicUrl(existingCar.image)) {
    await deleteManagedImageIfUnused(existingCar.image);
  }
}

async function changeFleetStatus(id, status, reason = null) {
  if (!CAR_STATUSES.includes(status)) {
    const err = new Error('Invalid car status');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const existing = await carRepository.findByIdForAdmin(id);
  if (!existing || existing.isDeleted) {
    throw new Error('Car not found');
  }

  const car = await carSql.updateCarStatus(id, status);
  return { car, oldStatus: existing.status, newStatus: status, reason };
}

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

async function listDamageReports(carId) {
  const car = await carRepository.findByIdForAdmin(carId);
  if (!car || car.isDeleted) throw new Error('Car not found');
  return damageReportSql.listByCarId(carId);
}

async function createDamageReport(carId, body, files = [], userId = null) {
  const car = await carRepository.findByIdForAdmin(carId);
  if (!car || car.isDeleted) throw new Error('Car not found');

  const photos = (files || []).map((f) => buildImagePath(f));
  const report = await damageReportSql.create(carId, {
    description: body.description,
    reservationId: emptyToNull(body.reservationId),
    repairCost: parseOptionalFloat(body.repairCost),
    photos,
    reportedByUserId: userId,
  });

  if (car.status !== 'rented' && car.status !== 'reserved') {
    await carSql.updateCarStatus(carId, 'damaged');
  }

  await reconcileFleetAlertsQuietly();
  return report;
}

async function resolveDamageReport(carId, reportId) {
  const report = await damageReportSql.resolve(carId, reportId);
  if (!report) throw new Error('Damage report not found');
  await reconcileFleetAlertsQuietly();
  return report;
}

async function deleteDamageReport(carId, reportId) {
  const existing = await damageReportSql.findById(carId, reportId);
  if (!existing) throw new Error('Damage report not found');
  await damageReportSql.remove(carId, reportId);
  for (const url of existing.photos || []) {
    await deleteManagedImageIfUnused(url);
  }
  await reconcileFleetAlertsQuietly();
}

async function listDocuments(carId) {
  const car = await carRepository.findByIdForAdmin(carId);
  if (!car || car.isDeleted) throw new Error('Car not found');
  return documentSql.listByCarId(carId);
}

async function uploadDocument(carId, file, name, userId = null) {
  const car = await carRepository.findByIdForAdmin(carId);
  if (!car || car.isDeleted) throw new Error('Car not found');
  if (!file) throw new Error('Document image is required.');

  const url = buildImagePath(file);
  return documentSql.create(carId, {
    name: name || file.originalname || 'document',
    url,
    uploadedByUserId: userId,
  });
}

async function deleteDocument(carId, docId) {
  const doc = await documentSql.remove(carId, docId);
  if (!doc) throw new Error('Document not found');
  await deleteManagedImageIfUnused(doc.url);
  return doc;
}

async function getFleetAlerts() {
  const fleetAlertsSql = require('../sql/carFleetAlertsSqlService');
  return fleetAlertsSql.listFleetAlerts();
}

async function reconcileFleetAlerts(now = new Date()) {
  const reconcile = require('../carFleetAlertReconcileService');
  return reconcile.reconcileFleetAlerts({ now });
}

async function syncInsuranceInspectionCompliance(carId, payload, userId = null) {
  if (Object.prototype.hasOwnProperty.call(payload, 'insuranceExpiry')) {
    const expiresAt = emptyToNull(payload.insuranceExpiry);
    if (expiresAt) {
      await complianceSql.upsertByType(carId, 'civil_insurance', {
        expiresAt,
        createdByUserId: userId,
      });
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'technicalInspectionExpiry')) {
    const expiresAt = emptyToNull(payload.technicalInspectionExpiry);
    if (expiresAt) {
      await complianceSql.upsertByType(carId, 'technical_inspection', {
        expiresAt,
        createdByUserId: userId,
      });
    }
  }
  await complianceSql.syncCarExpiryCache(carId);
}

function buildCompliancePayload(body, file = null, existing = null) {
  const itemType = body.itemType || existing?.itemType;
  if (!COMPLIANCE_TYPES.includes(itemType)) {
    throw new Error('Invalid compliance type');
  }

  let documentUrl = null;
  if (file) {
    documentUrl = buildImagePath(file);
  }

  return {
    itemType,
    title: emptyToNull(body.title),
    referenceNumber: emptyToNull(body.referenceNumber),
    issuedAt: emptyToNull(body.issuedAt),
    expiresAt: emptyToNull(body.expiresAt),
    notes: emptyToNull(body.notes),
    documentUrl,
    status: body.status === 'missing' ? 'missing' : undefined,
  };
}

async function listCompliance(carId) {
  const car = await carRepository.findByIdForAdmin(carId);
  if (!car || car.isDeleted) throw new Error('Car not found');
  return complianceSql.listByCarId(carId);
}

async function createCompliance(carId, body, file = null, userId = null) {
  const car = await carRepository.findByIdForAdmin(carId);
  if (!car || car.isDeleted) throw new Error('Car not found');

  const payload = buildCompliancePayload(body, file);
  const item = await complianceSql.create(carId, {
    ...payload,
    createdByUserId: userId,
  });

  if (item.itemType === 'civil_insurance' || item.itemType === 'technical_inspection') {
    await complianceSql.syncCarExpiryCache(carId);
  }
  await reconcileFleetAlertsQuietly();
  return item;
}

async function updateCompliance(carId, itemId, body, file = null) {
  const existing = await complianceSql.findById(carId, itemId);
  if (!existing) throw new Error('Compliance item not found');

  const payload = buildCompliancePayload(body, file, existing);
  const item = await complianceSql.update(carId, itemId, {
    itemType: payload.itemType,
    title: body.title !== undefined ? payload.title : existing.title,
    referenceNumber:
      body.referenceNumber !== undefined ? payload.referenceNumber : existing.referenceNumber,
    issuedAt: body.issuedAt !== undefined ? payload.issuedAt : existing.issuedAt,
    expiresAt: body.expiresAt !== undefined ? payload.expiresAt : existing.expiresAt,
    notes: body.notes !== undefined ? payload.notes : existing.notes,
    documentUrl: payload.documentUrl,
    status: body.status === 'missing' ? 'missing' : undefined,
  });

  if (item.itemType === 'civil_insurance' || item.itemType === 'technical_inspection') {
    await complianceSql.syncCarExpiryCache(carId);
  }
  await reconcileFleetAlertsQuietly();
  return item;
}

async function deleteCompliance(carId, itemId) {
  const existing = await complianceSql.findById(carId, itemId);
  if (!existing) throw new Error('Compliance item not found');
  const removed = await complianceSql.remove(carId, itemId);
  if (existing.documentUrl) {
    await deleteManagedImageIfUnused(existing.documentUrl);
  }
  if (
    existing.itemType === 'civil_insurance' ||
    existing.itemType === 'technical_inspection'
  ) {
    await complianceSql.syncCarExpiryCache(carId);
  }
  await reconcileFleetAlertsQuietly();
  return removed;
}

async function reconcileFleetAlertsQuietly() {
  try {
    await reconcileFleetAlerts(new Date());
  } catch (err) {
    // Alerts refresh on the next background job; do not fail the mutation
    const logger = require('../../utils/logger');
    logger.error({ err, context: 'reconcileFleetAlertsQuietly' }, 'Fleet alert reconcile after mutation failed');
  }
}

module.exports = {
  listCars,
  getCarById,
  createCar,
  updateCar,
  deleteCar,
  changeFleetStatus,
  listServiceRecords,
  createServiceRecord,
  updateServiceRecord,
  deleteServiceRecord,
  listDamageReports,
  createDamageReport,
  resolveDamageReport,
  deleteDamageReport,
  listDocuments,
  uploadDocument,
  deleteDocument,
  listCompliance,
  createCompliance,
  updateCompliance,
  deleteCompliance,
  getFleetAlerts,
  reconcileFleetAlerts,
  buildCarFormState,
};
