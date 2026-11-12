/**
 * Reservation operations APIs: ops dashboard widgets, status transitions,
 * refunds, cancellation-request review, and pickup/return checklists.
 */
import { api, apiFormData } from '../client';

/** Lifecycle statuses shown/actionable in reservation ops. */
export type ReservationOpsStatus =
  // Contribute this line to the enclosing declaration or statement.
  | 'pending_payment'
  // Contribute this line to the enclosing declaration or statement.
  | 'processing_payment'
  // Contribute this line to the enclosing declaration or statement.
  | 'paid'
  // Contribute this line to the enclosing declaration or statement.
  | 'confirmed'
  // Contribute this line to the enclosing declaration or statement.
  | 'car_prepared'
  // Contribute this line to the enclosing declaration or statement.
  | 'picked_up'
  // Contribute this line to the enclosing declaration or statement.
  | 'active_rental'
  // Contribute this line to the enclosing declaration or statement.
  | 'returned'
  // Contribute this line to the enclosing declaration or statement.
  | 'completed'
  // Contribute this line to the enclosing declaration or statement.
  | 'cancelled'
  // Contribute this line to the enclosing declaration or statement.
  | 'no_show'
  // Contribute this line to the enclosing declaration or statement.
  | 'expired'
  // Contribute this line to the enclosing declaration or statement.
  | 'manual_review'
  // Contribute this line to the enclosing declaration or statement.
  | 'refunded';

// Export the ops reservation row interface.
export interface OpsReservationRow {
  // Provide the id field value.
  id: string;
  // Provide the status field value.
  status: ReservationOpsStatus;
  // Provide the pickup date field value.
  pickupDate: string;
  // Contribute this line to the enclosing declaration or statement.
  pickupTime?: string | null;
  // Provide the return date field value.
  returnDate: string;
  // Contribute this line to the enclosing declaration or statement.
  returnTime?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  fullName?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  email?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  phoneNumber?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  carName?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  orderId?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  totalPrice?: number | null;
  // Contribute this line to the enclosing declaration or statement.
  cancelReason?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  updatedAt?: string;
  // Contribute this line to the enclosing declaration or statement.
  refundOperation?: {
    // Provide the id field value.
    id: number;
    // Provide the status field value.
    status: 'pending' | 'succeeded' | 'failed';
    // Provide the amount cents field value.
    amountCents: number;
    // Provide the currency field value.
    currency: string;
    // Contribute this line to the enclosing declaration or statement.
    failureCode?: string | null;
    // Contribute this line to the enclosing declaration or statement.
    failureMessage?: string | null;
    // Contribute this line to the enclosing declaration or statement.
    updatedAt?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  } | null;
}

// Export the ops dashboard data interface.
export interface OpsDashboardData {
  // Provide the today field value.
  today: string;
  // Provide the limit field value.
  limit: number;
  // Provide the widgets field value.
  widgets: {
    // Provide the todays pickups field value.
    todaysPickups: OpsReservationRow[];
    // Provide the todays returns field value.
    todaysReturns: OpsReservationRow[];
    // Provide the active rentals field value.
    activeRentals: OpsReservationRow[];
    // Provide the overdue returns field value.
    overdueReturns: OpsReservationRow[];
    // Provide the manual review field value.
    manualReview: OpsReservationRow[];
    // Provide the paid not confirmed field value.
    paidNotConfirmed: OpsReservationRow[];
    // Provide the cancelled field value.
    cancelled: OpsReservationRow[];
    // Provide the failed payments field value.
    failedPayments: OpsReservationRow[];
  };
}

/** Manual status choices offered in ops UI (subset of full lifecycle). */
export const ADMIN_OPS_STATUS_OPTIONS: ReservationOpsStatus[] = [
  // Supply the literal value used by the enclosing expression.
  'car_prepared',
  // Supply the literal value used by the enclosing expression.
  'picked_up',
  // Supply the literal value used by the enclosing expression.
  'active_rental',
  // Supply the literal value used by the enclosing expression.
  'returned',
  // Supply the literal value used by the enclosing expression.
  'completed',
  // Supply the literal value used by the enclosing expression.
  'cancelled',
  // Supply the literal value used by the enclosing expression.
  'no_show',
  // Supply the literal value used by the enclosing expression.
  'confirmed',
];

/** Statuses where a refund action is allowed in the ops/payments UI. */
export const REFUNDABLE_OPS_STATUSES: ReservationOpsStatus[] = [
  // Supply the literal value used by the enclosing expression.
  'paid',
  // Supply the literal value used by the enclosing expression.
  'manual_review',
  // Supply the literal value used by the enclosing expression.
  'confirmed',
  // Supply the literal value used by the enclosing expression.
  'car_prepared',
];

