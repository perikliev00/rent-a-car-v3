import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdminPricing } from '../../api/admin/pricing';
import { getAdminCars } from '../../api/admin/cars';
import { renderWithRouter } from '../../test/test-utils';
import { AdminPricingSettingsPage } from './AdminPricingSettingsPage';

vi.mock('../../api/admin/pricing', () => ({
  getAdminPricing: vi.fn(),
  updateDeliveryFees: vi.fn(),
  updateGlobalFee: vi.fn(),
  createSeason: vi.fn(),
  updateSeason: vi.fn(),
  deleteSeason: vi.fn(),
  updateWeekend: vi.fn(),
  updateDiscount: vi.fn(),
  updateDeposit: vi.fn(),
  updateExtra: vi.fn(),
  previewPricing: vi.fn(),
}));

vi.mock('../../api/admin/cars', () => ({
  getAdminCars: vi.fn(),
}));

describe('AdminPricingSettingsPage', () => {
  beforeEach(() => {
    vi.mocked(getAdminPricing).mockResolvedValue({
      pricing: {
        seasons: [],
        weekendRules: [],
        discountRules: [],
        depositRules: [{ id: 1, name: 'Standard', defaultAmount: 200, active: true }],
        deliveryFees: [{ locationId: 'office', fee: 0 }],
        deliveryFeeMap: { office: 0 },
        globalFees: [],
        extras: [],
      },
    });
    vi.mocked(getAdminCars).mockResolvedValue({ cars: [] });
  });

  it('renders pricing page with delivery fees section', async () => {
    renderWithRouter(<AdminPricingSettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Pricing' })).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'Delivery fees' })).toBeInTheDocument();
  });
});
