import type {
  Car,
  CarComplianceItem,
  CarDamageReport,
  CarDocument,
  CarFleetStatus,
  CarServiceRecord,
} from '../../types/api';
import { api, apiFormData, downloadAuthenticated } from '../client';

export async function getAdminCars(): Promise<{ cars: Car[] }> {
  return api<{ cars: Car[] }>('/api/admin/cars');
}

export type FleetAlertSeverity = 'critical' | 'warning' | 'info';

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

export async function getFleetAlerts(): Promise<FleetAlertsData> {
  return api<FleetAlertsData>('/api/admin/cars/fleet-alerts');
}

export async function reconcileFleetAlerts(): Promise<
  FleetAlertsData & { reconcile?: Record<string, unknown> }
> {
  return api('/api/admin/cars/fleet-alerts/reconcile', { method: 'POST' });
}

export async function getAdminCar(id: string): Promise<{ car: Car }> {
  return api<{ car: Car }>(`/api/admin/cars/${id}`);
}

export async function createAdminCar(formData: FormData): Promise<{ car: Car }> {
  return apiFormData<{ car: Car }>('/api/admin/cars', formData);
}

export async function updateAdminCar(id: string, formData: FormData): Promise<{ car: Car }> {
  return apiFormData<{ car: Car }>(`/api/admin/cars/${id}`, formData, 'PUT');
}

export async function deleteAdminCar(id: string): Promise<{ deleted: boolean; id: number }> {
  return api<{ deleted: boolean; id: number }>(`/api/admin/cars/${id}`, { method: 'DELETE' });
}

export async function changeCarFleetStatus(
  id: string,
  body: { status: CarFleetStatus; reason?: string }
): Promise<{ car: Car; oldStatus: string; newStatus: string }> {
  return api(`/api/admin/cars/${id}/status`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getCarServiceRecords(id: string): Promise<{ records: CarServiceRecord[] }> {
  return api(`/api/admin/cars/${id}/service-records`);
}

export async function createCarServiceRecord(
  id: string,
  body: Record<string, unknown>
): Promise<{ record: CarServiceRecord }> {
  return api(`/api/admin/cars/${id}/service-records`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function deleteCarServiceRecord(
  carId: string,
  recordId: number
): Promise<{ deleted: boolean }> {
  return api(`/api/admin/cars/${carId}/service-records/${recordId}`, { method: 'DELETE' });
}

export async function getCarDamageReports(id: string): Promise<{ reports: CarDamageReport[] }> {
  return api(`/api/admin/cars/${id}/damage-reports`);
}

export async function createCarDamageReport(
  id: string,
  formData: FormData
): Promise<{ report: CarDamageReport }> {
  return apiFormData(`/api/admin/cars/${id}/damage-reports`, formData);
}

export async function resolveCarDamageReport(
  carId: string,
  reportId: number
): Promise<{ report: CarDamageReport }> {
  return api(`/api/admin/cars/${carId}/damage-reports/${reportId}/resolve`, { method: 'POST' });
}

export async function deleteCarDamageReport(
  carId: string,
  reportId: number
): Promise<{ deleted: boolean }> {
  return api(`/api/admin/cars/${carId}/damage-reports/${reportId}`, { method: 'DELETE' });
}

export async function getCarDocuments(id: string): Promise<{ documents: CarDocument[] }> {
  return api(`/api/admin/cars/${id}/documents`);
}

export async function uploadCarDocument(
  id: string,
  formData: FormData
): Promise<{ document: CarDocument }> {
  return apiFormData(`/api/admin/cars/${id}/documents`, formData);
}

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

export async function deleteCarDocument(
  carId: string,
  docId: number
): Promise<{ deleted: boolean }> {
  return api(`/api/admin/cars/${carId}/documents/${docId}`, { method: 'DELETE' });
}

export async function getCarCompliance(id: string): Promise<{ items: CarComplianceItem[] }> {
  return api(`/api/admin/cars/${id}/compliance`);
}

export async function createCarCompliance(
  id: string,
  formData: FormData
): Promise<{ item: CarComplianceItem }> {
  return apiFormData(`/api/admin/cars/${id}/compliance`, formData);
}

export async function updateCarCompliance(
  carId: string,
  itemId: number,
  formData: FormData
): Promise<{ item: CarComplianceItem }> {
  return apiFormData(`/api/admin/cars/${carId}/compliance/${itemId}`, formData, 'PUT');
}

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

export async function deleteCarCompliance(
  carId: string,
  itemId: number
): Promise<{ deleted: boolean }> {
  return api(`/api/admin/cars/${carId}/compliance/${itemId}`, { method: 'DELETE' });
}

export async function checkCarAvailability(
  id: string,
  params: { pickupDate: string; returnDate: string; pickupTime?: string; returnTime?: string },
): Promise<{ available: boolean; conflicts: Array<{ startDate: string; endDate: string }> }> {
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

export function complianceTypeHasExpiry(itemType: string): boolean {
  if (COMPLIANCE_TYPES_WITHOUT_EXPIRY.has(itemType)) return false;
  return COMPLIANCE_TYPES_WITH_EXPIRY.has(itemType);
}
