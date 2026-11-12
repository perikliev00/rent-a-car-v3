/** Europe/Sofia calendar helpers (DST-safe). Ported from backend/src/utils/date/timezone.js */

export const SOFIA_TZ = 'Europe/Sofia';

// Export the sofia calendar parts type.
export type SofiaCalendarParts = {
  // Provide the year field value.
  year: number;
  // Provide the month field value.
  month: number;
  // Provide the day field value.
  day: number;
};

// Define the getOffsetMinutes function.
function getOffsetMinutes(timeZone: string, date: Date): number {
  // Create the dtf constant.
  const dtf = new Intl.DateTimeFormat('en-US', {
    // Contribute this line to the enclosing declaration or statement.
    timeZone,
    // Provide the year field value.
    year: 'numeric',
    // Provide the month field value.
    month: '2-digit',
    // Provide the day field value.
    day: '2-digit',
    // Provide the hour field value.
    hour: '2-digit',
    // Provide the minute field value.
    minute: '2-digit',
    // Provide the second field value.
    second: '2-digit',
    // Provide the hour12 field value.
    hour12: false,
  });

  // Create the parts constant.
  const parts = dtf.formatToParts(date);
  // Continue the surrounding logic with this statement.
  const data: Record<string, string> = {};
  // Iterate using the loop initializer, condition, and step.
  for (const { type, value } of parts) {
    // Update data[type] with the right-hand side value.
    data[type] = value;
  }

  // Create the year constant.
  const year = Number(data.year);
  // Create the month constant.
  const month = Number(data.month);
  // Create the day constant.
  const day = Number(data.day);
  // Create the hour constant.
  const hour = Number(data.hour);
  // Create the minute constant.
  const minute = Number(data.minute);
  // Create the second constant.
  const second = Number(data.second);

  // Evaluate the condition and enter the branch when it is true.
  if ([year, month, day, hour, minute, second].some(Number.isNaN)) {
    // Return the resulting value to the caller.
    return 0;
  }

  // Create the as utc constant.
  const asUTC = Date.UTC(year, month - 1, day, hour, minute, second);
  // Return the resulting value to the caller.
  return (asUTC - date.getTime()) / 60000;
}

// Export the getSofiaCalendarParts function.
export function getSofiaCalendarParts(date: Date = new Date()): SofiaCalendarParts {
  // Create the dtf constant.
  const dtf = new Intl.DateTimeFormat('en-US', {
    // Provide the time zone field value.
    timeZone: SOFIA_TZ,
    // Provide the year field value.
    year: 'numeric',
    // Provide the month field value.
    month: '2-digit',
    // Provide the day field value.
    day: '2-digit',
  });

  // Create the parts constant.
  const parts = dtf.formatToParts(date);
  // Continue the surrounding logic with this statement.
  const data: Record<string, string> = {};
  // Iterate using the loop initializer, condition, and step.
  for (const { type, value } of parts) {
    // Update data[type] with the right-hand side value.
    data[type] = value;
  }

  // Return the resulting value to the caller.
  return {
    // Provide the year field value.
    year: Number(data.year),
    // Provide the month field value.
    month: Number(data.month),
    // Provide the day field value.
    day: Number(data.day),
  };
}

// Export the formatSofiaIsoDateFromParts function.
export function formatSofiaIsoDateFromParts({ year, month, day }: SofiaCalendarParts): string {
  // Return the resulting value to the caller.
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Export the getSofiaIsoDateString function.
export function getSofiaIsoDateString(date: Date = new Date()): string {
  // Return the resulting value to the caller.
  return formatSofiaIsoDateFromParts(getSofiaCalendarParts(date));
}

// Export the addSofiaCalendarDays function.
export function addSofiaCalendarDays(date: Date = new Date(), days = 1): SofiaCalendarParts {
  // Destructure object properties into local variables.
  const { year, month, day } = getSofiaCalendarParts(date);
  // Create the utc constant.
  const utc = new Date(Date.UTC(year, month - 1, day));
  // Call utc.setUTCDate to perform this step.
  utc.setUTCDate(utc.getUTCDate() + days);
  // Return the resulting value to the caller.
  return {
    // Provide the year field value.
    year: utc.getUTCFullYear(),
    // Provide the month field value.
    month: utc.getUTCMonth() + 1,
    // Provide the day field value.
    day: utc.getUTCDate(),
  };
}

/**
 * Interpret YYYY-MM-DD + HH:mm as a wall-clock time in Europe/Sofia,
 * returning the corresponding UTC Date (DST-aware via offset at that instant).
 */
export function parseSofiaDate(dateString: string, timeString = '00:00'): Date | null {
  // Create the date match constant.
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString).trim());
  // Create the time match constant.
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(String(timeString).trim());
  // Evaluate the condition and enter the branch when it is true.
  if (!dateMatch || !timeMatch) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the year constant.
  const year = Number(dateMatch[1]);
  // Create the month constant.
  const month = Number(dateMatch[2]);
  // Create the day constant.
  const day = Number(dateMatch[3]);
  // Create the hour constant.
  const hour = Number(timeMatch[1]);
  // Create the minute constant.
  const minute = Number(timeMatch[2]);

  // Create the baseline constant.
  const baseline = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  // Evaluate the condition and enter the branch when it is true.
  if (
    // Call baseline.getUTCFullYear to perform this step.
    baseline.getUTCFullYear() !== year ||
    // Call baseline.getUTCMonth to perform this step.
    baseline.getUTCMonth() !== month - 1 ||
    // Call baseline.getUTCDate to perform this step.
    baseline.getUTCDate() !== day ||
    // Call baseline.getUTCHours to perform this step.
    baseline.getUTCHours() !== hour ||
    // Call baseline.getUTCMinutes to perform this step.
    baseline.getUTCMinutes() !== minute
  // Continue the surrounding logic with this statement.
  ) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the offset constant.
  const offset = getOffsetMinutes(SOFIA_TZ, baseline);
  // Return the resulting value to the caller.
  return new Date(baseline.getTime() - offset * 60000);
}

