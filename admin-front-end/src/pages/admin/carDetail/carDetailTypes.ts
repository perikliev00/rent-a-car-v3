/**
 * Tab/key types shared across car detail hooks and panels.
 */
import type { CarFleetStatus, FuelLevel } from '../../../types/api';

export type Tab = 'overview' | 'compliance' | 'service' | 'damage' | 'documents' | 'performance';

export type OverviewForm = {
  registrationNumber: string;
  vin: string;
  mileage: string;
  fuelLevel: FuelLevel | '';
  currentLocation: string;
  insuranceExpiry: string;
  technicalInspectionExpiry: string;
};

export type ServiceForm = {
  serviceType: string;
  description: string;
  cost: string;
  mileage: string;
  serviceDate: string;
  nextServiceDate: string;
};

export type DamageForm = {
  description: string;
  reservationId: string;
  repairCost: string;
};

export type ComplianceForm = {
  itemType: string;
  title: string;
  referenceNumber: string;
  issuedAt: string;
  expiresAt: string;
  notes: string;
  status: '' | 'missing';
};

/**
 * Chip classes for compliance item status (expired / missing / ok).
 * @param status - Compliance status string from the API
 */
export function complianceStatusClass(status?: string) {
  if (status === 'expired') return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]';
  if (status === 'missing') return 'bg-[var(--color-accent-muted)] text-[var(--color-ink)]';
  return 'bg-[var(--color-success)]/10 text-[var(--color-success)]';
}

/**
 * Chip classes for fleet status on the car detail header.
 * @param status - Fleet status (defaults visually to available)
 */
export function statusChipClass(status?: string) {
  const s = (status || 'available').toLowerCase();
  if (s === 'available') return 'bg-[var(--color-success)]/10 text-[var(--color-success)]';
  if (s === 'reserved' || s === 'rented') return 'bg-[var(--color-accent-muted)] text-[var(--color-ink)]';
  if (s.includes('needs') || s === 'in_maintenance' || s === 'damaged' || s === 'inactive') {
    return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]';
  }
  return 'bg-[var(--color-surface)] text-[var(--color-muted)]';
}

/**
 * Default performance analytics window: last 30 days inclusive of today.
 */
export function defaultPerfRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 29);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

export type { CarFleetStatus, FuelLevel };
