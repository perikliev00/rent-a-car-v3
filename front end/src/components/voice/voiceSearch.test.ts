import { describe, expect, it, vi } from 'vitest';
import { validateVoiceSearch, runVoiceCarSearch } from './voiceSearch';
import { searchCars } from '../../api/cars';

vi.mock('../../api/cars', () => ({ searchCars: vi.fn() }));

const valid = {
  pickupDate: '2026-12-20',
  returnDate: '2026-12-23',
  pickupTime: '10:00',
  returnTime: '10:00',
  pickupLocation: 'office',
  returnLocation: 'ravda',
};

describe('voice search tool', () => {
  it('rejects missing details and malformed dates', () => {
    expect(() => validateVoiceSearch({ ...valid, pickupDate: '2026-02-30' })).toThrow();
    expect(() => validateVoiceSearch({ ...valid, returnLocation: 'arbitrary' })).toThrow();
    expect(() => validateVoiceSearch({ ...valid, returnTime: '99:00' })).toThrow();
  });

  it('rejects a return earlier than pickup', () => {
    expect(() => validateVoiceSearch({ ...valid, returnDate: '2026-12-19' })).toThrow();
  });

  it('uses the existing search API and exposes no private car data', async () => {
    vi.mocked(searchCars).mockResolvedValue({
      cars: [{
        id: '3', name: 'BMW', transmission: 'Automatic', seats: 5, rentalDays: 3,
        totalPrice: 300, registrationNumber: 'PRIVATE-123',
      } as never],
      pagination: { currentPage: 1, totalPages: 1 },
    } as never);
    const result = await runVoiceCarSearch(valid);
    expect(searchCars).toHaveBeenCalledOnce();
    expect(result.link).toContain('/search?pickup-date=2026-12-20');
    expect(JSON.parse(result.output).cars[0].totalPrice).toBe(300);
    expect(result.output).not.toContain('PRIVATE-123');
  });
});
