/**
 * Fleet car admin APIs: CRUD, fleet status, service/damage/documents/compliance,
 * availability checks, and fleet-alert reconciliation.
 */
import type {
  // Contribute this line to the enclosing declaration or statement.
  Car,
  // Contribute this line to the enclosing declaration or statement.
  CarComplianceItem,
  // Contribute this line to the enclosing declaration or statement.
  CarDamageReport,
  // Contribute this line to the enclosing declaration or statement.
  CarDocument,
  // Contribute this line to the enclosing declaration or statement.
  CarFleetStatus,
  // Contribute this line to the enclosing declaration or statement.
  CarServiceRecord,
// Contribute this line to the enclosing declaration or statement.
} from '../../types/api';
// Import named exports from '../client'.
import { api, apiFormData, downloadAuthenticated } from '../client';

/**
 * List all cars for the admin fleet table.
 */
export async function getAdminCars(): Promise<{ cars: Car[] }> {
  // Return the resulting value to the caller.
  return api<{ cars: Car[] }>('/api/admin/cars');
}

// Export the fleet alert severity type.
export type FleetAlertSeverity = 'critical' | 'warning' | 'info';

/** Server-derived alert kinds (expiry, damage, status, overdue service). */
export type FleetAlertType =
  // Contribute this line to the enclosing declaration or statement.
  | 'insurance_expired'
  // Contribute this line to the enclosing declaration or statement.
  | 'insurance_expiring_soon'
  // Contribute this line to the enclosing declaration or statement.
  | 'casco_expired'
  // Contribute this line to the enclosing declaration or statement.
  | 'casco_expiring_soon'
  // Contribute this line to the enclosing declaration or statement.
  | 'vignette_expired'
  // Contribute this line to the enclosing declaration or statement.
  | 'vignette_expiring_soon'
  // Contribute this line to the enclosing declaration or statement.
  | 'inspection_expired'
  // Contribute this line to the enclosing declaration or statement.
  | 'inspection_expiring_soon'
  // Contribute this line to the enclosing declaration or statement.
  | 'unresolved_damage'
  // Contribute this line to the enclosing declaration or statement.
  | 'compliance_expired'
  // Contribute this line to the enclosing declaration or statement.
  | 'compliance_expiring_soon'
  // Contribute this line to the enclosing declaration or statement.
  | 'compliance_missing'
  // Contribute this line to the enclosing declaration or statement.
  | 'status_damaged'
  // Contribute this line to the enclosing declaration or statement.
  | 'status_needs_cleaning'
  // Contribute this line to the enclosing declaration or statement.
  | 'status_needs_inspection'
  // Contribute this line to the enclosing declaration or statement.
  | 'status_in_maintenance'
  // Contribute this line to the enclosing declaration or statement.
  | 'service_overdue';

// Export the fleet alert interface.
export interface FleetAlert {
  // Provide the id field value.
  id: string;
  // Provide the type field value.
  type: FleetAlertType | string;
  // Provide the severity field value.
  severity: FleetAlertSeverity;
  // Provide the car id field value.
  carId: string;
  // Provide the car name field value.
  carName: string;
  // Provide the message field value.
  message: string;
  // Continue the surrounding logic with this statement.
  meta?: Record<string, unknown>;
}

// Export the fleet alerts data interface.
export interface FleetAlertsData {
  // Provide the summary field value.
  summary: { total: number; critical: number; warning: number; info: number };
  // Provide the alerts field value.
  alerts: FleetAlert[];
}

/**
 * Current fleet alert feed used by the Fleet Alerts page and nav badge.
 */
export async function getFleetAlerts(): Promise<FleetAlertsData> {
  // Return the resulting value to the caller.
  return api<FleetAlertsData>('/api/admin/cars/fleet-alerts');
}

/**
 * Recomputes alerts from live car/compliance data (ops self-heal).
 */
export async function reconcileFleetAlerts(): Promise<
  // Continue the surrounding logic with this statement.
  FleetAlertsData & { reconcile?: Record<string, unknown> }
// Continue the surrounding logic with this statement.
> {
  // Return the resulting value to the caller.
  return api('/api/admin/cars/fleet-alerts/reconcile', { method: 'POST' });
}

/**
 * Load a single car for the car detail page.
 * @param id - Car id
 */
export async function getAdminCar(id: string): Promise<{ car: Car }> {
  // Return the resulting value to the caller.
  return api<{ car: Car }>(`/api/admin/cars/${id}`);
}

