import fs from 'fs';
import path from 'path';
import type { APIRequestContext, APIResponse, Page } from '@playwright/test';
import { API_URL } from './test-env';
import {
  apiDelete,
  apiGet,
  apiPost,
  type ApiSession,
} from './csrf';

export const CAR_IMAGE_FIXTURE = path.join(__dirname, '..', 'fixtures', 'car-a.jpg');

export type CreateCarFields = {
  name: string;
  transmission?: string;
  fuelType?: string;
  seats?: string;
  priceTier_1_3?: string;
  priceTier_7_31?: string;
  priceTier_31_plus?: string;
  availability?: boolean;
};

function ensureCarImageFixture(): void {
  if (fs.existsSync(CAR_IMAGE_FIXTURE) && fs.statSync(CAR_IMAGE_FIXTURE).size > 200) {
    return;
  }
  throw new Error(`Missing valid car image fixture at ${CAR_IMAGE_FIXTURE}`);
}

function authHeaders(session: ApiSession): Record<string, string> {
  return {
    'X-CSRF-Token': session.csrfToken,
    Cookie: session.cookieHeader,
  };
}

async function parseJson(res: APIResponse): Promise<any> {
  return res.json().catch(() => ({}));
}

export async function createCarViaApi(
  request: APIRequestContext,
  fields: CreateCarFields,
  session: ApiSession,
  imagePath: string = CAR_IMAGE_FIXTURE
): Promise<{ status: number; body: any; carId?: number }> {
  ensureCarImageFixture();
  const res = await request.post(`${API_URL}/api/admin/cars`, {
    headers: authHeaders(session),
    multipart: {
      name: fields.name,
      transmission: fields.transmission ?? 'Automatic',
      fuelType: fields.fuelType ?? 'Petrol',
      seats: fields.seats ?? '5',
      priceTier_1_3: fields.priceTier_1_3 ?? '55',
      ...(fields.priceTier_7_31 ? { priceTier_7_31: fields.priceTier_7_31 } : {}),
      ...(fields.priceTier_31_plus ? { priceTier_31_plus: fields.priceTier_31_plus } : {}),
      ...(fields.availability === false ? {} : { availability: 'on' }),
      image: {
        name: path.basename(imagePath),
        mimeType: 'image/jpeg',
        buffer: fs.readFileSync(imagePath),
      },
    },
  });
  const body = await parseJson(res);
  const car = body?.data?.car ?? body?.car;
  return {
    status: res.status(),
    body,
    carId: car?.id != null ? Number(car.id) : undefined,
  };
}

export async function updateCarViaApi(
  request: APIRequestContext,
  carId: number | string,
  fields: Partial<CreateCarFields> & { name: string },
  session: ApiSession,
  imagePath?: string
): Promise<{ status: number; body: any }> {
  const multipart: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> = {
    name: fields.name,
    transmission: fields.transmission ?? 'Automatic',
    fuelType: fields.fuelType ?? 'Petrol',
    seats: fields.seats ?? '5',
    priceTier_1_3: fields.priceTier_1_3 ?? '55',
  };
  if (fields.availability !== false) multipart.availability = 'on';
  if (imagePath) {
    ensureCarImageFixture();
    multipart.image = {
      name: path.basename(imagePath),
      mimeType: 'image/jpeg',
      buffer: fs.readFileSync(imagePath),
    };
  }
  const res = await request.put(`${API_URL}/api/admin/cars/${carId}`, {
    headers: authHeaders(session),
    multipart,
  });
  return { status: res.status(), body: await parseJson(res) };
}

export async function deleteCarViaApi(
  request: APIRequestContext,
  carId: number | string,
  session: ApiSession
): Promise<{ status: number; body: any }> {
  const res = await apiDelete(request, `/api/admin/cars/${carId}`, session);
  return { status: res.status(), body: await parseJson(res) };
}

export async function changeFleetStatusViaApi(
  request: APIRequestContext,
  carId: number | string,
  status: string,
  session: ApiSession,
  reason?: string
): Promise<{ status: number; body: any }> {
  const res = await apiPost(
    request,
    `/api/admin/cars/${carId}/status`,
    { status, ...(reason ? { reason } : {}) },
    session
  );
  return { status: res.status(), body: await parseJson(res) };
}

