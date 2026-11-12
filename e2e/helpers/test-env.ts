// Export the customer base url const.
export const CUSTOMER_BASE_URL =
  // Contribute this line to the enclosing declaration or statement.
  process.env.CUSTOMER_BASE_URL || process.env.BASE_URL || 'http://localhost:5173';
// Export the admin base url const.
export const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL || 'http://localhost:5174';
// Export the base url const.
export const BASE_URL = CUSTOMER_BASE_URL;

// Export the adminUrl function.
export function adminUrl(path = '/'): string {
  // Create the base constant.
  const base = ADMIN_BASE_URL.replace(/\/+$/, '');
  // Create the suffix constant.
  const suffix = path.startsWith('/') ? path : `/${path}`;
  // Return the resulting value to the caller.
  return `${base}${suffix}`;
}
// Export the api url const.
export const API_URL = process.env.API_URL || 'http://localhost:3000';
// Export the database url const.
export const DATABASE_URL =
  // Contribute this line to the enclosing declaration or statement.
  process.env.DATABASE_URL || 'postgres://luxride:luxride@localhost:5432/luxride_test';

// Export the admin email const.
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@luxride.local';
// Export the admin password const.
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin123!';

// Export the e2 e pickup date const.
export const E2E_PICKUP_DATE = '2035-06-10';
// Export the e2 e return date const.
export const E2E_RETURN_DATE = '2035-06-14';
// Export the e2 e pickup time const.
export const E2E_PICKUP_TIME = '10:00';
// Export the e2 e return time const.
export const E2E_RETURN_TIME = '10:00';

// Export the e2 e guest const.
export const E2E_GUEST = {
  // Provide the full name field value.
  fullName: 'E2E Guest',
  // Provide the phone number field value.
  phoneNumber: '+359888123456',
  // Provide the email field value.
  email: 'e2e-guest@example.com',
  // Provide the address field value.
  address: 'E2E Test Street 1',
  // Provide the hotel name field value.
  hotelName: 'E2E Hotel',
};

// Export the uniqueEmail function.
export function uniqueEmail(prefix = 'e2e'): string {
  // Create the rand constant.
  const rand = Math.random().toString(36).slice(2, 8);
  // Return the resulting value to the caller.
  return `${prefix}-${Date.now()}-${rand}@example.com`;
}

// Export the stripe webhook secret const.
export const STRIPE_WEBHOOK_SECRET =
  // Contribute this line to the enclosing declaration or statement.
  process.env.STRIPE_WEBHOOK_SECRET || 'whsec_jest_placeholder_secret';
// Export the stripe secret const.
export const STRIPE_SECRET =
  // Contribute this line to the enclosing declaration or statement.
  process.env.STRIPE_SECRET || 'sk_test_jest_placeholder_key_1234567890';

// Re-export the listed bindings.
export { allocateFutureRange, allocateFutureRangeOnWeekday } from './dates';
