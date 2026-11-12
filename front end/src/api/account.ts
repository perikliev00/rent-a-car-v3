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
  // Contribute this line to the enclosing declaration or statement.
  | 'rental_agreement'
  // Contribute this line to the enclosing declaration or statement.
  | 'invoice'
  // Contribute this line to the enclosing declaration or statement.
  | 'receipt'
  // Contribute this line to the enclosing declaration or statement.
  | 'damage_report'
  // Contribute this line to the enclosing declaration or statement.
  | 'pickup_checklist'
  // Contribute this line to the enclosing declaration or statement.
  | 'return_checklist';

/** Pending or resolved cancellation request attached to a reservation. */
export interface CancellationRequest {
  // Provide the id field value.
  id: number;
  // Provide the reservation id field value.
  reservationId: string;
  // Provide the user id field value.
  userId: string;
  // Provide the reason field value.
  reason: string | null;
  // Provide the status field value.
  status: 'pending' | 'approved' | 'rejected';
  // Provide the admin note field value.
  adminNote: string | null;
  // Provide the created at field value.
  createdAt: string;
}

/** Customer-facing reservation summary used across account pages. */
export interface AccountReservation {
  // Provide the id field value.
  id: string;
  // Provide the status field value.
  status: string;
  // Provide the payment status field value.
  paymentStatus: string;
  // Contribute this line to the enclosing declaration or statement.
  carId?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  carName?: string | null;
  // Provide the pickup date field value.
  pickupDate: string;
  // Contribute this line to the enclosing declaration or statement.
  pickupTime?: string | null;
  // Provide the return date field value.
  returnDate: string;
  // Contribute this line to the enclosing declaration or statement.
  returnTime?: string | null;
  // Provide the pickup location field value.
  pickupLocation: string;
  // Provide the return location field value.
  returnLocation: string;
  // Provide the rental days field value.
  rentalDays: number;
  // Provide the total price field value.
  totalPrice: number;
  // Contribute this line to the enclosing declaration or statement.
  deposit?: number;
  // Contribute this line to the enclosing declaration or statement.
  fullName?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  email?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  phoneNumber?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  address?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  hotelName?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  flightNumber?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  specialRequests?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  selectedExtras?: string[];
  // Contribute this line to the enclosing declaration or statement.
  hotelDelivery?: boolean;
  // Contribute this line to the enclosing declaration or statement.
  createdAt?: string;
  // Contribute this line to the enclosing declaration or statement.
  orderId?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  pickupInstructions?: string[];
  // Contribute this line to the enclosing declaration or statement.
  returnInstructions?: string[];
  // Contribute this line to the enclosing declaration or statement.
  cancellationRequest?: CancellationRequest | null;
  // Contribute this line to the enclosing declaration or statement.
  hasPickupChecklist?: boolean;
  // Contribute this line to the enclosing declaration or statement.
  hasReturnChecklist?: boolean;
  // Contribute this line to the enclosing declaration or statement.
  availablePdfs?: PdfKind[];
  // Contribute this line to the enclosing declaration or statement.
  canRequestCancellation?: boolean;
}

/** Account home payload: counts plus upcoming/recent reservations. */
export interface AccountDashboard {
  // Provide the counts field value.
  counts: { total: number; active: number; completed: number };
  // Provide the upcoming field value.
  upcoming: AccountReservation | null;
  // Provide the recent field value.
  recent: AccountReservation[];
}

/** Metadata for a customer-uploaded identity or supporting document. */
export interface CustomerDocument {
  // Provide the id field value.
  id: number;
  // Provide the doc type field value.
  docType: CustomerDocType;
  // Provide the original filename field value.
  originalFilename: string;
  // Provide the mime type field value.
  mimeType: string;
  // Provide the size bytes field value.
  sizeBytes: number;
  // Provide the reservation id field value.
  reservationId: string | null;
  // Provide the created at field value.
  createdAt: string;
}

