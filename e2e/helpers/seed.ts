// Import named exports from './db'.
import { insertIsolatedTestCar, insertTestAdmin, insertLinkedBooking, type SeedLinkedBookingOptions, type SeedLinkedBookingResult } from './db';

// Export the async seedE2eFixtures function.
export async function seedE2eFixtures(carName = 'E2E Test Car'): Promise<number> {
  // Wait until the asynchronous operation resolves.
  await insertTestAdmin();
  // Return the resulting value to the caller.
  return insertIsolatedTestCar(carName);
}

// Export the async seedLinkedBooking function.
export async function seedLinkedBooking(
  // Provide the options field value.
  options: SeedLinkedBookingOptions
// Continue the surrounding logic with this statement.
): Promise<SeedLinkedBookingResult> {
  // Return the resulting value to the caller.
  return insertLinkedBooking(options);
}

// Contribute this line to the enclosing declaration or statement.
export type { SeedLinkedBookingOptions, SeedLinkedBookingResult };
