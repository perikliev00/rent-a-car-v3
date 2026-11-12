// Import fs from 'fs'.
import fs from 'fs';
// Import path from 'path'.
import path from 'path';
// Contribute this line to the enclosing declaration or statement.
import type { APIRequestContext, APIResponse, Page } from '@playwright/test';
// Import named exports from './test-env'.
import { API_URL } from './test-env';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  apiDelete,
  // Contribute this line to the enclosing declaration or statement.
  apiGet,
  // Contribute this line to the enclosing declaration or statement.
  apiPost,
  // Declare the ApiSession TypeScript type alias.
  type ApiSession,
// Contribute this line to the enclosing declaration or statement.
} from './csrf';

// Export the car image fixture const.
export const CAR_IMAGE_FIXTURE = path.join(__dirname, '..', 'fixtures', 'car-a.jpg');

// Export the create car fields type.
export type CreateCarFields = {
  // Provide the name field value.
  name: string;
  // Contribute this line to the enclosing declaration or statement.
  transmission?: string;
  // Contribute this line to the enclosing declaration or statement.
  fuelType?: string;
  // Contribute this line to the enclosing declaration or statement.
  seats?: string;
  // Contribute this line to the enclosing declaration or statement.
  priceTier_1_3?: string;
  // Contribute this line to the enclosing declaration or statement.
  priceTier_7_31?: string;
  // Contribute this line to the enclosing declaration or statement.
  priceTier_31_plus?: string;
  // Contribute this line to the enclosing declaration or statement.
  availability?: boolean;
};

// Define the ensureCarImageFixture function.
function ensureCarImageFixture(): void {
  // Evaluate the condition and enter the branch when it is true.
  if (fs.existsSync(CAR_IMAGE_FIXTURE) && fs.statSync(CAR_IMAGE_FIXTURE).size > 200) {
    // Return control to the caller with the following value.
    return;
  }
  // Throw an error to stop the current control flow.
  throw new Error(`Missing valid car image fixture at ${CAR_IMAGE_FIXTURE}`);
}

// Define the authHeaders function.
function authHeaders(session: ApiSession): Record<string, string> {
  // Return the resulting value to the caller.
  return {
    // Supply the literal value used by the enclosing expression.
    'X-CSRF-Token': session.csrfToken,
    // Provide the cookie field value.
    Cookie: session.cookieHeader,
  };
}

// Define the async function parseJson.
async function parseJson(res: APIResponse): Promise<any> {
  // Return the resulting value to the caller.
  return res.json().catch(() => ({}));
}

// Export the async createCarViaApi function.
export async function createCarViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the fields field value.
  fields: CreateCarFields,
  // Provide the session field value.
  session: ApiSession,
  // Provide the image path field value.
  imagePath: string = CAR_IMAGE_FIXTURE
// Continue the surrounding logic with this statement.
): Promise<{ status: number; body: any; carId?: number }> {
  // Call ensureCarImageFixture to perform this step.
  ensureCarImageFixture();
  // Create the res constant.
  const res = await request.post(`${API_URL}/api/admin/cars`, {
    // Provide the headers field value.
    headers: authHeaders(session),
    // Provide the multipart field value.
    multipart: {
      // Provide the name field value.
      name: fields.name,
      // Provide the transmission field value.
      transmission: fields.transmission ?? 'Automatic',
      // Provide the fuel type field value.
      fuelType: fields.fuelType ?? 'Petrol',
      // Provide the seats field value.
      seats: fields.seats ?? '5',
      // Provide the price tier 1 3 field value.
      priceTier_1_3: fields.priceTier_1_3 ?? '55',
      // Call ... to perform this step.
      ...(fields.priceTier_7_31 ? { priceTier_7_31: fields.priceTier_7_31 } : {}),
      // Call ... to perform this step.
      ...(fields.priceTier_31_plus ? { priceTier_31_plus: fields.priceTier_31_plus } : {}),
      // Call ... to perform this step.
      ...(fields.availability === false ? {} : { availability: 'on' }),
      // Provide the image field value.
      image: {
        // Provide the name field value.
        name: path.basename(imagePath),
        // Provide the mime type field value.
        mimeType: 'image/jpeg',
        // Provide the buffer field value.
        buffer: fs.readFileSync(imagePath),
      },
    },
  });
  // Create the body constant.
  const body = await parseJson(res);
  // Create the car constant.
  const car = body?.data?.car ?? body?.car;
  // Return the resulting value to the caller.
  return {
    // Provide the status field value.
    status: res.status(),
    // Contribute this line to the enclosing declaration or statement.
    body,
    // Provide the car id field value.
    carId: car?.id != null ? Number(car.id) : undefined,
  };
}

