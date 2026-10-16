/**
 * Authenticated customer-account API: dashboard, reservations, travel details,
 * cancellation requests, document upload/download, and reservation PDFs.
 *
 * Binary downloads bypass the JSON {@link api} helper and stream blobs so the
 * browser can trigger a file save with the correct filename.
 */
import { api, apiFormData, API_BASE, toVersionedApiPath } from './client';

/** Document categories a customer may upload for identity/verification. */
export type CustomerDocType = 'driver_license' | 'passport_id' | 'other';

/** Reservation PDF kinds available for authenticated download. */
export type PdfKind =
  | 'rental_agreement'
  | 'invoice'
  | 'receipt'
  | 'damage_report'
  | 'pickup_checklist'
  | 'return_checklist';

/** Pending or resolved cancellation request attached to a reservation. */
export interface CancellationRequest {
  id: number;
  reservationId: string;
  userId: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string | null;
  createdAt: string;
}

/** Customer-facing reservation summary used across account pages. */
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

/** Account home payload: counts plus upcoming/recent reservations. */
export interface AccountDashboard {
  counts: { total: number; active: number; completed: number };
  upcoming: AccountReservation | null;
  recent: AccountReservation[];
}

/** Metadata for a customer-uploaded identity or supporting document. */
export interface CustomerDocument {
  id: number;
  docType: CustomerDocType;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  reservationId: string | null;
  createdAt: string;
}

/**
 * Load dashboard counts and upcoming/recent reservations.
 *
 * @returns Account home summary for the signed-in customer.
 */
export async function getAccountDashboard(): Promise<AccountDashboard> {
  return api('/api/account/dashboard');
}

/**
 * List all reservations for the signed-in customer.
 *
 * @returns Wrapper containing the reservations array.
 */
export async function listAccountReservations(): Promise<{ reservations: AccountReservation[] }> {
  return api('/api/account/reservations');
}

/**
 * Fetch a single reservation including travel details and PDF availability.
 *
 * @param id - Reservation identifier.
 * @returns Wrapper containing the reservation record.
 */
export async function getAccountReservation(
  id: string,
): Promise<{ reservation: AccountReservation }> {
  return api(`/api/account/reservations/${id}`);
}

/**
 * Patch flight/hotel/address/special-request fields after booking.
 *
 * @param id - Reservation identifier.
 * @param body - Partial travel-details fields to update.
 * @returns Updated reservation after the patch.
 * @remarks Side effect: persists travel details on the server.
 */
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

/**
 * Request cancellation of a reservation.
 *
 * @param id - Reservation identifier.
 * @param reason - Optional free-text reason shown to staff.
 * @returns Whether cancellation was immediate, plus updated reservation and request record.
 * @remarks `immediate` means the backend cancelled without requiring admin approval.
 */
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
 * List uploaded customer documents.
 *
 * @returns Wrapper containing document metadata records.
 */
export async function listCustomerDocuments(): Promise<{ documents: CustomerDocument[] }> {
  return api('/api/account/documents');
}

/**
 * Upload a document via multipart form data.
 *
 * @param formData - Multipart body including file and document type fields.
 * @returns Created document metadata.
 * @remarks Side effect: stores the file privately on the server.
 */
export async function uploadCustomerDocument(
  formData: FormData,
): Promise<{ document: CustomerDocument }> {
  return apiFormData('/api/account/documents', formData);
}

/**
 * Soft-delete (or remove) a customer document by id.
 *
 * @param id - Document identifier.
 * @returns Deleted (or soft-deleted) document metadata.
 * @remarks Side effect: removes the document from the customer's account list.
 */
export async function deleteCustomerDocument(
  id: number,
): Promise<{ document: CustomerDocument }> {
  return api(`/api/account/documents/${id}`, { method: 'DELETE' });
}

/**
 * Authenticated binary download via cookie session.
 * Creates a temporary object URL and clicks a hidden anchor to save the file.
 *
 * @param path - API path (versioned by {@link toVersionedApiPath}).
 * @param fallbackName - Filename used for the browser download attribute.
 * @throws When the HTTP response is not ok.
 * @remarks Side effect: triggers a browser file download and revokes the object URL afterward.
 */
async function downloadAuthenticated(path: string, fallbackName: string) {
  const res = await fetch(`${API_BASE}${toVersionedApiPath(path)}`, { credentials: 'include' });
  if (!res.ok) {
    throw new Error('Download failed');
  }
  // Stream the body as a blob so we can hand it to the browser download UX.
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fallbackName;
  // Programmatic click starts the save dialog / download.
  a.click();
  // Release the object URL to avoid leaking blob memory.
  URL.revokeObjectURL(url);
}

/**
 * Download a previously uploaded customer document.
 *
 * @param id - Document identifier.
 * @param filename - Preferred download filename (usually the original upload name).
 * @remarks Side effect: triggers a browser download.
 */
export async function downloadCustomerDocument(id: number, filename: string) {
  return downloadAuthenticated(`/api/account/documents/${id}/download`, filename);
}

/**
 * Download a reservation PDF (agreement, invoice, checklists, etc.).
 *
 * @param reservationId - Reservation identifier.
 * @param kind - Which PDF document to fetch.
 * @remarks Side effect: triggers a browser download named `luxride-{kind}-{id}.pdf`.
 */
export async function downloadReservationPdf(reservationId: string, kind: PdfKind) {
  return downloadAuthenticated(
    `/api/account/reservations/${reservationId}/pdf/${kind}`,
    `luxride-${kind}-${reservationId}.pdf`,
  );
}
