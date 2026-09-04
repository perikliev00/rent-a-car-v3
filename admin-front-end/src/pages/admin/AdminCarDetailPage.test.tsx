import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAdminCar,
  getCarCompliance,
} from '../../api/admin/cars';
import { renderWithRouter } from '../../test/test-utils';
import { AdminCarDetailPage } from './AdminCarDetailPage';

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: '1',
      role: 'admin',
      roles: ['owner'],
      permissions: ['can_view_revenue', 'can_manage_cars'],
    },
  }),
}));

vi.mock('../../api/admin/analytics', () => ({
  getCarPerformance: vi.fn().mockResolvedValue({
    periodDays: 30,
    car: {
      carId: '7',
      carName: 'Toyota Yaris',
      registrationNumber: null,
      revenue: 100,
      utilizationRate: 0.2,
      bookedDays: 5,
      availableDays: 25,
      periodDays: 30,
      bookingsCount: 2,
      maintenanceDays: 0,
      repairCost: 0,
      serviceCost: 0,
      profitability: 100,
    },
  }),
}));

vi.mock('../../api/admin/cars', () => ({
  CAR_FLEET_STATUSES: [
    'available',
    'reserved',
    'rented',
    'needs_cleaning',
    'needs_inspection',
    'in_maintenance',
    'damaged',
    'inactive',
  ],
  COMPLIANCE_TYPE_OPTIONS: [{ value: 'civil_insurance', label: 'Гражданска отговорност' }],
  complianceTypeHasExpiry: (t: string) =>
    !['fire_extinguisher', 'first_aid_kit', 'warning_triangle'].includes(t),
  FUEL_LEVEL_OPTIONS: [{ value: '', label: '—' }],
  SERVICE_TYPE_OPTIONS: [{ value: 'oil_change', label: 'Oil change' }],
  getAdminCar: vi.fn(),
  getCarCompliance: vi.fn(),
  getCarServiceRecords: vi.fn(),
  getCarDamageReports: vi.fn(),
  getCarDocuments: vi.fn(),
  changeCarFleetStatus: vi.fn(),
  createCarCompliance: vi.fn(),
  createCarDamageReport: vi.fn(),
  createCarServiceRecord: vi.fn(),
  deleteCarCompliance: vi.fn(),
  deleteCarDamageReport: vi.fn(),
  deleteCarDocument: vi.fn(),
  deleteCarServiceRecord: vi.fn(),
  resolveCarDamageReport: vi.fn(),
  updateAdminCar: vi.fn(),
  uploadCarDocument: vi.fn(),
}));

describe('AdminCarDetailPage Compliance tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminCar).mockResolvedValue({
      car: {
        id: '7',
        name: 'Toyota Yaris',
        image: '/car.jpg',
        transmission: 'Automatic',
        fuelType: 'Petrol',
        seats: 5,
        availability: true,
        status: 'available',
        priceTier_1_3: 45,
        registrationNumber: null,
        vin: null,
        mileage: null,
        fuelLevel: null,
        location: null,
        insuranceExpiry: '2026-12-01',
        technicalInspectionExpiry: '2026-11-01',
      },
    });
    vi.mocked(getCarCompliance).mockResolvedValue({ items: [] });
  });

  it('shows Compliance tab with empty state', async () => {
    renderWithRouter(<AdminCarDetailPage />, {
      route: '/admin/cars/7',
      path: '/admin/cars/:id',
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Toyota Yaris' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Compliance' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Add compliance item' })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('No compliance items')).toBeInTheDocument();
    });
    expect(getCarCompliance).toHaveBeenCalledWith('7');
  });
});