// Export the async updateCarViaApi function.
export async function updateCarViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the car id field value.
  carId: number | string,
  // Provide the fields field value.
  fields: Partial<CreateCarFields> & { name: string },
  // Provide the session field value.
  session: ApiSession,
  // Contribute this line to the enclosing declaration or statement.
  imagePath?: string
// Continue the surrounding logic with this statement.
): Promise<{ status: number; body: any }> {
  // Continue the surrounding logic with this statement.
  const multipart: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> = {
    // Provide the name field value.
    name: fields.name,
    // Provide the transmission field value.
    transmission: fields.transmission ?? 'Automatic',
    // Provide the fuel type field value.
    fuelType: fields.fuelType ?? 'Petrol',
    // Provide the seats field value.
    seats: fields.seats ?? '5',
    // Provide the price tier 1 3 field value.
    priceTier_1_3: fields.priceTier_1_3 ?? '55',
  };
  // Evaluate the condition and enter the branch when it is true.
  if (fields.availability !== false) multipart.availability = 'on';
  // Evaluate the condition and enter the branch when it is true.
  if (imagePath) {
    // Call ensureCarImageFixture to perform this step.
    ensureCarImageFixture();
    // Update multipart.image with the right-hand side value.
    multipart.image = {
      // Provide the name field value.
      name: path.basename(imagePath),
      // Provide the mime type field value.
      mimeType: 'image/jpeg',
      // Provide the buffer field value.
      buffer: fs.readFileSync(imagePath),
    };
  }
  // Create the res constant.
  const res = await request.put(`${API_URL}/api/admin/cars/${carId}`, {
    // Provide the headers field value.
    headers: authHeaders(session),
    // Contribute this line to the enclosing declaration or statement.
    multipart,
  });
  // Return the resulting value to the caller.
  return { status: res.status(), body: await parseJson(res) };
}

// Export the async deleteCarViaApi function.
export async function deleteCarViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the car id field value.
  carId: number | string,
  // Provide the session field value.
  session: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ status: number; body: any }> {
  // Create the res constant.
  const res = await apiDelete(request, `/api/admin/cars/${carId}`, session);
  // Return the resulting value to the caller.
  return { status: res.status(), body: await parseJson(res) };
}

// Export the async changeFleetStatusViaApi function.
export async function changeFleetStatusViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the car id field value.
  carId: number | string,
  // Provide the status field value.
  status: string,
  // Provide the session field value.
  session: ApiSession,
  // Contribute this line to the enclosing declaration or statement.
  reason?: string
// Continue the surrounding logic with this statement.
): Promise<{ status: number; body: any }> {
  // Create the res constant.
  const res = await apiPost(
    // Contribute this line to the enclosing declaration or statement.
    request,
    // Continue the surrounding logic with this statement.
    `/api/admin/cars/${carId}/status`,
    // Continue the surrounding logic with this statement.
    { status, ...(reason ? { reason } : {}) },
    // Reference the identifier used by the enclosing expression.
    session
  );
  // Return the resulting value to the caller.
  return { status: res.status(), body: await parseJson(res) };
}

// Export the async getFleetAlertsViaApi function.
export async function getFleetAlertsViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the session field value.
  session: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ status: number; body: any; alerts: any[] }> {
  // Create the res constant.
  const res = await apiGet(request, '/api/admin/cars/fleet-alerts', session);
  // Create the body constant.
  const body = await parseJson(res);
  // Create the alerts constant.
  const alerts = body?.data?.alerts ?? body?.alerts ?? [];
  // Return the resulting value to the caller.
  return { status: res.status(), body, alerts };
}

// Export the async reconcileFleetAlertsViaApi function.
export async function reconcileFleetAlertsViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the session field value.
  session: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ status: number; body: any; alerts: any[] }> {
  // Create the res constant.
  const res = await apiPost(request, '/api/admin/cars/fleet-alerts/reconcile', {}, session);
  // Create the body constant.
  const body = await parseJson(res);
  // Create the alerts constant.
  const alerts = body?.data?.alerts ?? body?.alerts ?? [];
  // Return the resulting value to the caller.
  return { status: res.status(), body, alerts };
}

