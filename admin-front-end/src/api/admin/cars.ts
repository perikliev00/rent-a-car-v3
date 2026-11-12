/**
 * Fleet car admin APIs: CRUD, fleet status, service/damage/documents/compliance,
 * availability checks, and fleet-alert reconciliation.
 */
import type {
  Car,
  CarComplianceItem,
  CarDamageReport,
  CarDocument,
  CarFleetStatus,
  CarServiceRecord,
} from '../../types/api';
import { api, apiFormData, downloadAuthenticated } from '../client';

/**
 * List all cars for the admin fleet table.
 */
export async function getAdminCars(): Promise<{ cars: Car[] }> {
  return api<{ cars: Car[] }>('/api/admin/cars');
}

export type FleetAlertSeverity = 'critical' | 'warning' | 'info';

/** Server-derived alert kinds (expiry, damage, status, overdue service). */
export type FleetAlertType =
  | 'insurance_expired'
  | 'insurance_expiring_soon'
  | 'casco_expired'
  | 'casco_expiring_soon'
  | 'vignette_expired'
  | 'vignette_expiring_soon'
  | 'inspection_expired'
  | 'inspection_expiring_soon'
  | 'unresolved_damage'
  | 'compliance_expired'
  | 'compliance_expiring_soon'
  | 'compliance_missing'
  | 'status_damaged'
  | 'status_needs_cleaning'
  | 'status_needs_inspection'
  | 'status_in_maintenance'
  | 'service_overdue';

export interface FleetAlert {
  id: string;
  type: FleetAlertType | string;
  severity: FleetAlertSeverity;
  carId: string;
  carName: string;
  message: string;
  meta?: Record<string, unknown>;
}

export interface FleetAlertsData {
  summary: { total: number; critical: number; warning: number; info: number };
  alerts: FleetAlert[];
}

/**
 * Current fleet alert feed used by the Fleet Alerts page and nav badge.
 */
export async function getFleetAlerts(): Promise<FleetAlertsData> {
  return api<FleetAlertsData>('/api/admin/cars/fleet-alerts');
}

/**
 * Recomputes alerts from live car/compliance data (ops self-heal).
 */
export async function reconcileFleetAlerts(): Promise<
  FleetAlertsData & { reconcile?: Record<string, unknown> }
> {
  return api('/api/admin/cars/fleet-alerts/reconcile', { method: 'POST' });
}

/**
 * Load a single car for the car detail page.
 * @param id - Car id
 */
export async function getAdminCar(id: string): Promise<{ car: Car }> {
  return api<{ car: Car }>(`/api/admin/cars/${id}`);
}

/**
 * Create a car via multipart form (supports image upload).
 * @param formData - Multipart fields + optional photo
 */
export async function createAdminCar(formData: FormData): Promise<{ car: Car }> {
  return apiFormData<{ car: Car }>('/api/admin/cars', formData);
}

/**
 * Replace/update a car via multipart form (PUT).
 * @param id - Car id
 * @param formData - Multipart fields + optional photo
 */
export async function updateAdminCar(id: string, formData: FormData): Promise<{ car: Car }> {
  return apiFormData<{ car: Car }>(`/api/admin/cars/${id}`, formData, 'PUT');
}

/**
 * Permanently delete a car record.
 * @param id - Car id
 */