// Export the reservation status history entry interface.
export interface ReservationStatusHistoryEntry {
  // Provide the id field value.
  id: number;
  // Provide the reservation id field value.
  reservationId: string;
  // Provide the old status field value.
  oldStatus: string | null;
  // Provide the new status field value.
  newStatus: string;
  // Provide the changed by user id field value.
  changedByUserId: number | null;
  // Provide the changed by system field value.
  changedBySystem: boolean;
  // Contribute this line to the enclosing declaration or statement.
  changedByEmail?: string | null;
  // Provide the reason field value.
  reason: string | null;
  // Provide the metadata field value.
  metadata: Record<string, unknown> | null;
  // Provide the created at field value.
  createdAt: string;
}

// Export the reservation detail data interface.
export interface ReservationDetailData {
  // Provide the reservation field value.
  reservation: OpsReservationRow & Record<string, unknown>;
  // Provide the history field value.
  history: ReservationStatusHistoryEntry[];
}

/**
 * Widget buckets for today's pickups/returns, overdue, review, etc.
 * @param limit - Max rows per widget bucket (default 20)
 */
export async function getReservationOpsDashboard(limit = 20): Promise<OpsDashboardData> {
  // Return the resulting value to the caller.
  return api<OpsDashboardData>(`/api/admin/reservations/ops-dashboard?limit=${limit}`);
}

/**
 * Reservation detail plus status-history timeline.
 * @param id - Reservation id
 */
export async function getReservationDetail(id: string): Promise<ReservationDetailData> {
  // Return the resulting value to the caller.
  return api<ReservationDetailData>(`/api/admin/reservations/${id}`);
}

/**
 * Manual ops status transition with optional reason.
 *
 * @param id - Reservation id
 * @param body.status - Target ops status
 * @param body.reason - Optional reason stored on the history entry
 */
export async function changeReservationStatus(
  // Provide the id field value.
  id: string,
  // Provide the body field value.
  body: { status: ReservationOpsStatus; reason?: string }
// Continue the surrounding logic with this statement.
): Promise<{
  // Provide the reservation field value.
  reservation: OpsReservationRow & Record<string, unknown>;
  // Provide the changed field value.
  changed: boolean;
  // Provide the old status field value.
  oldStatus: string;
  // Provide the new status field value.
  newStatus: string;
// Continue the surrounding logic with this statement.
}> {
  // Return the resulting value to the caller.
  return api(`/api/admin/reservations/${id}/status`, {
    // Provide the method field value.
    method: 'POST',
    // Provide the body field value.
    body: JSON.stringify(body),
  });
}

/**
 * Initiates a refund; may return pending/succeeded/failed.
 * `idempotent` indicates a repeat submit reused an existing operation.
 *
 * @param id - Reservation id
 * @param body.reason - Optional refund reason
 */
export async function refundReservation(
  // Provide the id field value.
  id: string,
  // Contribute this line to the enclosing declaration or statement.
  body?: { reason?: string }
// Continue the surrounding logic with this statement.
): Promise<{
  // Provide the status field value.
  status: 'succeeded' | 'pending' | 'failed';
  // Provide the refund operation field value.
  refundOperation: Record<string, unknown> | null;
  // Provide the reservation field value.
  reservation: OpsReservationRow & Record<string, unknown>;
  // Contribute this line to the enclosing declaration or statement.
  idempotent?: boolean;
// Continue the surrounding logic with this statement.
}> {
  // Empty object when no body so the API always receives JSON.
  return api(`/api/admin/reservations/${id}/refund`, {
    // Provide the method field value.
    method: 'POST',
    // Provide the body field value.
    body: JSON.stringify(body || {}),
  });
}

// Export the cancellation request row interface.
export interface CancellationRequestRow {
  // Provide the id field value.
  id: number;
  // Provide the reservation id field value.
  reservationId: string;
  // Provide the user id field value.
  userId: string;
  // Provide the reason field value.
  reason: string | null;
  // Provide the status field value.
  status: string;
  // Contribute this line to the enclosing declaration or statement.
  customerEmail?: string;
  // Contribute this line to the enclosing declaration or statement.
  customerName?: string;
  // Contribute this line to the enclosing declaration or statement.
  reservationStatus?: string;
  // Provide the created at field value.
  createdAt: string;
}