/**
 * Create a car via multipart form (supports image upload).
 * @param formData - Multipart fields + optional photo
 */
export async function createAdminCar(formData: FormData): Promise<{ car: Car }> {
  // Return the resulting value to the caller.
  return apiFormData<{ car: Car }>('/api/admin/cars', formData);
}

/**
 * Replace/update a car via multipart form (PUT).
 * @param id - Car id
 * @param formData - Multipart fields + optional photo
 */
export async function updateAdminCar(id: string, formData: FormData): Promise<{ car: Car }> {
  // Return the resulting value to the caller.
  return apiFormData<{ car: Car }>(`/api/admin/cars/${id}`, formData, 'PUT');
}

/**
 * Permanently delete a car record.
 * @param id - Car id
 */
export async function deleteAdminCar(id: string): Promise<{ deleted: boolean; id: number }> {
  // Return the resulting value to the caller.
  return api<{ deleted: boolean; id: number }>(`/api/admin/cars/${id}`, { method: 'DELETE' });
}

/**
 * Explicit fleet-status transition (separate from inventory edit).
 *
 * @param id - Car id
 * @param body.status - Target fleet status
 * @param body.reason - Optional reason stored with the transition
 */
export async function changeCarFleetStatus(
  // Provide the id field value.
  id: string,
  // Provide the body field value.
  body: { status: CarFleetStatus; reason?: string }
// Continue the surrounding logic with this statement.
): Promise<{ car: Car; oldStatus: string; newStatus: string }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/cars/${id}/status`, {
    // Provide the method field value.
    method: 'POST',
    // Provide the body field value.
    body: JSON.stringify(body),
  });
}

/**
 * List service/maintenance records for a car.
 * @param id - Car id
 */
export async function getCarServiceRecords(id: string): Promise<{ records: CarServiceRecord[] }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/cars/${id}/service-records`);
}

/**
 * Create a service record on a car.
 * @param id - Car id
 * @param body - Service record fields as accepted by the API
 */
export async function createCarServiceRecord(
  // Provide the id field value.
  id: string,
  // Provide the body field value.
  body: Record<string, unknown>
// Continue the surrounding logic with this statement.
): Promise<{ record: CarServiceRecord }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/cars/${id}/service-records`, {
    // Provide the method field value.
    method: 'POST',
    // Provide the body field value.
    body: JSON.stringify(body),
  });
}

/**
 * Delete one service record.
 * @param carId - Car id
 * @param recordId - Service record id
 */
export async function deleteCarServiceRecord(
  // Provide the car id field value.
  carId: string,
  // Provide the record id field value.
  recordId: number
// Continue the surrounding logic with this statement.
): Promise<{ deleted: boolean }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/cars/${carId}/service-records/${recordId}`, { method: 'DELETE' });
}

/**
 * List damage reports for a car.
 * @param id - Car id
 */
export async function getCarDamageReports(id: string): Promise<{ reports: CarDamageReport[] }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/cars/${id}/damage-reports`);
}

/**
 * Create a damage report (multipart for optional photos).
 * @param id - Car id
 * @param formData - Report fields + optional images
 */
export async function createCarDamageReport(
  // Provide the id field value.
  id: string,
  // Provide the form data field value.
  formData: FormData
// Continue the surrounding logic with this statement.
): Promise<{ report: CarDamageReport }> {
  // Return the resulting value to the caller.
  return apiFormData(`/api/admin/cars/${id}/damage-reports`, formData);
}

/**
 * Mark a damage report as resolved.
 * @param carId - Car id
 * @param reportId - Damage report id
 */
export async function resolveCarDamageReport(
  // Provide the car id field value.
  carId: string,
  // Provide the report id field value.
  reportId: number
// Continue the surrounding logic with this statement.
): Promise<{ report: CarDamageReport }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/cars/${carId}/damage-reports/${reportId}/resolve`, { method: 'POST' });
}

/**
 * Delete a damage report.
 * @param carId - Car id
 * @param reportId - Damage report id
 */
export async function deleteCarDamageReport(
  // Provide the car id field value.
  carId: string,
  // Provide the report id field value.
  reportId: number
// Continue the surrounding logic with this statement.
): Promise<{ deleted: boolean }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/cars/${carId}/damage-reports/${reportId}`, { method: 'DELETE' });
}

/**
 * List uploaded documents for a car.
 * @param id - Car id
 */
export async function getCarDocuments(id: string): Promise<{ documents: CarDocument[] }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/cars/${id}/documents`);
}

