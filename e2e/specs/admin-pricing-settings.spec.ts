import { test, expect } from '../fixtures/base';
import { loginAsAdmin, apiPost } from '../helpers/csrf';
import { seedE2eFixtures } from '../helpers/seed';
import {
  cleanupE2eCarsByName,
  cleanupReservationsForCar,
  cleanupTestCar,
} from '../helpers/db';
import { allocateFutureRange, API_URL } from '../helpers/test-env';
import {
  openOrderAndResolveConflict,
  readOrderSummaryTotal,
} from '../helpers/booking';
import {
  snapshotPricingConfig,
  restorePricingConfig,
  type PricingConfigSnapshot,
} from '../helpers/pricing-config';

const CAR_NAME = `E2E Pricing Settings ${Date.now()}`;
const FEE_DELTA = 77;

test.describe.configure({ mode: 'serial' });

test.describe('ADMIN-018 Pricing settings CRUD/preview/public propagation', () => {
  test.setTimeout(120_000);

  let carId: number;
  let pricingSnapshot: PricingConfigSnapshot | null = null;
  const range = allocateFutureRange({ fromDaysAhead: 140, nights: 3 });

  test.beforeAll(async () => {
    await cleanupE2eCarsByName(CAR_NAME);
    carId = await seedE2eFixtures(CAR_NAME);
  });

  test.afterAll(async () => {
    if (pricingSnapshot) {
      await restorePricingConfig(pricingSnapshot);
      pricingSnapshot = null;
    }
    await cleanupReservationsForCar(carId);
    await cleanupTestCar(carId);
  });

  test.beforeEach(async () => {
    await cleanupReservationsForCar(carId);
  });

  test('mutate hotel delivery fee; preview + pricing-info + guest quote; restore', async ({
    adminPage,
    request,
    page,
  }) => {
    pricingSnapshot = await snapshotPricingConfig();
    const hotelBefore = Number(
      pricingSnapshot.globalFees.find((f) => f.fee_key === 'hotel_delivery')?.amount ?? 0
    );
    const hotelAfter = hotelBefore + FEE_DELTA;

    try {
      await adminPage.goto('/admin/pricing');
      await expect(adminPage.getByRole('heading', { name: 'Pricing', exact: true })).toBeVisible({
        timeout: 15_000,
      });

      const hotelRow = adminPage
        .locator('div.flex.flex-wrap.items-end')
        .filter({ hasText: 'hotel_delivery' });
      await expect(hotelRow.getByText('hotel_delivery', { exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await hotelRow.locator('input[type="number"]').fill(String(hotelAfter));
      await hotelRow.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(adminPage.getByText('Fee saved')).toBeVisible({ timeout: 15_000 });

      const session = await loginAsAdmin(request);
      const previewRes = await apiPost(
        request,
        '/api/admin/pricing/preview',
        {
          carId,
          pickupDate: range.pickupDate,
          returnDate: range.returnDate,
          pickupTime: range.pickupTime,
          returnTime: range.returnTime,
          pickupLocation: 'office',
          returnLocation: 'office',
          hotelDelivery: true,
          extras: [],
        },
        session
      );
      expect(previewRes.ok(), await previewRes.text()).toBeTruthy();
      const previewBody = await previewRes.json();
      const previewPricing = previewBody.data?.pricing ?? previewBody.pricing;
      expect(Number(previewPricing.totalPrice)).toBeGreaterThan(0);
      const hotelLine = (previewPricing.lines || []).find((l: { label?: string }) =>
        /hotel/i.test(String(l.label || ''))
      );
      expect(hotelLine).toBeTruthy();
      expect(Number(hotelLine.amount)).toBeCloseTo(hotelAfter, 2);

      const infoRes = await request.get(`${API_URL}/api/pricing-info`);
      expect(infoRes.ok(), await infoRes.text()).toBeTruthy();
      const infoBody = await infoRes.json();
      const info = infoBody.data ?? infoBody;
      const fees = info.globalFees || [];
      const hotelFee = fees.find(
        (f: { feeKey?: string; fee_key?: string }) =>
          f.feeKey === 'hotel_delivery' || f.fee_key === 'hotel_delivery'
      );
      expect(hotelFee).toBeTruthy();
      expect(Number(hotelFee.amount)).toBeCloseTo(hotelAfter, 2);

      await cleanupReservationsForCar(carId);
      await openOrderAndResolveConflict(page, carId, range, { hotelDelivery: true });
      const guestTotal = await readOrderSummaryTotal(page);
      expect(guestTotal).toBeCloseTo(Number(previewPricing.totalPrice), 2);
    } finally {
      if (pricingSnapshot) {
        await restorePricingConfig(pricingSnapshot);
        pricingSnapshot = null;
      }
    }
  });
});
