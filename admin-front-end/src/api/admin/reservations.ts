import { api, apiFormData } from '../client';

export type ReservationOpsStatus =
  | 'pending_payment'
  | 'processing_payment'
  | 'paid'
  | 'confirmed'
  | 'car_prepared'
  | 'picked_up'
  | 'active_rental'
  | 'returned'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'expired'
  | 'manual_review'
  | 'refunded';

export interface OpsReservationRow {
  id: string;
  status: ReservationOpsStatus;
  pickupDate: string;
  pickupTime?: string | null;
  returnDate: string;
  returnTime?: string | null;
  fullName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  carName?: string | null;
  orderId?: string | null;
  totalPrice?: number | null;
  cancelReason?: string | null;
  updatedAt?: string;
  refundOperation?: {
    id: number;
    status: 'pending' | 'succeeded' | 'failed';
    amountCents: number;
    currency: string;
    failureCode?: string | null;
    failureMessage?: string | null;
    updatedAt?: string | null;
  } | null;
}

export interface OpsDashboardData {
  today: string;
  limit: number;
  widgets: {
    todaysPickups: OpsReservationRow[];
    todaysReturns: OpsReservationRow[];
    activeRentals: OpsReservationRow[];
    overdueReturns: OpsReservationRow[];
    manualReview: OpsReservationRow[];
    paidNotConfirmed: OpsReservationRow[];
    cancelled: OpsReservationRow[];
    failedPayments: OpsReservationRow[];
  };
}

export const ADMIN_OPS_STATUS_OPTIONS: ReservationOpsStatus[] = [
  'car_prepared',
  'picked_up',
  'active_rental',
  'returned',
  'completed',
  'cancelled',
  'no_show',
  'confirmed',
];

export const REFUNDABLE_OPS_STATUSES: ReservationOpsStatus[] = [
  'paid',
  'manual_review',
  'confirmed',
  'car_prepared',
];

export interface ReservationStatusHistoryEntry {
  id: number;
  reservationId: string;
  oldStatus: string | null;
  newStatus: string;
  changedByUserId: number | null;
  changedBySystem: boolean;
  changedByEmail?: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ReservationDetailData {
  reservation: OpsReservationRow & Record<string, unknown>;
  history: ReservationStatusHistoryEntry[];
}

export async function getReservationOpsDashboard(limit = 20): Promise<OpsDashboardData> {
  return api<OpsDashboardData>(`/api/admin/reservations/ops-dashboard?limit=${limit}`);
}

export async function getReservationDetail(id: string): Promise<ReservationDetailData> {
  return api<ReservationDetailData>(`/api/admin/reservations/${id}`);
}

export async function changeReservationStatus(
  id: string,
  body: { status: ReservationOpsStatus; reason?: string }
): Promise<{
  reservation: OpsReservationRow & Record<string, unknown>;
  changed: boolean;
  oldStatus: string;
  newStatus: string;
}> {
  return api(`/api/admin/reservations/${id}/status`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function refundReservation(
  id: string,
  body?: { reason?: string }
): Promise<{
  status: 'succeeded' | 'pending' | 'failed';
  refundOperation: Record<string, unknown> | null;
  reservation: OpsReservationRow & Record<string, unknown>;
  idempotent?: boolean;
}> {
  return api(`/api/admin/reservations/${id}/refund`, {
    method: 'POST',
    body: JSON.stringify(body || {}),
  });
}

export interface CancellationRequestRow {
  id: number;
  reservationId: string;
  userId: string;
  reason: string | null;
  status: string;
  customerEmail?: string;
  customerName?: string;
  reservationStatus?: string;
  createdAt: string;
}

export interface ChecklistPayload {
  fuelLevel: string;
  mileage: number;
  existingDamages?: string;
  newDamages?: string;
  notes?: string;
  lateReturn?: boolean;
  extraFees?: number;
  pickupTime?: string;
  returnTime?: string;
  photos?: File[];
  customerSignature?: File | null;
  employeeSignature?: File | null;
}

function appendChecklistFormData(body: ChecklistPayload) {
  const formData = new FormData();
  formData.append('fuelLevel', body.fuelLevel);
  formData.append('mileage', String(body.mileage));
  if (body.existingDamages) formData.append('existingDamages', body.existingDamages);
  if (body.newDamages) formData.append('newDamages', body.newDamages);
  if (body.notes) formData.append('notes', body.notes);
  if (body.lateReturn != null) formData.append('lateReturn', String(body.lateReturn));
  if (body.extraFees != null) formData.append('extraFees', String(body.extraFees));
  if (body.pickupTime) formData.append('pickupTime', body.pickupTime);
  if (body.returnTime) formData.append('returnTime', body.returnTime);
  for (const photo of body.photos || []) {
    formData.append('photos', photo);
  }
  if (body.customerSignature) formData.append('customerSignature', body.customerSignature);
  if (body.employeeSignature) formData.append('employeeSignature', body.employeeSignature);
  return formData;
}

export async function listCancellationRequests(): Promise<{ requests: CancellationRequestRow[] }> {
  return api('/api/admin/reservations/cancellation-requests');
}

export async function reviewCancellationRequest(
  id: number,
  body: { approve: boolean; adminNote?: string }
) {
  return api(`/api/admin/reservations/cancellation-requests/${id}/review`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getReservationChecklists(id: string) {
  return api<{
    pickupChecklist: Record<string, unknown> | null;
    returnChecklist: Record<string, unknown> | null;
  }>(`/api/admin/reservations/${id}/checklists`);
}

export async function submitPickupChecklist(id: string, body: ChecklistPayload) {
  return apiFormData(`/api/admin/reservations/${id}/pickup-checklist`, appendChecklistFormData(body));
}

export async function submitReturnChecklist(id: string, body: ChecklistPayload) {
  return apiFormData(`/api/admin/reservations/${id}/return-checklist`, appendChecklistFormData(body));
}
