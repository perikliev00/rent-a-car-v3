import { differenceInMinutes, parseISO } from 'date-fns';
import type { CalendarEvent } from '../calendar.types';

export const ROW_H = 80;
export const LANE_H = 28;
export const LANE_GAP = 4;
export const CAR_COL = 180;

export type TimelineGhost = {
  carId: string;
  left: number;
  width: number;
  title: string;
};

export type TimelineDrop = {
  start: Date;
  end: Date;
  carId: string;
  left: number;
  width: number;
};

export function nowInSofia(): Date {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Sofia',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '0';
  return new Date(
    Number(get('year')),
    Number(get('month')) - 1,
    Number(get('day')),
    Number(get('hour')),
    Number(get('minute')),
    Number(get('second'))
  );
}

export function assignLanes(events: CalendarEvent[]): Map<string, number> {
  const sorted = [...events].sort(
    (a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime()
  );
  const laneEnds: number[] = [];
  const map = new Map<string, number>();
  for (const ev of sorted) {
    const start = parseISO(ev.start).getTime();
    const end = parseISO(ev.end).getTime();
    let lane = laneEnds.findIndex((t) => t <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    map.set(ev.id, lane);
  }
  return map;
}

export function leftPct(start: string | Date, from: Date, totalMinutes: number) {
  const s = typeof start === 'string' ? parseISO(start) : start;
  const mins = differenceInMinutes(s, from);
  return Math.max(0, Math.min(100, (mins / totalMinutes) * 100));
}

export function widthPct(start: string, end: string, totalMinutes: number) {
  const s = parseISO(start);
  const e = parseISO(end);
  const mins = Math.max(30, differenceInMinutes(e, s));
  return Math.max(0.8, Math.min(100, (mins / totalMinutes) * 100));
}

export function atFromClientX(
  clientX: number,
  trackEl: HTMLElement,
  from: Date,
  rangeMs: number
): Date {
  const rect = trackEl.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  return new Date(from.getTime() + pct * rangeMs);
}

export function computeDrop(
  clientX: number,
  trackEl: HTMLElement,
  ev: CalendarEvent,
  carId: string,
  from: Date,
  rangeMs: number,
  totalMinutes: number
): TimelineDrop {
  const duration = differenceInMinutes(parseISO(ev.end), parseISO(ev.start));
  const rect = trackEl.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  const startMs = from.getTime() + pct * rangeMs;
  const start = new Date(startMs);
  const end = new Date(startMs + Math.max(60, duration) * 60 * 1000);
  return {
    start,
    end,
    carId,
    left: pct * 100,
    width: widthPct(start.toISOString(), end.toISOString(), totalMinutes),
  };
}

export function carIdFromTrack(trackEl: HTMLElement) {
  return trackEl.getAttribute('data-car-id') || '';
}

export function trackHeight(maxLane: number) {
  return Math.max(ROW_H, 12 + (maxLane + 1) * (LANE_H + LANE_GAP));
}