// Export the async getPublicCars function.
export async function getPublicCars(
  // Provide the request field value.
  request: APIRequestContext
// Continue the surrounding logic with this statement.
): Promise<{ status: number; cars: any[] }> {
  // Create the res constant.
  const res = await request.get(`${API_URL}/api/cars`);
  // Create the body constant.
  const body = await parseJson(res);
  // Return the resulting value to the caller.
  return { status: res.status(), cars: body?.data?.cars ?? body?.cars ?? [] };
}

// Export the async searchPublicCars function.
export async function searchPublicCars(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the params field value.
  params: { pickupDate: string; returnDate: string; pickupTime?: string; returnTime?: string }
// Continue the surrounding logic with this statement.
): Promise<{ status: number; cars: any[] }> {
  // Create the qs constant.
  const qs = new URLSearchParams({
    // Supply the literal value used by the enclosing expression.
    'pickup-date': params.pickupDate,
    // Supply the literal value used by the enclosing expression.
    'return-date': params.returnDate,
    // Supply the literal value used by the enclosing expression.
    'pickup-time': params.pickupTime ?? '10:00',
    // Supply the literal value used by the enclosing expression.
    'return-time': params.returnTime ?? '10:00',
    // Supply the literal value used by the enclosing expression.
    'pickup-location': 'office',
    // Supply the literal value used by the enclosing expression.
    'return-location': 'office',
  });
  // Create the res constant.
  const res = await request.get(`${API_URL}/api/cars/search?${qs.toString()}`);
  // Create the body constant.
  const body = await parseJson(res);
  // Return the resulting value to the caller.
  return { status: res.status(), cars: body?.data?.cars ?? body?.cars ?? [] };
}

// Export the async createComplianceViaApi function.
export async function createComplianceViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the car id field value.
  carId: number | string,
  // Provide the fields field value.
  fields: {
    // Provide the item type field value.
    itemType: string;
    // Contribute this line to the enclosing declaration or statement.
    expiresAt?: string;
    // Contribute this line to the enclosing declaration or statement.
    title?: string;
    // Contribute this line to the enclosing declaration or statement.
    issuedAt?: string;
    // Contribute this line to the enclosing declaration or statement.
    status?: string;
  },
  // Provide the session field value.
  session: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ status: number; body: any; itemId?: number }> {
  // Continue the surrounding logic with this statement.
  const multipart: Record<string, string> = {
    // Provide the item type field value.
    itemType: fields.itemType,
  };
  // Evaluate the condition and enter the branch when it is true.
  if (fields.expiresAt) multipart.expiresAt = fields.expiresAt;
  // Evaluate the condition and enter the branch when it is true.
  if (fields.title) multipart.title = fields.title;
  // Evaluate the condition and enter the branch when it is true.
  if (fields.issuedAt) multipart.issuedAt = fields.issuedAt;
  // Evaluate the condition and enter the branch when it is true.
  if (fields.status) multipart.status = fields.status;

  // Create the res constant.
  const res = await request.post(`${API_URL}/api/admin/cars/${carId}/compliance`, {
    // Provide the headers field value.
    headers: authHeaders(session),
    // Contribute this line to the enclosing declaration or statement.
    multipart,
  });
  // Create the body constant.
  const body = await parseJson(res);
  // Create the item constant.
  const item = body?.data?.item ?? body?.item;
  // Return the resulting value to the caller.
  return {
    // Provide the status field value.
    status: res.status(),
    // Contribute this line to the enclosing declaration or statement.
    body,
    // Provide the item id field value.
    itemId: item?.id != null ? Number(item.id) : undefined,
  };
}

// Export the async deleteComplianceViaApi function.
export async function deleteComplianceViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the car id field value.
  carId: number | string,
  // Provide the item id field value.
  itemId: number | string,
  // Provide the session field value.
  session: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ status: number; body: any }> {
  // Create the res constant.
  const res = await apiDelete(request, `/api/admin/cars/${carId}/compliance/${itemId}`, session);
  // Return the resulting value to the caller.
  return { status: res.status(), body: await parseJson(res) };
}