/**
 * Upload a car document (multipart).
 * @param id - Car id
 * @param formData - Document metadata + file
 */
export async function uploadCarDocument(
  // Provide the id field value.
  id: string,
  // Provide the form data field value.
  formData: FormData
// Continue the surrounding logic with this statement.
): Promise<{ document: CarDocument }> {
  // Return the resulting value to the caller.
  return apiFormData(`/api/admin/cars/${id}/documents`, formData);
}

/**
 * Download a car document via authenticated blob fetch.
 * @param carId - Car id
 * @param docId - Document id
 * @param filename - Suggested download filename
 */
export async function downloadCarDocument(
  // Provide the car id field value.
  carId: string,
  // Provide the doc id field value.
  docId: number,
  // Provide the filename field value.
  filename: string
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Return the resulting value to the caller.
  return downloadAuthenticated(
    // Continue the surrounding logic with this statement.
    `/api/admin/cars/${carId}/documents/${docId}/download`,
    // Reference the identifier used by the enclosing expression.
    filename
  );
}

/**
 * Delete a car document.
 * @param carId - Car id
 * @param docId - Document id
 */
export async function deleteCarDocument(
  // Provide the car id field value.
  carId: string,
  // Provide the doc id field value.
  docId: number
// Continue the surrounding logic with this statement.
): Promise<{ deleted: boolean }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/cars/${carId}/documents/${docId}`, { method: 'DELETE' });
}

/**
 * List compliance items for a car.
 * @param id - Car id
 */
export async function getCarCompliance(id: string): Promise<{ items: CarComplianceItem[] }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/cars/${id}/compliance`);
}

/**
 * Create a compliance item (multipart for optional attachment).
 * @param id - Car id
 * @param formData - Compliance fields + optional file
 */
export async function createCarCompliance(
  // Provide the id field value.
  id: string,
  // Provide the form data field value.
  formData: FormData
// Continue the surrounding logic with this statement.
): Promise<{ item: CarComplianceItem }> {
  // Return the resulting value to the caller.
  return apiFormData(`/api/admin/cars/${id}/compliance`, formData);
}

/**
 * Update a compliance item (multipart PUT).
 * @param carId - Car id
 * @param itemId - Compliance item id
 * @param formData - Updated fields + optional file
 */
export async function updateCarCompliance(
  // Provide the car id field value.
  carId: string,
  // Provide the item id field value.
  itemId: number,
  // Provide the form data field value.
  formData: FormData
// Continue the surrounding logic with this statement.
): Promise<{ item: CarComplianceItem }> {
  // Return the resulting value to the caller.
  return apiFormData(`/api/admin/cars/${carId}/compliance/${itemId}`, formData, 'PUT');
}

/**
 * Download the file attached to a compliance item.
 * @param carId - Car id
 * @param itemId - Compliance item id
 * @param filename - Suggested download filename
 */
export async function downloadCarComplianceDocument(
  // Provide the car id field value.
  carId: string,
  // Provide the item id field value.
  itemId: number,
  // Provide the filename field value.
  filename: string
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Return the resulting value to the caller.
  return downloadAuthenticated(
    // Continue the surrounding logic with this statement.
    `/api/admin/cars/${carId}/compliance/${itemId}/download`,
    // Reference the identifier used by the enclosing expression.
    filename
  );
}

/**
 * Delete a compliance item.
 * @param carId - Car id
 * @param itemId - Compliance item id
 */