// Export the allocate future range options type.
export type AllocateFutureRangeOptions = {
  // Contribute this line to the enclosing declaration or statement.
  fromDaysAhead?: number;
  // Contribute this line to the enclosing declaration or statement.
  nights?: number;
  // Contribute this line to the enclosing declaration or statement.
  pickupTime?: string;
  // Contribute this line to the enclosing declaration or statement.
  returnTime?: string;
};

// Export the allocated future range type.
export type AllocatedFutureRange = {
  // Provide the pickup date field value.
  pickupDate: string;
  // Provide the return date field value.
  returnDate: string;
  // Provide the pickup time field value.
  pickupTime: string;
  // Provide the return time field value.
  returnTime: string;
};

/**
 * Allocate a future pickup/return range on the Sofia calendar (DST-safe).
 * Defaults: 14 days ahead, 4 nights, 10:00 times.
 */
export function allocateFutureRange(
  // Provide the options field value.
  options: AllocateFutureRangeOptions = {}
// Continue the surrounding logic with this statement.
): AllocatedFutureRange {
  // Create the from days ahead constant.
  const fromDaysAhead = options.fromDaysAhead ?? 14;
  // Create the nights constant.
  const nights = options.nights ?? 4;
  // Create the pickup time constant.
  const pickupTime = options.pickupTime ?? '10:00';
  // Create the return time constant.
  const returnTime = options.returnTime ?? '10:00';

  // Create the pickup date constant.
  const pickupDate = formatSofiaIsoDateFromParts(addSofiaCalendarDays(new Date(), fromDaysAhead));
  // Create the return date constant.
  const returnDate = formatSofiaIsoDateFromParts(
    // Call addSofiaCalendarDays to perform this step.
    addSofiaCalendarDays(parseSofiaDate(pickupDate, '00:00') ?? new Date(), nights)
  );

  // Return the resulting value to the caller.
  return { pickupDate, returnDate, pickupTime, returnTime };
}

/** 0 = Sunday … 6 = Saturday for a YYYY-MM-DD Sofia calendar date. */
export function sofiaIsoWeekday(isoDate: string): number {
  // Destructure array values into local variables.
  const [year, month, day] = isoDate.split('-').map(Number);
  // Return the resulting value to the caller.
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * Future range whose pickup falls on `weekday` (0=Sun … 3=Wed … 6=Sat).
 * Keeps week-view drags away from the Monday/Sunday edges.
 */
export function allocateFutureRangeOnWeekday(
  // Provide the weekday field value.
  weekday: number,
  // Provide the options field value.
  options: AllocateFutureRangeOptions = {}
// Continue the surrounding logic with this statement.
): AllocatedFutureRange {
  // Create the from days ahead constant.
  const fromDaysAhead = options.fromDaysAhead ?? 14;
  // Iterate using the loop initializer, condition, and step.
  for (let offset = 0; offset < 7; offset += 1) {
    // Create the range constant.
    const range = allocateFutureRange({ ...options, fromDaysAhead: fromDaysAhead + offset });
    // Evaluate the condition and enter the branch when it is true.
    if (sofiaIsoWeekday(range.pickupDate) === weekday) {
      // Return the resulting value to the caller.
      return range;
    }
  }
  // Return the resulting value to the caller.
  return allocateFutureRange({ ...options, fromDaysAhead });
}