// Export the async createServiceRecordViaApi function.
export async function createServiceRecordViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the car id field value.
  carId: number | string,
  // Provide the fields field value.
  fields: {
    // Provide the service type field value.
    serviceType: string;
    // Provide the service date field value.
    serviceDate: string;
    // Contribute this line to the enclosing declaration or statement.
    nextServiceDate?: string;
    // Contribute this line to the enclosing declaration or statement.
    description?: string;
    // Contribute this line to the enclosing declaration or statement.
    cost?: number;
  },
  // Provide the session field value.
  session: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ status: number; body: any; recordId?: number }> {
  // Create the res constant.
  const res = await apiPost(
    // Contribute this line to the enclosing declaration or statement.
    request,
    // Continue the surrounding logic with this statement.
    `/api/admin/cars/${carId}/service-records`,
    // Contribute this line to the enclosing declaration or statement.
    fields,
    // Reference the identifier used by the enclosing expression.
    session
  );
  // Create the body constant.
  const body = await parseJson(res);
  // Create the record constant.
  const record = body?.data?.record ?? body?.record;
  // Return the resulting value to the caller.
  return {
    // Provide the status field value.
    status: res.status(),
    // Contribute this line to the enclosing declaration or statement.
    body,
    // Provide the record id field value.
    recordId: record?.id != null ? Number(record.id) : undefined,
  };
}

// Export the async deleteServiceRecordViaApi function.
export async function deleteServiceRecordViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the car id field value.
  carId: number | string,
  // Provide the record id field value.
  recordId: number | string,
  // Provide the session field value.
  session: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ status: number; body: any }> {
  // Create the res constant.
  const res = await apiDelete(
    // Contribute this line to the enclosing declaration or statement.
    request,
    // Continue the surrounding logic with this statement.
    `/api/admin/cars/${carId}/service-records/${recordId}`,
    // Reference the identifier used by the enclosing expression.
    session
  );
  // Return the resulting value to the caller.
  return { status: res.status(), body: await parseJson(res) };
}

// Export the async createDamageReportViaApi function.
export async function createDamageReportViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the car id field value.
  carId: number | string,
  // Provide the fields field value.
  fields: { description: string; repairCost?: string },
  // Provide the session field value.
  session: ApiSession,
  // Contribute this line to the enclosing declaration or statement.
  photoPath?: string
// Continue the surrounding logic with this statement.
): Promise<{ status: number; body: any; reportId?: number }> {
  // Continue the surrounding logic with this statement.
  const multipart: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> = {
    // Provide the description field value.
    description: fields.description,
  };
  // Evaluate the condition and enter the branch when it is true.
  if (fields.repairCost) multipart.repairCost = fields.repairCost;
  // Evaluate the condition and enter the branch when it is true.
  if (photoPath) {
    // Call ensureCarImageFixture to perform this step.
    ensureCarImageFixture();
    // Update multipart.photos with the right-hand side value.
    multipart.photos = {
      // Provide the name field value.
      name: path.basename(photoPath),
      // Provide the mime type field value.
      mimeType: 'image/jpeg',
      // Provide the buffer field value.
      buffer: fs.readFileSync(photoPath),
    };
  }
  // Create the res constant.
  const res = await request.post(`${API_URL}/api/admin/cars/${carId}/damage-reports`, {
    // Provide the headers field value.
    headers: authHeaders(session),
    // Contribute this line to the enclosing declaration or statement.
    multipart,
  });
  // Create the body constant.
  const body = await parseJson(res);
  // Create the report constant.
  const report = body?.data?.report ?? body?.report;
  // Return the resulting value to the caller.
  return {
    // Provide the status field value.
    status: res.status(),
    // Contribute this line to the enclosing declaration or statement.
    body,
    // Provide the report id field value.
    reportId: report?.id != null ? Number(report.id) : undefined,
  };
}

// Export the async resolveDamageReportViaApi function.
export async function resolveDamageReportViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the car id field value.
  carId: number | string,
  // Provide the report id field value.
  reportId: number | string,
  // Provide the session field value.
  session: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ status: number; body: any }> {
  // Create the res constant.
  const res = await apiPost(
    // Contribute this line to the enclosing declaration or statement.
    request,
    // Continue the surrounding logic with this statement.
    `/api/admin/cars/${carId}/damage-reports/${reportId}/resolve`,
    {},
    // Reference the identifier used by the enclosing expression.
    session
  );
  // Return the resulting value to the caller.
  return { status: res.status(), body: await parseJson(res) };
}

// Export the async deleteDamageReportViaApi function.
export async function deleteDamageReportViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the car id field value.
  carId: number | string,
  // Provide the report id field value.
  reportId: number | string,
  // Provide the session field value.
  session: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ status: number; body: any }> {
  // Create the res constant.
  const res = await apiDelete(
    // Contribute this line to the enclosing declaration or statement.
    request,
    // Continue the surrounding logic with this statement.
    `/api/admin/cars/${carId}/damage-reports/${reportId}`,
    // Reference the identifier used by the enclosing expression.
    session
  );
  // Return the resulting value to the caller.
  return { status: res.status(), body: await parseJson(res) };
}

