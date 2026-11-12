/**
 * Tab/key types shared across car detail hooks and panels.
 */
import type { CarFleetStatus, FuelLevel } from '../../../types/api';

// Export the tab type.
export type Tab = 'overview' | 'compliance' | 'service' | 'damage' | 'documents' | 'performance';

// Export the overview form type.
export type OverviewForm = {
  // Provide the registration number field value.
  registrationNumber: string;
  // Provide the vin field value.
  vin: string;
  // Provide the mileage field value.
  mileage: string;
  // Provide the fuel level field value.
  fuelLevel: FuelLevel | '';
  // Provide the current location field value.
  currentLocation: string;
  // Provide the insurance expiry field value.
  insuranceExpiry: string;
  // Provide the technical inspection expiry field value.
  technicalInspectionExpiry: string;
};

// Export the service form type.
export type ServiceForm = {
  // Provide the service type field value.
  serviceType: string;
  // Provide the description field value.
  description: string;
  // Provide the cost field value.
  cost: string;
  // Provide the mileage field value.
  mileage: string;
  // Provide the service date field value.
  serviceDate: string;
  // Provide the next service date field value.
  nextServiceDate: string;
};

// Export the damage form type.
export type DamageForm = {
  // Provide the description field value.
  description: string;
  // Provide the reservation id field value.
  reservationId: string;
  // Provide the repair cost field value.
  repairCost: string;
};

// Export the compliance form type.
export type ComplianceForm = {
  // Provide the item type field value.
  itemType: string;
  // Provide the title field value.
  title: string;
  // Provide the reference number field value.
  referenceNumber: string;
  // Provide the issued at field value.
  issuedAt: string;
  // Provide the expires at field value.
  expiresAt: string;
  // Provide the notes field value.
  notes: string;
  // Provide the status field value.
  status: '' | 'missing';
};

/**
 * Chip classes for compliance item status (expired / missing / ok).
 * @param status - Compliance status string from the API
 */
export function complianceStatusClass(status?: string) {
  // Evaluate the condition and enter the branch when it is true.
  if (status === 'expired') return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]';
  // Evaluate the condition and enter the branch when it is true.
  if (status === 'missing') return 'bg-[var(--color-accent-muted)] text-[var(--color-ink)]';
  // Return the resulting value to the caller.
  return 'bg-[var(--color-success)]/10 text-[var(--color-success)]';
}

/**
 * Chip classes for fleet status on the car detail header.
 * @param status - Fleet status (defaults visually to available)
 */
export function statusChipClass(status?: string) {
  // Create the s constant.
  const s = (status || 'available').toLowerCase();
  // Evaluate the condition and enter the branch when it is true.
  if (s === 'available') return 'bg-[var(--color-success)]/10 text-[var(--color-success)]';
  // Evaluate the condition and enter the branch when it is true.
  if (s === 'reserved' || s === 'rented') return 'bg-[var(--color-accent-muted)] text-[var(--color-ink)]';
  // Evaluate the condition and enter the branch when it is true.
  if (s.includes('needs') || s === 'in_maintenance' || s === 'damaged' || s === 'inactive') {
    // Return the resulting value to the caller.
    return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]';
  }
  // Return the resulting value to the caller.
  return 'bg-[var(--color-surface)] text-[var(--color-muted)]';
}

/**
 * Default performance analytics window: last 30 days inclusive of today.
 */
export function defaultPerfRange() {
  // Create the to constant.
  const to = new Date();
  // Create the from constant.
  const from = new Date();
  // Call from.setDate to perform this step.
  from.setDate(to.getDate() - 29);
  // Create the fmt constant.
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  // Return the resulting value to the caller.
  return { from: fmt(from), to: fmt(to) };
}

// Contribute this line to the enclosing declaration or statement.
export type { CarFleetStatus, FuelLevel };