export async function deleteCarCompliance(
  // Provide the car id field value.
  carId: string,
  // Provide the item id field value.
  itemId: number
// Continue the surrounding logic with this statement.
): Promise<{ deleted: boolean }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/cars/${carId}/compliance/${itemId}`, { method: 'DELETE' });
}

/**
 * Overlap check used when creating/editing admin orders for a car.
 * Optional times are omitted from the query when unset.
 *
 * @param id - Car id
 * @param params.pickupDate - Pickup date
 * @param params.returnDate - Return date
 * @param params.pickupTime - Optional pickup time
 * @param params.returnTime - Optional return time
 */
export async function checkCarAvailability(
  // Provide the id field value.
  id: string,
  // Provide the params field value.
  params: { pickupDate: string; returnDate: string; pickupTime?: string; returnTime?: string },
// Continue the surrounding logic with this statement.
): Promise<{ available: boolean; conflicts: Array<{ startDate: string; endDate: string }> }> {
  // Required dates always present; times only when the form supplied them.
  const qs = new URLSearchParams({
    // Provide the pickup date field value.
    pickupDate: params.pickupDate,
    // Provide the return date field value.
    returnDate: params.returnDate,
    // Call ... to perform this step.
    ...(params.pickupTime ? { pickupTime: params.pickupTime } : {}),
    // Call ... to perform this step.
    ...(params.returnTime ? { returnTime: params.returnTime } : {}),
  });
  // Return the resulting value to the caller.
  return api(`/api/admin/cars/${id}/availability?${qs.toString()}`);
}

// Export the car fleet statuses const.
export const CAR_FLEET_STATUSES: CarFleetStatus[] = [
  // Supply the literal value used by the enclosing expression.
  'available',
  // Supply the literal value used by the enclosing expression.
  'reserved',
  // Supply the literal value used by the enclosing expression.
  'rented',
  // Supply the literal value used by the enclosing expression.
  'needs_cleaning',
  // Supply the literal value used by the enclosing expression.
  'needs_inspection',
  // Supply the literal value used by the enclosing expression.
  'in_maintenance',
  // Supply the literal value used by the enclosing expression.
  'damaged',
  // Supply the literal value used by the enclosing expression.
  'inactive',
];

// Export the fuel level options const.
export const FUEL_LEVEL_OPTIONS = [
  // Contribute this line to the enclosing declaration or statement.
  { value: '', label: '—' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'empty', label: 'Empty' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'quarter', label: '1/4' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'half', label: '1/2' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'three_quarters', label: '3/4' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'full', label: 'Full' },
];

// Export the service type options const.
export const SERVICE_TYPE_OPTIONS = [
  // Contribute this line to the enclosing declaration or statement.
  { value: 'oil_change', label: 'Oil change' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'tires', label: 'Tires' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'brakes', label: 'Brakes' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'inspection', label: 'Inspection' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'bodywork', label: 'Bodywork' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'other', label: 'Other' },
];

// Export the compliance type options const.
export const COMPLIANCE_TYPE_OPTIONS = [
  // Contribute this line to the enclosing declaration or statement.
  { value: 'civil_insurance', label: 'Гражданска отговорност' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'casco', label: 'Каско' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'vignette', label: 'Винетка' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'technical_inspection', label: 'ГТП / технически преглед' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'vehicle_tax', label: 'Данък МПС' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'registration_certificate', label: 'Талон / регистрация' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'fire_extinguisher', label: 'Пожарогасител' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'first_aid_kit', label: 'Аптечка' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'warning_triangle', label: 'Триъгълник' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'leasing', label: 'Лизинг / договор' },
  // Contribute this line to the enclosing declaration or statement.
  { value: 'other', label: 'Друго' },
];

/** Types that use issued/expiry dates and fleet expiry alerts. */
export const COMPLIANCE_TYPES_WITH_EXPIRY = new Set([
  // Supply the literal value used by the enclosing expression.
  'civil_insurance',
  // Supply the literal value used by the enclosing expression.
  'casco',
  // Supply the literal value used by the enclosing expression.
  'vignette',
  // Supply the literal value used by the enclosing expression.
  'technical_inspection',
  // Supply the literal value used by the enclosing expression.
  'vehicle_tax',
  // Supply the literal value used by the enclosing expression.
  'registration_certificate',
  // Supply the literal value used by the enclosing expression.
  'leasing',
  // Supply the literal value used by the enclosing expression.
  'other',
]);

/** Equipment without a validity period — no date fields in the form. */
export const COMPLIANCE_TYPES_WITHOUT_EXPIRY = new Set([
  // Supply the literal value used by the enclosing expression.
  'fire_extinguisher',
  // Supply the literal value used by the enclosing expression.
  'first_aid_kit',
  // Supply the literal value used by the enclosing expression.
  'warning_triangle',
]);

/**
 * Whether the compliance form should show issued/expiry date fields.
 * Equipment types without expiry always return false; unknown types fall back
 * to the “with expiry” set membership.
 *
 * @param itemType - Compliance type key from the form/API
 */
export function complianceTypeHasExpiry(itemType: string): boolean {
  // Explicit no-date equipment wins over the with-expiry set.
  if (COMPLIANCE_TYPES_WITHOUT_EXPIRY.has(itemType)) return false;
  // Return the resulting value to the caller.
  return COMPLIANCE_TYPES_WITH_EXPIRY.has(itemType);
}