export async function getFleetAlertsViaApi(
  request: APIRequestContext,
  session: ApiSession
): Promise<{ status: number; body: any; alerts: any[] }> {
  const res = await apiGet(request, '/api/admin/cars/fleet-alerts', session);
  const body = await parseJson(res);
  const alerts = body?.data?.alerts ?? body?.alerts ?? [];
  return { status: res.status(), body, alerts };
}

export async function reconcileFleetAlertsViaApi(
  request: APIRequestContext,
  session: ApiSession
): Promise<{ status: number; body: any; alerts: any[] }> {
  const res = await apiPost(request, '/api/admin/cars/fleet-alerts/reconcile', {}, session);
  const body = await parseJson(res);
  const alerts = body?.data?.alerts ?? body?.alerts ?? [];
  return { status: res.status(), body, alerts };
}

export async function getPublicCars(
  request: APIRequestContext
): Promise<{ status: number; cars: any[] }> {
  const res = await request.get(`${API_URL}/api/cars`);
  const body = await parseJson(res);
  return { status: res.status(), cars: body?.data?.cars ?? body?.cars ?? [] };
}

export async function searchPublicCars(
  request: APIRequestContext,
  params: { pickupDate: string; returnDate: string; pickupTime?: string; returnTime?: string }
): Promise<{ status: number; cars: any[] }> {
  const qs = new URLSearchParams({
    'pickup-date': params.pickupDate,
    'return-date': params.returnDate,
    'pickup-time': params.pickupTime ?? '10:00',
    'return-time': params.returnTime ?? '10:00',
    'pickup-location': 'office',
    'return-location': 'office',
  });
  const res = await request.get(`${API_URL}/api/cars/search?${qs.toString()}`);
  const body = await parseJson(res);
  return { status: res.status(), cars: body?.data?.cars ?? body?.cars ?? [] };
}

export async function createComplianceViaApi(
  request: APIRequestContext,
  carId: number | string,
  fields: {
    itemType: string;
    expiresAt?: string;
    title?: string;
    issuedAt?: string;
    status?: string;
  },
  session: ApiSession
): Promise<{ status: number; body: any; itemId?: number }> {
  const multipart: Record<string, string> = {
    itemType: fields.itemType,
  };
  if (fields.expiresAt) multipart.expiresAt = fields.expiresAt;
  if (fields.title) multipart.title = fields.title;
  if (fields.issuedAt) multipart.issuedAt = fields.issuedAt;
  if (fields.status) multipart.status = fields.status;

  const res = await request.post(`${API_URL}/api/admin/cars/${carId}/compliance`, {
    headers: authHeaders(session),
    multipart,
  });
  const body = await parseJson(res);
  const item = body?.data?.item ?? body?.item;
  return {
    status: res.status(),
    body,
    itemId: item?.id != null ? Number(item.id) : undefined,
  };
}

export async function deleteComplianceViaApi(
  request: APIRequestContext,
  carId: number | string,
  itemId: number | string,
  session: ApiSession
): Promise<{ status: number; body: any }> {
  const res = await apiDelete(request, `/api/admin/cars/${carId}/compliance/${itemId}`, session);
  return { status: res.status(), body: await parseJson(res) };
}

export async function createServiceRecordViaApi(
  request: APIRequestContext,
  carId: number | string,
  fields: {
    serviceType: string;
    serviceDate: string;
    nextServiceDate?: string;
    description?: string;
    cost?: number;
  },
  session: ApiSession
): Promise<{ status: number; body: any; recordId?: number }> {
  const res = await apiPost(
    request,
    `/api/admin/cars/${carId}/service-records`,
    fields,
    session
  );
  const body = await parseJson(res);
  const record = body?.data?.record ?? body?.record;
  return {
    status: res.status(),
    body,
    recordId: record?.id != null ? Number(record.id) : undefined,
  };
}

export async function deleteServiceRecordViaApi(
  request: APIRequestContext,
  carId: number | string,
  recordId: number | string,
  session: ApiSession
): Promise<{ status: number; body: any }> {
  const res = await apiDelete(
    request,
    `/api/admin/cars/${carId}/service-records/${recordId}`,
    session
  );
  return { status: res.status(), body: await parseJson(res) };
}

