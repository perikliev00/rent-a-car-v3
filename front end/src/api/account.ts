import { api, apiFormData, API_BASE, toVersionedApiPath } from './client';

export type CustomerDocType = 'driver_license' | 'passport_id' | 'other';

export type PdfKind =
  | 'rental_agreement'
  | 'invoice'
  | 'receipt'
  | 'damage_report'
  | 'pickup_checklist'
  | 'return_checklist';

export interface CancellationRequest {
  id: number;
  reservationId: string;
  userId: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string | null;
  createdAt: string;
}

export interface AccountReservation {
  id: string;
  status: string;
  paymentStatus: string;
  carId?: string | null;
  carName?: string | null;
  pickupDate: string;
  pickupTime?: string | null;
  returnDate: string;
  returnTime?: string | null;
  pickupLocation: string;
  returnLocation: string;
  rentalDays: number;
  totalPrice: number;
  deposit?: number;
  fullName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  hotelName?: string | null;
  flightNumber?: string | null;
  specialRequests?: string | null;
  selectedExtras?: string[];
  hotelDelivery?: boolean;
  createdAt?: string;
  orderId?: string | null;
  pickupInstructions?: string[];
  returnInstructions?: string[];
  cancellationRequest?: CancellationRequest | null;
  hasPickupChecklist?: boolean;
  hasReturnChecklist?: boolean;
  availablePdfs?: PdfKind[];
  canRequestCancellation?: boolean;
}

export interface AccountDashboard {
  counts: { total: number; active: number; completed: number };
  upcoming: AccountReservation | null;
  recent: AccountReservation[];
}

export interface CustomerDocument {
  id: number;
  docType: CustomerDocType;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  reservationId: string | null;
  createdAt: string;
}

export async function getAccountDashboard(): Promise<AccountDashboard> {
  return api('/api/account/dashboard');
}

export async function listAccountReservations(): Promise<{ reservations: AccountReservation[] }> {
  return api('/api/account/reservations');
}

export async function getAccountReservation(
  id: string,
): Promise<{ reservation: AccountReservation }> {
  return api(`/api/account/reservations/${id}`);
}

export async function updateTravelDetails(
  id: string,
  body: {
    flightNumber?: string;
    hotelName?: string;
    address?: string;
    specialRequests?: string;
  },
): Promise<{ reservation: AccountReservation }> {
  return api(`/api/account/reservations/${id}/travel`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function requestCancellation(
  id: string,
  reason?: string,
): Promise<{
  immediate: boolean;
  reservation: AccountReservation;
  cancellationRequest: CancellationRequest | null;
}> {
  return api(`/api/account/reservations/${id}/cancel-request`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/**
 * Links a guest booking to the signed-in account. The raw token comes from the emailed
 * link and is never written to storage or analytics.
 */
export async function claimReservation(
  reservationId: string,
  token: string,
): Promise<{ reservationId: string; claimed: boolean; alreadyOwned: boolean }> {
  return api(`/api/account/reservations/${reservationId}/claim`, {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

/** Requests a claim link for a legacy guest booking; only ever mailed to the booking email. */
export async function requestClaimLink(
  reservationId: string,
  bookingEmail: string,
): Promise<{ requested: boolean }> {
  return api('/api/account/reservations/claim-request', {
    method: 'POST',
    body: JSON.stringify({ reservationId: Number(reservationId), bookingEmail }),
  });
}

export async function listCustomerDocuments(): Promise<{ documents: CustomerDocument[] }> {
  return api('/api/account/documents');
}

export async function uploadCustomerDocument(
  formData: FormData,
): Promise<{ document: CustomerDocument }> {
  return apiFormData('/api/account/documents', formData);
}

export async function deleteCustomerDocument(
  id: number,
): Promise<{ document: CustomerDocument }> {
  return api(`/api/account/documents/${id}`, { method: 'DELETE' });
}

async function downloadAuthenticated(path: string, fallbackName: string) {
  const res = await fetch(`${API_BASE}${toVersionedApiPath(path)}`, { credentials: 'include' });
  if (!res.ok) {
    throw new Error('Download failed');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fallbackName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadCustomerDocument(id: number, filename: string) {
  return downloadAuthenticated(`/api/account/documents/${id}/download`, filename);
}

export async function downloadReservationPdf(reservationId: string, kind: PdfKind) {
  return downloadAuthenticated(
    `/api/account/reservations/${reservationId}/pdf/${kind}`,
    `luxride-${kind}-${reservationId}.pdf`,
  );
}