// Export the async uploadCarDocumentViaApi function.
export async function uploadCarDocumentViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the car id field value.
  carId: number | string,
  // Provide the session field value.
  session: ApiSession,
  // Provide the opts field value.
  opts: { name?: string; filePath?: string } = {}
// Continue the surrounding logic with this statement.
): Promise<{ status: number; body: any; docId?: number }> {
  // Create the file path constant.
  const filePath = opts.filePath ?? CAR_IMAGE_FIXTURE;
  // Call ensureCarImageFixture to perform this step.
  ensureCarImageFixture();
  // Continue the surrounding logic with this statement.
  const multipart: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> = {
    // Provide the name field value.
    name: opts.name ?? 'E2E car document',
    // Provide the file field value.
    file: {
      // Provide the name field value.
      name: path.basename(filePath),
      // Provide the mime type field value.
      mimeType: 'image/jpeg',
      // Provide the buffer field value.
      buffer: fs.readFileSync(filePath),
    },
  };
  // Create the res constant.
  const res = await request.post(`${API_URL}/api/admin/cars/${carId}/documents`, {
    // Provide the headers field value.
    headers: authHeaders(session),
    // Contribute this line to the enclosing declaration or statement.
    multipart,
  });
  // Create the body constant.
  const body = await parseJson(res);
  // Create the document constant.
  const document = body?.data?.document ?? body?.document;
  // Return the resulting value to the caller.
  return {
    // Provide the status field value.
    status: res.status(),
    // Contribute this line to the enclosing declaration or statement.
    body,
    // Provide the doc id field value.
    docId: document?.id != null ? Number(document.id) : undefined,
  };
}

// Export the async deleteCarDocumentViaApi function.
export async function deleteCarDocumentViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the car id field value.
  carId: number | string,
  // Provide the doc id field value.
  docId: number | string,
  // Provide the session field value.
  session: ApiSession
// Continue the surrounding logic with this statement.
): Promise<{ status: number; body: any }> {
  // Create the res constant.
  const res = await apiDelete(request, `/api/admin/cars/${carId}/documents/${docId}`, session);
  // Return the resulting value to the caller.
  return { status: res.status(), body: await parseJson(res) };
}

// Export the async getCarPerformanceViaApi function.
export async function getCarPerformanceViaApi(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the car id field value.
  carId: number | string,
  // Provide the session field value.
  session: ApiSession,
  // Provide the from field value.
  from: string,
  // Provide the to field value.
  to: string
// Continue the surrounding logic with this statement.
): Promise<{ status: number; body: any }> {
  // Create the qs constant.
  const qs = new URLSearchParams({ from, to });
  // Create the res constant.
  const res = await apiGet(request, `/api/admin/analytics/cars/${carId}?${qs.toString()}`, session);
  // Return the resulting value to the caller.
  return { status: res.status(), body: await parseJson(res) };
}

// Export the async createCarViaUi function.
export async function createCarViaUi(
  // Provide the page field value.
  page: Page,
  // Provide the fields field value.
  fields: CreateCarFields,
  // Provide the image path field value.
  imagePath: string = CAR_IMAGE_FIXTURE
// Continue the surrounding logic with this statement.
): Promise<void> {
  // Call ensureCarImageFixture to perform this step.
  ensureCarImageFixture();
  // Wait until the asynchronous operation resolves.
  await page.goto('/admin/cars');
  // Wait until the asynchronous operation resolves.
  await page.getByRole('button', { name: 'Add car' }).click();
  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Name').fill(fields.name);
  // Wait until the asynchronous operation resolves.
  await page.locator('input[type="file"]').setInputFiles(imagePath);
  // Wait until the asynchronous operation resolves.
  await page.getByLabel('Seats').fill(fields.seats ?? '5');
  // Wait until the asynchronous operation resolves.
  await page.getByLabel(/Price tier 1/).fill(fields.priceTier_1_3 ?? '55');
  // Wait until the asynchronous operation resolves.
  await page.getByRole('button', { name: 'Save' }).click();
  // Wait until the asynchronous operation resolves.
  await page.getByText('Car saved').waitFor({ timeout: 20_000 });
}

// Export the findCarByName function.
export function findCarByName(cars: any[], name: string): any | undefined {
  // Return the resulting value to the caller.
  return cars.find((c) => c?.name === name);
}

// Export the alertsForCar function.
export function alertsForCar(alerts: any[], carId: number | string): any[] {
  // Create the id constant.
  const id = String(carId);
  // Return the resulting value to the caller.
  return (alerts || []).filter((a) => String(a.carId) === id);
}