export async function createDamageReportViaApi(
  request: APIRequestContext,
  carId: number | string,
  fields: { description: string; repairCost?: string },
  session: ApiSession,
  photoPath?: string
): Promise<{ status: number; body: any; reportId?: number }> {
  const multipart: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> = {
    description: fields.description,
  };
  if (fields.repairCost) multipart.repairCost = fields.repairCost;
  if (photoPath) {
    ensureCarImageFixture();
    multipart.photos = {
      name: path.basename(photoPath),
      mimeType: 'image/jpeg',
      buffer: fs.readFileSync(photoPath),
    };
  }
  const res = await request.post(`${API_URL}/api/admin/cars/${carId}/damage-reports`, {
    headers: authHeaders(session),
    multipart,
  });
  const body = await parseJson(res);
  const report = body?.data?.report ?? body?.report;
  return {
    status: res.status(),
    body,
    reportId: report?.id != null ? Number(report.id) : undefined,
  };
}

export async function resolveDamageReportViaApi(
  request: APIRequestContext,
  carId: number | string,
  reportId: number | string,
  session: ApiSession
): Promise<{ status: number; body: any }> {
  const res = await apiPost(
    request,
    `/api/admin/cars/${carId}/damage-reports/${reportId}/resolve`,
    {},
    session
  );
  return { status: res.status(), body: await parseJson(res) };
}

export async function deleteDamageReportViaApi(
  request: APIRequestContext,
  carId: number | string,
  reportId: number | string,
  session: ApiSession
): Promise<{ status: number; body: any }> {
  const res = await apiDelete(
    request,
    `/api/admin/cars/${carId}/damage-reports/${reportId}`,
    session
  );
  return { status: res.status(), body: await parseJson(res) };
}

export async function uploadCarDocumentViaApi(
  request: APIRequestContext,
  carId: number | string,
  session: ApiSession,
  opts: { name?: string; filePath?: string } = {}
): Promise<{ status: number; body: any; docId?: number }> {
  const filePath = opts.filePath ?? CAR_IMAGE_FIXTURE;
  ensureCarImageFixture();
  const multipart: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> = {
    name: opts.name ?? 'E2E car document',
    file: {
      name: path.basename(filePath),
      mimeType: 'image/jpeg',
      buffer: fs.readFileSync(filePath),
    },
  };
  const res = await request.post(`${API_URL}/api/admin/cars/${carId}/documents`, {
    headers: authHeaders(session),
    multipart,
  });
  const body = await parseJson(res);
  const document = body?.data?.document ?? body?.document;
  return {
    status: res.status(),
    body,
    docId: document?.id != null ? Number(document.id) : undefined,
  };
}

export async function deleteCarDocumentViaApi(
  request: APIRequestContext,
  carId: number | string,
  docId: number | string,
  session: ApiSession
): Promise<{ status: number; body: any }> {
  const res = await apiDelete(request, `/api/admin/cars/${carId}/documents/${docId}`, session);
  return { status: res.status(), body: await parseJson(res) };
}

export async function getCarPerformanceViaApi(
  request: APIRequestContext,
  carId: number | string,
  session: ApiSession,
  from: string,
  to: string
): Promise<{ status: number; body: any }> {
  const qs = new URLSearchParams({ from, to });
  const res = await apiGet(request, `/api/admin/analytics/cars/${carId}?${qs.toString()}`, session);
  return { status: res.status(), body: await parseJson(res) };
}

export async function createCarViaUi(
  page: Page,
  fields: CreateCarFields,
  imagePath: string = CAR_IMAGE_FIXTURE
): Promise<void> {
  ensureCarImageFixture();
  await page.goto('/admin/cars');
  await page.getByRole('button', { name: 'Add car' }).click();
  await page.getByLabel('Name').fill(fields.name);
  await page.locator('input[type="file"]').setInputFiles(imagePath);
  await page.getByLabel('Seats').fill(fields.seats ?? '5');
  await page.getByLabel(/Price tier 1/).fill(fields.priceTier_1_3 ?? '55');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByText('Car saved').waitFor({ timeout: 20_000 });
}

export function findCarByName(cars: any[], name: string): any | undefined {
  return cars.find((c) => c?.name === name);
}

export function alertsForCar(alerts: any[], carId: number | string): any[] {
  const id = String(carId);
  return (alerts || []).filter((a) => String(a.carId) === id);
}
