import { insertIsolatedTestCar, insertTestAdmin, insertLinkedBooking, type SeedLinkedBookingOptions, type SeedLinkedBookingResult } from './db';

export async function seedE2eFixtures(carName = 'E2E Test Car'): Promise<number> {
  await insertTestAdmin();
  return insertIsolatedTestCar(carName);
}

export async function seedLinkedBooking(
  options: SeedLinkedBookingOptions
): Promise<SeedLinkedBookingResult> {
  return insertLinkedBooking(options);
}

export type { SeedLinkedBookingOptions, SeedLinkedBookingResult };
