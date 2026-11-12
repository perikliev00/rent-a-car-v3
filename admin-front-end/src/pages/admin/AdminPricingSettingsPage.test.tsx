// Import named exports from '@testing-library/react'.
import { screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../api/admin/pricing'.
import { getAdminPricing } from '../../api/admin/pricing';
// Import named exports from '../../api/admin/cars'.
import { getAdminCars } from '../../api/admin/cars';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './AdminPricingSettingsPage'.
import { AdminPricingSettingsPage } from './AdminPricingSettingsPage';

// Call vi.mock to perform this step.
vi.mock('../../api/admin/pricing', () => ({
  // Provide the get admin pricing field value.
  getAdminPricing: vi.fn(),
  // Provide the update delivery fees field value.
  updateDeliveryFees: vi.fn(),
  // Provide the update global fee field value.
  updateGlobalFee: vi.fn(),
  // Provide the create season field value.
  createSeason: vi.fn(),
  // Provide the update season field value.
  updateSeason: vi.fn(),
  // Provide the delete season field value.
  deleteSeason: vi.fn(),
  // Provide the update weekend field value.
  updateWeekend: vi.fn(),
  // Provide the update discount field value.
  updateDiscount: vi.fn(),
  // Provide the update deposit field value.
  updateDeposit: vi.fn(),
  // Provide the update extra field value.
  updateExtra: vi.fn(),
  // Provide the preview pricing field value.
  previewPricing: vi.fn(),
}));

// Call vi.mock to perform this step.
vi.mock('../../api/admin/cars', () => ({
  // Provide the get admin cars field value.
  getAdminCars: vi.fn(),
}));

// Declare a test suite grouping related cases.
describe('AdminPricingSettingsPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.mocked to perform this step.
    vi.mocked(getAdminPricing).mockResolvedValue({
      // Provide the pricing field value.
      pricing: {
        // Provide the seasons field value.
        seasons: [],
        // Provide the weekend rules field value.
        weekendRules: [],
        // Provide the discount rules field value.
        discountRules: [],
        // Provide the deposit rules field value.
        depositRules: [{ id: 1, name: 'Standard', defaultAmount: 200, active: true }],
        // Provide the delivery fees field value.
        deliveryFees: [{ locationId: 'office', fee: 0 }],
        // Provide the delivery fee map field value.
        deliveryFeeMap: { office: 0 },
        // Provide the global fees field value.
        globalFees: [],
        // Provide the extras field value.
        extras: [],
      },
    });
    // Call vi.mocked to perform this step.
    vi.mocked(getAdminCars).mockResolvedValue({ cars: [] });
  });

  // Define a single test case and its expectations.
  it('renders pricing page with delivery fees section', async () => {
    renderWithRouter(<AdminPricingSettingsPage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Pricing' })).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('heading', { name: 'Delivery fees' })).toBeInTheDocument();
  });
});
