/** Europe/Sofia calendar helpers (DST-safe). Ported from backend/src/utils/date/timezone.js */

export const SOFIA_TZ = 'Europe/Sofia';

export type SofiaCalendarParts = {
  year: number;
  month: number;
  day: number;
};

function getOffsetMinutes(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = dtf.formatToParts(date);
  const data: Record<string, string> = {};
  for (const { type, value } of parts) {
    data[type] = value;
  }

  const year = Number(data.year);
  const month = Number(data.month);
  const day = Number(data.day);
  const hour = Number(data.hour);
  const minute = Number(data.minute);
  const second = Number(data.second);

  if ([year, month, day, hour, minute, second].some(Number.isNaN)) {
    return 0;
  }

  const asUTC = Date.UTC(year, month - 1, day, hour, minute, second);
  return (asUTC - date.getTime()) / 60000;
}

export function getSofiaCalendarParts(date: Date = new Date()): SofiaCalendarParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: SOFIA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = dtf.formatToParts(date);
  const data: Record<string, string> = {};
  for (const { type, value } of parts) {
    data[type] = value;
  }

  return {
    year: Number(data.year),
    month: Number(data.month),
    day: Number(data.day),
  };
}

export function formatSofiaIsoDateFromParts({ year, month, day }: SofiaCalendarParts): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getSofiaIsoDateString(date: Date = new Date()): string {
  return formatSofiaIsoDateFromParts(getSofiaCalendarParts(date));
}

export function addSofiaCalendarDays(date: Date = new Date(), days = 1): SofiaCalendarParts {
  const { year, month, day } = getSofiaCalendarParts(date);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

/**
 * Interpret YYYY-MM-DD + HH:mm as a wall-clock time in Europe/Sofia,
 * returning the corresponding UTC Date (DST-aware via offset at that instant).
 */
export function parseSofiaDate(dateString: string, timeString = '00:00'): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString).trim());
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(String(timeString).trim());
  if (!dateMatch || !timeMatch) {
    return null;
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  const baseline = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  if (
    baseline.getUTCFullYear() !== year ||
    baseline.getUTCMonth() !== month - 1 ||
    baseline.getUTCDate() !== day ||
    baseline.getUTCHours() !== hour ||
    baseline.getUTCMinutes() !== minute
  ) {
    return null;
  }

  const offset = getOffsetMinutes(SOFIA_TZ, baseline);
  return new Date(baseline.getTime() - offset * 60000);
}

export type AllocateFutureRangeOptions = {
  fromDaysAhead?: number;
  nights?: number;
  pickupTime?: string;
  returnTime?: string;
};

export type AllocatedFutureRange = {
  pickupDate: string;
  returnDate: string;
  pickupTime: string;
  returnTime: string;
};

/**
 * Allocate a future pickup/return range on the Sofia calendar (DST-safe).
 * Defaults: 14 days ahead, 4 nights, 10:00 times.
 */
export function allocateFutureRange(
  options: AllocateFutureRangeOptions = {}
): AllocatedFutureRange {
  const fromDaysAhead = options.fromDaysAhead ?? 14;
  const nights = options.nights ?? 4;
  const pickupTime = options.pickupTime ?? '10:00';
  const returnTime = options.returnTime ?? '10:00';

  const pickupDate = formatSofiaIsoDateFromParts(addSofiaCalendarDays(new Date(), fromDaysAhead));
  const returnDate = formatSofiaIsoDateFromParts(
    addSofiaCalendarDays(parseSofiaDate(pickupDate, '00:00') ?? new Date(), nights)
  );

  return { pickupDate, returnDate, pickupTime, returnTime };
}

/** 0 = Sunday … 6 = Saturday for a YYYY-MM-DD Sofia calendar date. */
export function sofiaIsoWeekday(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * Future range whose pickup falls on `weekday` (0=Sun … 3=Wed … 6=Sat).
 * Keeps week-view drags away from the Monday/Sunday edges.
 */
export function allocateFutureRangeOnWeekday(
  weekday: number,
  options: AllocateFutureRangeOptions = {}
): AllocatedFutureRange {
  const fromDaysAhead = options.fromDaysAhead ?? 14;
  for (let offset = 0; offset < 7; offset += 1) {
    const range = allocateFutureRange({ ...options, fromDaysAhead: fromDaysAhead + offset });
    if (sofiaIsoWeekday(range.pickupDate) === weekday) {
      return range;
    }
  }
  return allocateFutureRange({ ...options, fromDaysAhead });
}
