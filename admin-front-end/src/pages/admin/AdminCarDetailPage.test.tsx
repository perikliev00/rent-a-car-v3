// Import named exports from '@testing-library/react'.
import { fireEvent, screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  getAdminCar,
  // Contribute this line to the enclosing declaration or statement.
  getCarCompliance,
// Contribute this line to the enclosing declaration or statement.
} from '../../api/admin/cars';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './AdminCarDetailPage'.
import { AdminCarDetailPage } from './AdminCarDetailPage';

// Call vi.mock to perform this step.
vi.mock('../../auth/useAuth', () => ({
  // Provide the use auth field value.
  useAuth: () => ({
    // Provide the user field value.
    user: {
      // Provide the id field value.
      id: '1',
      // Provide the role field value.
      role: 'admin',
      // Provide the roles field value.
      roles: ['owner'],
      // Provide the permissions field value.
      permissions: ['can_view_revenue', 'can_manage_cars'],
    },
  }),
}));

// Call vi.mock to perform this step.
vi.mock('../../api/admin/analytics', () => ({
  // Provide the get car performance field value.
  getCarPerformance: vi.fn().mockResolvedValue({
    // Provide the period days field value.
    periodDays: 30,
    // Provide the car field value.
    car: {
      // Provide the car id field value.
      carId: '7',
      // Provide the car name field value.
      carName: 'Toyota Yaris',
      // Provide the registration number field value.
      registrationNumber: null,
      // Provide the revenue field value.
      revenue: 100,
      // Provide the utilization rate field value.
      utilizationRate: 0.2,
      // Provide the booked days field value.
      bookedDays: 5,
      // Provide the available days field value.
      availableDays: 25,
      // Provide the period days field value.
      periodDays: 30,
      // Provide the bookings count field value.
      bookingsCount: 2,
      // Provide the maintenance days field value.
      maintenanceDays: 0,
      // Provide the repair cost field value.
      repairCost: 0,
      // Provide the service cost field value.
      serviceCost: 0,
      // Provide the profitability field value.
      profitability: 100,
    },
  }),
}));

// Call vi.mock to perform this step.
vi.mock('../../api/admin/cars', () => ({
  // Provide the car fleet statuses field value.
  CAR_FLEET_STATUSES: [
    // Supply the literal value used by the enclosing expression.
    'available',
    // Supply the literal value used by the enclosing expression.
    'reserved',
    // Supply the literal value used by the enclosing expression.
    'rented',
    // Supply the literal value used by the enclosing expression.
    'needs_cleaning',
    // Supply the literal value used by the enclosing expression.
    'needs_inspection',
    // Supply the literal value used by the enclosing expression.
    'in_maintenance',
    // Supply the literal value used by the enclosing expression.
    'damaged',
    // Supply the literal value used by the enclosing expression.
    'inactive',
  ],
  // Provide the compliance type options field value.
  COMPLIANCE_TYPE_OPTIONS: [{ value: 'civil_insurance', label: 'Гражданска отговорност' }],
  // Provide the compliance type has expiry field value.
  complianceTypeHasExpiry: (t: string) =>
    // Continue the surrounding logic with this statement.
    !['fire_extinguisher', 'first_aid_kit', 'warning_triangle'].includes(t),
  // Provide the fuel level options field value.
  FUEL_LEVEL_OPTIONS: [{ value: '', label: '—' }],
  // Provide the service type options field value.
  SERVICE_TYPE_OPTIONS: [{ value: 'oil_change', label: 'Oil change' }],
  // Provide the get admin car field value.
  getAdminCar: vi.fn(),
  // Provide the get car compliance field value.
  getCarCompliance: vi.fn(),
  // Provide the get car service records field value.
  getCarServiceRecords: vi.fn(),
  // Provide the get car damage reports field value.
  getCarDamageReports: vi.fn(),
  // Provide the get car documents field value.
  getCarDocuments: vi.fn(),
  // Provide the change car fleet status field value.
  changeCarFleetStatus: vi.fn(),
  // Provide the create car compliance field value.
  createCarCompliance: vi.fn(),
  // Provide the create car damage report field value.
  createCarDamageReport: vi.fn(),
  // Provide the create car service record field value.
  createCarServiceRecord: vi.fn(),
  // Provide the delete car compliance field value.
  deleteCarCompliance: vi.fn(),
  // Provide the delete car damage report field value.
  deleteCarDamageReport: vi.fn(),
  // Provide the delete car document field value.
  deleteCarDocument: vi.fn(),
  // Provide the delete car service record field value.
  deleteCarServiceRecord: vi.fn(),
  // Provide the download car compliance document field value.
  downloadCarComplianceDocument: vi.fn(),
  // Provide the download car document field value.
  downloadCarDocument: vi.fn(),
  // Provide the resolve car damage report field value.
  resolveCarDamageReport: vi.fn(),
  // Provide the update admin car field value.
  updateAdminCar: vi.fn(),
  // Provide the upload car document field value.
  uploadCarDocument: vi.fn(),
}));

// Declare a test suite grouping related cases.
describe('AdminCarDetailPage Compliance tab', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.clearAllMocks to perform this step.
    vi.clearAllMocks();
    // Call vi.mocked to perform this step.
    vi.mocked(getAdminCar).mockResolvedValue({
      // Provide the car field value.
      car: {
        // Provide the id field value.
        id: '7',
        // Provide the name field value.
        name: 'Toyota Yaris',
        // Provide the image field value.
        image: '/car.jpg',
        // Provide the transmission field value.
        transmission: 'Automatic',
        // Provide the fuel type field value.
        fuelType: 'Petrol',
        // Provide the seats field value.
        seats: 5,
        // Provide the availability field value.
        availability: true,
        // Provide the status field value.
        status: 'available',
        // Provide the price tier 1 3 field value.
        priceTier_1_3: 45,
        // Provide the registration number field value.
        registrationNumber: null,
        // Provide the vin field value.
        vin: null,
        // Provide the mileage field value.
        mileage: null,
        // Provide the fuel level field value.
        fuelLevel: null,
        // Provide the location field value.
        location: null,
        // Provide the insurance expiry field value.
        insuranceExpiry: '2026-12-01',
        // Provide the technical inspection expiry field value.
        technicalInspectionExpiry: '2026-11-01',
      },
    });
    // Call vi.mocked to perform this step.
    vi.mocked(getCarCompliance).mockResolvedValue({ items: [] });
  });

  // Define a single test case and its expectations.
  it('shows Compliance tab with empty state', async () => {
    renderWithRouter(<AdminCarDetailPage />, {
      // Provide the route field value.
      route: '/admin/cars/7',
      // Provide the path field value.
      path: '/admin/cars/:id',
    });

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Toyota Yaris' })).toBeInTheDocument();
    });

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByRole('button', { name: 'Compliance' }));

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Add compliance item' })).toBeInTheDocument();
    });
    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByText('No compliance items')).toBeInTheDocument();
    });
    // Assert that the value matches the intended expectation.
    expect(getCarCompliance).toHaveBeenCalledWith('7');
  });
});