/**
 * Load dashboard counts and upcoming/recent reservations.
 *
 * @returns Account home summary for the signed-in customer.
 */
export async function getAccountDashboard(): Promise<AccountDashboard> {
  // Return the resulting value to the caller.
  return api('/api/account/dashboard');
}

/**
 * List all reservations for the signed-in customer.
 *
 * @returns Wrapper containing the reservations array.
 */
export async function listAccountReservations(): Promise<{ reservations: AccountReservation[] }> {
  // Return the resulting value to the caller.
  return api('/api/account/reservations');
}

/**
 * Fetch a single reservation including travel details and PDF availability.
 *
 * @param id - Reservation identifier.
 * @returns Wrapper containing the reservation record.
 */
export async function getAccountReservation(
  // Provide the id field value.
  id: string,
// Continue the surrounding logic with this statement.
): Promise<{ reservation: AccountReservation }> {
  // Return the resulting value to the caller.
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
  // Provide the id field value.
  id: string,
  // Provide the body field value.
  body: {
    // Contribute this line to the enclosing declaration or statement.
    flightNumber?: string;
    // Contribute this line to the enclosing declaration or statement.
    hotelName?: string;
    // Contribute this line to the enclosing declaration or statement.
    address?: string;
    // Contribute this line to the enclosing declaration or statement.
    specialRequests?: string;
  },
// Continue the surrounding logic with this statement.
): Promise<{ reservation: AccountReservation }> {
  // Return the resulting value to the caller.
  return api(`/api/account/reservations/${id}/travel`, {
    // Provide the method field value.
    method: 'PATCH',
    // Provide the body field value.
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
  // Provide the id field value.
  id: string,
  // Contribute this line to the enclosing declaration or statement.
  reason?: string,
// Continue the surrounding logic with this statement.
): Promise<{
  // Provide the immediate field value.
  immediate: boolean;
  // Provide the reservation field value.
  reservation: AccountReservation;
  // Provide the cancellation request field value.
  cancellationRequest: CancellationRequest | null;
// Continue the surrounding logic with this statement.
}> {
  // Return the resulting value to the caller.
  return api(`/api/account/reservations/${id}/cancel-request`, {
    // Provide the method field value.
    method: 'POST',
    // Provide the body field value.
    body: JSON.stringify({ reason }),
  });
}

/**
 * List uploaded customer documents.
 *
 * @returns Wrapper containing document metadata records.
 */
export async function listCustomerDocuments(): Promise<{ documents: CustomerDocument[] }> {
  // Return the resulting value to the caller.
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
  // Provide the form data field value.
  formData: FormData,
// Continue the surrounding logic with this statement.
): Promise<{ document: CustomerDocument }> {
  // Return the resulting value to the caller.
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
  // Provide the id field value.
  id: number,
// Continue the surrounding logic with this statement.
): Promise<{ document: CustomerDocument }> {
  // Return the resulting value to the caller.
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
  // Create the res constant.
  const res = await fetch(`${API_BASE}${toVersionedApiPath(path)}`, { credentials: 'include' });
  // Evaluate the condition and enter the branch when it is true.
  if (!res.ok) {
    // Throw an error to stop the current control flow.
    throw new Error('Download failed');
  }
  // Stream the body as a blob so we can hand it to the browser download UX.
  const blob = await res.blob();
  // Create the url constant.
  const url = URL.createObjectURL(blob);
  // Create the a constant.
  const a = document.createElement('a');
  // Update a.href with the right-hand side value.
  a.href = url;
  // Update a.download with the right-hand side value.
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
  // Return the resulting value to the caller.
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
  // Return the resulting value to the caller.
  return downloadAuthenticated(
    // Continue the surrounding logic with this statement.
    `/api/account/reservations/${reservationId}/pdf/${kind}`,
    // Continue the surrounding logic with this statement.
    `luxride-${kind}-${reservationId}.pdf`,
  );
}
