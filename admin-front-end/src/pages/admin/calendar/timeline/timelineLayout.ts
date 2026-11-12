/**
 * Geometry helpers: px-per-ms, bar left/width, snap calculations.
 */
import { differenceInMinutes, parseISO } from 'date-fns';
// Contribute this line to the enclosing declaration or statement.
import type { CalendarEvent } from '../calendar.types';

// Export the row h const.
export const ROW_H = 80;
// Export the lane h const.
export const LANE_H = 28;
// Export the lane gap const.
export const LANE_GAP = 4;
/** Desktop car label column; mobile uses CSS --cal-car-col override. */
export const CAR_COL = 180;
// Export the car col narrow const.
export const CAR_COL_NARROW = 96;

// Export the timeline ghost type.
export type TimelineGhost = {
  // Provide the car id field value.
  carId: string;
  // Provide the left field value.
  left: number;
  // Provide the width field value.
  width: number;
  // Provide the title field value.
  title: string;
};

// Export the timeline drop type.
export type TimelineDrop = {
  // Provide the start field value.
  start: Date;
  // Provide the end field value.
  end: Date;
  // Provide the car id field value.
  carId: string;
  // Provide the left field value.
  left: number;
  // Provide the width field value.
  width: number;
};

/**
 * "Now" line uses Sofia local time to match fleet ops timezone.
 * Builds a local Date from Intl parts so the line aligns with Sofia wall clock.
 */
export function nowInSofia(): Date {
  // Create the parts constant.
  const parts = new Intl.DateTimeFormat('en-GB', {
    // Provide the time zone field value.
    timeZone: 'Europe/Sofia',
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
  // Continue the surrounding logic with this statement.
  }).formatToParts(new Date());
  // Create the get constant.
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '0';
  // Return the resulting value to the caller.
  return new Date(
    // Call Number to perform this step.
    Number(get('year')),
    // Call Number to perform this step.
    Number(get('month')) - 1,
    // Call Number to perform this step.
    Number(get('day')),
    // Call Number to perform this step.
    Number(get('hour')),
    // Call Number to perform this step.
    Number(get('minute')),
    // Call Number to perform this step.
    Number(get('second'))
  );
}

/**
 * Pack overlapping events into vertical lanes within a car row.
 * Greedy: first lane whose previous end is ≤ this start wins.
 *
 * @param events - Events for a single car track
 * @returns Map of event id → lane index
 */