export async function deleteAdminCar(id: string): Promise<{ deleted: boolean; id: number }> {
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
  id: string,
  body: { status: CarFleetStatus; reason?: string }
): Promise<{ car: Car; oldStatus: string; newStatus: string }> {
  return api(`/api/admin/cars/${id}/status`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * List service/maintenance records for a car.
 * @param id - Car id
 */
export async function getCarServiceRecords(id: string): Promise<{ records: CarServiceRecord[] }> {
  return api(`/api/admin/cars/${id}/service-records`);
}

/**
 * Create a service record on a car.
 * @param id - Car id
 * @param body - Service record fields as accepted by the API
 */
export async function createCarServiceRecord(
  id: string,
  body: Record<string, unknown>
): Promise<{ record: CarServiceRecord }> {
  return api(`/api/admin/cars/${id}/service-records`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Delete one service record.
 * @param carId - Car id
 * @param recordId - Service record id
 */
export async function deleteCarServiceRecord(
  carId: string,
  recordId: number
): Promise<{ deleted: boolean }> {
  return api(`/api/admin/cars/${carId}/service-records/${recordId}`, { method: 'DELETE' });
}

/**
 * List damage reports for a car.
 * @param id - Car id
 */
export async function getCarDamageReports(id: string): Promise<{ reports: CarDamageReport[] }> {
  return api(`/api/admin/cars/${id}/damage-reports`);
}

/**
 * Create a damage report (multipart for optional photos).
 * @param id - Car id
 * @param formData - Report fields + optional images
 */
export async function createCarDamageReport(
  id: string,
  formData: FormData
): Promise<{ report: CarDamageReport }> {
  return apiFormData(`/api/admin/cars/${id}/damage-reports`, formData);
}

/**
 * Mark a damage report as resolved.
 * @param carId - Car id
 * @param reportId - Damage report id
 */
export async function resolveCarDamageReport(
  carId: string,
  reportId: number
): Promise<{ report: CarDamageReport }> {
  return api(`/api/admin/cars/${carId}/damage-reports/${reportId}/resolve`, { method: 'POST' });
}

/**
 * Delete a damage report.
 * @param carId - Car id
 * @param reportId - Damage report id
 */
export async function deleteCarDamageReport(
  carId: string,
  reportId: number
): Promise<{ deleted: boolean }> {
  return api(`/api/admin/cars/${carId}/damage-reports/${reportId}`, { method: 'DELETE' });
}

/**
 * List uploaded documents for a car.
 * @param id - Car id
 */
export async function getCarDocuments(id: string): Promise<{ documents: CarDocument[] }> {
  return api(`/api/admin/cars/${id}/documents`);
}

/**
 * Upload a car document (multipart).
 * @param id - Car id
 * @param formData - Document metadata + file
 */
export async function uploadCarDocument(
  id: string,
  formData: FormData
): Promise<{ document: CarDocument }> {
  return apiFormData(`/api/admin/cars/${id}/documents`, formData);
}

/**
 * Download a car document via authenticated blob fetch.
 * @param carId - Car id
 * @param docId - Document id
 * @param filename - Suggested download filename
 */
export async function downloadCarDocument(
  carId: string,
  docId: number,
  filename: string
): Promise<void> {
  return downloadAuthenticated(
    `/api/admin/cars/${carId}/documents/${docId}/download`,
    filename
  );
}

/**
 * Delete a car document.
 * @param carId - Car id
 * @param docId - Document id
 */
export async function deleteCarDocument(
  carId: string,
  docId: number
): Promise<{ deleted: boolean }> {
  return api(`/api/admin/cars/${carId}/documents/${docId}`, { method: 'DELETE' });
}

/**
 * List compliance items for a car.
 * @param id - Car id
 */
export async function getCarCompliance(id: string): Promise<{ items: CarComplianceItem[] }> {
  return api(`/api/admin/cars/${id}/compliance`);
}

/**
 * Create a compliance item (multipart for optional attachment).
 * @param id - Car id
 * @param formData - Compliance fields + optional file
 */
export async function createCarCompliance(
  id: string,
  formData: FormData
): Promise<{ item: CarComplianceItem }> {
  return apiFormData(`/api/admin/cars/${id}/compliance`, formData);
}

/**
 * Update a compliance item (multipart PUT).
 * @param carId - Car id
 * @param itemId - Compliance item id
 * @param formData - Updated fields + optional file
 */
export async function updateCarCompliance(
  carId: string,
  itemId: number,
  formData: FormData
): Promise<{ item: CarComplianceItem }> {
  return apiFormData(`/api/admin/cars/${carId}/compliance/${itemId}`, formData, 'PUT');
}

/**
 * Download the file attached to a compliance item.
 * @param carId - Car id
 * @param itemId - Compliance item id
 * @param filename - Suggested download filename
 */
export async function downloadCarComplianceDocument(
  carId: string,
  itemId: number,
  filename: string
): Promise<void> {
  return downloadAuthenticated(
    `/api/admin/cars/${carId}/compliance/${itemId}/download`,
    filename
  );
}

/**
 * Delete a compliance item.
 * @param carId - Car id
 * @param itemId - Compliance item id
 */
export async function deleteCarCompliance(
  carId: string,
  itemId: number
): Promise<{ deleted: boolean }> {
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
  id: string,
  params: { pickupDate: string; returnDate: string; pickupTime?: string; returnTime?: string },
): Promise<{ available: boolean; conflicts: Array<{ startDate: string; endDate: string }> }> {
  // Required dates always present; times only when the form supplied them.
  const qs = new URLSearchParams({
    pickupDate: params.pickupDate,
    returnDate: params.returnDate,
    ...(params.pickupTime ? { pickupTime: params.pickupTime } : {}),
    ...(params.returnTime ? { returnTime: params.returnTime } : {}),
  });
  return api(`/api/admin/cars/${id}/availability?${qs.toString()}`);
}

export const CAR_FLEET_STATUSES: CarFleetStatus[] = [
  'available',
  'reserved',
  'rented',
  'needs_cleaning',
  'needs_inspection',
  'in_maintenance',
  'damaged',
  'inactive',
];

export const FUEL_LEVEL_OPTIONS = [
  { value: '', label: '—' },
  { value: 'empty', label: 'Empty' },
  { value: 'quarter', label: '1/4' },
  { value: 'half', label: '1/2' },
  { value: 'three_quarters', label: '3/4' },
  { value: 'full', label: 'Full' },
];

export const SERVICE_TYPE_OPTIONS = [
  { value: 'oil_change', label: 'Oil change' },
  { value: 'tires', label: 'Tires' },
  { value: 'brakes', label: 'Brakes' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'bodywork', label: 'Bodywork' },
  { value: 'other', label: 'Other' },
];

export const COMPLIANCE_TYPE_OPTIONS = [
  { value: 'civil_insurance', label: 'Гражданска отговорност' },
  { value: 'casco', label: 'Каско' },
  { value: 'vignette', label: 'Винетка' },
  { value: 'technical_inspection', label: 'ГТП / технически преглед' },
  { value: 'vehicle_tax', label: 'Данък МПС' },
  { value: 'registration_certificate', label: 'Талон / регистрация' },
  { value: 'fire_extinguisher', label: 'Пожарогасител' },
  { value: 'first_aid_kit', label: 'Аптечка' },
  { value: 'warning_triangle', label: 'Триъгълник' },
  { value: 'leasing', label: 'Лизинг / договор' },
  { value: 'other', label: 'Друго' },
];

/** Types that use issued/expiry dates and fleet expiry alerts. */
export const COMPLIANCE_TYPES_WITH_EXPIRY = new Set([
  'civil_insurance',
  'casco',
  'vignette',
  'technical_inspection',
  'vehicle_tax',
  'registration_certificate',
  'leasing',
  'other',
]);

/** Equipment without a validity period — no date fields in the form. */
export const COMPLIANCE_TYPES_WITHOUT_EXPIRY = new Set([
  'fire_extinguisher',
  'first_aid_kit',
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
  return COMPLIANCE_TYPES_WITH_EXPIRY.has(itemType);
}
