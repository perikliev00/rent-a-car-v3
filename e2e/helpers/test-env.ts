export const CUSTOMER_BASE_URL =
  process.env.CUSTOMER_BASE_URL || process.env.BASE_URL || 'http://localhost:5173';
export const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL || 'http://localhost:5174';
export const BASE_URL = CUSTOMER_BASE_URL;

export function adminUrl(path = '/'): string {
  const base = ADMIN_BASE_URL.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}
export const API_URL = process.env.API_URL || 'http://localhost:3000';
export const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://luxride:luxride@localhost:5432/luxride_test';

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@luxride.local';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin123!';

export const E2E_PICKUP_DATE = '2035-06-10';
export const E2E_RETURN_DATE = '2035-06-14';
export const E2E_PICKUP_TIME = '10:00';
export const E2E_RETURN_TIME = '10:00';

export const E2E_GUEST = {
  fullName: 'E2E Guest',
  phoneNumber: '+359888123456',
  email: 'e2e-guest@example.com',
  address: 'E2E Test Street 1',
  hotelName: 'E2E Hotel',
};

export function uniqueEmail(prefix = 'e2e'): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}@example.com`;
}

export const STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || 'whsec_jest_placeholder_secret';
export const STRIPE_SECRET =
  process.env.STRIPE_SECRET || 'sk_test_jest_placeholder_key_1234567890';

export { allocateFutureRange, allocateFutureRangeOnWeekday } from './dates';