export function assignLanes(events: CalendarEvent[]): Map<string, number> {
  // Create the sorted constant.
  const sorted = [...events].sort(
    // Continue the surrounding logic with this statement.
    (a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime()
  );
  // Continue the surrounding logic with this statement.
  const laneEnds: number[] = [];
  // Create the map constant.
  const map = new Map<string, number>();
  // Iterate using the loop initializer, condition, and step.
  for (const ev of sorted) {
    // Create the start constant.
    const start = parseISO(ev.start).getTime();
    // Create the end constant.
    const end = parseISO(ev.end).getTime();
    // Find first free lane, or open a new one.
    let lane = laneEnds.findIndex((t) => t <= start);
    // Evaluate the condition and enter the branch when it is true.
    if (lane === -1) {
      // Update lane with the right-hand side value.
      lane = laneEnds.length;
      // Call laneEnds.push to perform this step.
      laneEnds.push(end);
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // Update laneEnds[lane] with the right-hand side value.
      laneEnds[lane] = end;
    }
    // Call map.set to perform this step.
    map.set(ev.id, lane);
  }
  // Return the resulting value to the caller.
  return map;
}

/**
 * Left offset of a start time as percent of the visible range.
 * @param start - Event start (ISO or Date)
 * @param from - Range start
 * @param totalMinutes - Visible range length in minutes
 */
export function leftPct(start: string | Date, from: Date, totalMinutes: number) {
  // Create the s constant.
  const s = typeof start === 'string' ? parseISO(start) : start;
  // Create the mins constant.
  const mins = differenceInMinutes(s, from);
  // Return the resulting value to the caller.
  return Math.max(0, Math.min(100, (mins / totalMinutes) * 100));
}

/**
 * Bar width as percent of the visible range (min ~0.8%, duration floor 30m).
 * @param start - Event start ISO
 * @param end - Event end ISO
 * @param totalMinutes - Visible range length in minutes
 */
export function widthPct(start: string, end: string, totalMinutes: number) {
  // Create the s constant.
  const s = parseISO(start);
  // Create the e constant.
  const e = parseISO(end);
  // Floor duration so very short events remain clickable.
  const mins = Math.max(30, differenceInMinutes(e, s));
  // Return the resulting value to the caller.
  return Math.max(0.8, Math.min(100, (mins / totalMinutes) * 100));
}

/**
 * Map a pointer X position on the track to a Date within `[from, from+rangeMs]`.
 *
 * @param clientX - Pointer client X
 * @param trackEl - Track element providing the width rect
 * @param from - Range start
 * @param rangeMs - Range length in ms
 */
export function atFromClientX(
  // Provide the client x field value.
  clientX: number,
  // Provide the track el field value.
  trackEl: HTMLElement,
  // Provide the from field value.
  from: Date,
  // Provide the range ms field value.
  rangeMs: number
// Continue the surrounding logic with this statement.
): Date {
  // Create the rect constant.
  const rect = trackEl.getBoundingClientRect();
  // Create the pct constant.
  const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  // Return the resulting value to the caller.
  return new Date(from.getTime() + pct * rangeMs);
}

/**
 * Compute a drag-drop preview (start/end/car/geometry) from pointer X.
 * Preserves event duration (min 60 minutes).
 *
 * @param clientX - Pointer client X
 * @param trackEl - Target car track element
 * @param ev - Event being dragged
 * @param carId - Target car id
 * @param from - Range start
 * @param rangeMs - Range length in ms
 * @param totalMinutes - Range length in minutes (for widthPct)
 */
export function computeDrop(
  // Provide the client x field value.
  clientX: number,
  // Provide the track el field value.
  trackEl: HTMLElement,
  // Provide the ev field value.
  ev: CalendarEvent,
  // Provide the car id field value.
  carId: string,
  // Provide the from field value.
  from: Date,
  // Provide the range ms field value.
  rangeMs: number,
  // Provide the total minutes field value.
  totalMinutes: number
// Continue the surrounding logic with this statement.
): TimelineDrop {
  // Create the duration constant.
  const duration = differenceInMinutes(parseISO(ev.end), parseISO(ev.start));
  // Create the rect constant.
  const rect = trackEl.getBoundingClientRect();
  // Create the pct constant.
  const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  // Create the start ms constant.
  const startMs = from.getTime() + pct * rangeMs;
  // Create the start constant.
  const start = new Date(startMs);
  // Keep at least one hour so resize/move never collapses to zero.
  const end = new Date(startMs + Math.max(60, duration) * 60 * 1000);
  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    start,
    // Contribute this line to the enclosing declaration or statement.
    end,
    // Contribute this line to the enclosing declaration or statement.
    carId,
    // Provide the left field value.
    left: pct * 100,
    // Provide the width field value.
    width: widthPct(start.toISOString(), end.toISOString(), totalMinutes),
  };
}

/**
 * Read `data-car-id` from a track element (empty string if missing).
 * @param trackEl - Track DOM node
 */
export function carIdFromTrack(trackEl: HTMLElement) {
  // Return the resulting value to the caller.
  return trackEl.getAttribute('data-car-id') || '';
}

/**
 * Row height large enough for `maxLane` stacked lanes.
 * @param maxLane - Highest lane index used in the row
 */
export function trackHeight(maxLane: number) {
  // Return the resulting value to the caller.
  return Math.max(ROW_H, 12 + (maxLane + 1) * (LANE_H + LANE_GAP));
}