// Export the checklist payload interface.
export interface ChecklistPayload {
  // Provide the fuel level field value.
  fuelLevel: string;
  // Provide the mileage field value.
  mileage: number;
  // Contribute this line to the enclosing declaration or statement.
  existingDamages?: string;
  // Contribute this line to the enclosing declaration or statement.
  newDamages?: string;
  // Contribute this line to the enclosing declaration or statement.
  notes?: string;
  // Contribute this line to the enclosing declaration or statement.
  lateReturn?: boolean;
  // Contribute this line to the enclosing declaration or statement.
  extraFees?: number;
  // Contribute this line to the enclosing declaration or statement.
  pickupTime?: string;
  // Contribute this line to the enclosing declaration or statement.
  returnTime?: string;
  // Contribute this line to the enclosing declaration or statement.
  photos?: File[];
  // Contribute this line to the enclosing declaration or statement.
  customerSignature?: File | null;
  // Contribute this line to the enclosing declaration or statement.
  employeeSignature?: File | null;
}

/**
 * Builds multipart FormData for checklist photos and signature files.
 * Optional text/number fields are omitted when unset; booleans/fees use `!= null`.
 *
 * @param body - Checklist form values from the ops UI
 */
function appendChecklistFormData(body: ChecklistPayload) {
  // Create the form data constant.
  const formData = new FormData();
  // Required scalar fields
  formData.append('fuelLevel', body.fuelLevel);
  // Call formData.append to perform this step.
  formData.append('mileage', String(body.mileage));
  // Optional text notes
  if (body.existingDamages) formData.append('existingDamages', body.existingDamages);
  // Evaluate the condition and enter the branch when it is true.
  if (body.newDamages) formData.append('newDamages', body.newDamages);
  // Evaluate the condition and enter the branch when it is true.
  if (body.notes) formData.append('notes', body.notes);
  // Booleans/fees: allow `false` / `0` via `!= null`
  if (body.lateReturn != null) formData.append('lateReturn', String(body.lateReturn));
  // Evaluate the condition and enter the branch when it is true.
  if (body.extraFees != null) formData.append('extraFees', String(body.extraFees));
  // Evaluate the condition and enter the branch when it is true.
  if (body.pickupTime) formData.append('pickupTime', body.pickupTime);
  // Evaluate the condition and enter the branch when it is true.
  if (body.returnTime) formData.append('returnTime', body.returnTime);
  // Multiple photos share the same field name expected by multer.
  for (const photo of body.photos || []) {
    // Call formData.append to perform this step.
    formData.append('photos', photo);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (body.customerSignature) formData.append('customerSignature', body.customerSignature);
  // Evaluate the condition and enter the branch when it is true.
  if (body.employeeSignature) formData.append('employeeSignature', body.employeeSignature);
  // Return the resulting value to the caller.
  return formData;
}

/**
 * List customer cancellation requests awaiting admin review.
 */
export async function listCancellationRequests(): Promise<{ requests: CancellationRequestRow[] }> {
  // Return the resulting value to the caller.
  return api('/api/admin/reservations/cancellation-requests');
}

/**
 * Approve or reject a cancellation request.
 *
 * @param id - Cancellation request id
 * @param body.approve - True to approve, false to reject
 * @param body.adminNote - Optional note returned to ops/customer flows
 */
export async function reviewCancellationRequest(
  // Provide the id field value.
  id: number,
  // Provide the body field value.
  body: { approve: boolean; adminNote?: string }
// Continue the surrounding logic with this statement.
) {
  // Return the resulting value to the caller.
  return api(`/api/admin/reservations/cancellation-requests/${id}/review`, {
    // Provide the method field value.
    method: 'POST',
    // Provide the body field value.
    body: JSON.stringify(body),
  });
}

/**
 * Load pickup and return checklist payloads for a reservation (if any).
 * @param id - Reservation id
 */
export async function getReservationChecklists(id: string) {
  // Return the resulting value to the caller.
  return api<{
    // Provide the pickup checklist field value.
    pickupChecklist: Record<string, unknown> | null;
    // Provide the return checklist field value.
    returnChecklist: Record<string, unknown> | null;
  // Continue the surrounding logic with this statement.
  }>(`/api/admin/reservations/${id}/checklists`);
}

/**
 * Submit the pickup checklist (multipart for photos/signatures).
 * @param id - Reservation id
 * @param body - Checklist fields and files
 */
export async function submitPickupChecklist(id: string, body: ChecklistPayload) {
  // Return the resulting value to the caller.
  return apiFormData(`/api/admin/reservations/${id}/pickup-checklist`, appendChecklistFormData(body));
}

/**
 * Submit the return checklist (multipart for photos/signatures).
 * @param id - Reservation id
 * @param body - Checklist fields and files
 */
export async function submitReturnChecklist(id: string, body: ChecklistPayload) {
  // Return the resulting value to the caller.
  return apiFormData(`/api/admin/reservations/${id}/return-checklist`, appendChecklistFormData(body));
}
