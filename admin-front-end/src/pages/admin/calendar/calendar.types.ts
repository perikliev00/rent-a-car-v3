export type CalendarViewMode = 'day' | 'week' | 'month';

export type CalendarEventType =
  | 'reservation'
  | 'pickup'
  | 'return'
  | 'maintenance'
  | 'cleaning'
  | 'blocked'
  | 'manual_review'
  | 'payment_issue'
  | 'task';

export interface CalendarCar {
  id: string;
  name: string;
  transmission: string;
  fuelType: string;
  status: string;
  currentLocation: string | null;
  categoryId: string | null;
  categoryName: string | null;
}

export interface CalendarEvent {
  id: string;
  type: CalendarEventType | string;
  carId: string | null;
  start: string;
  end: string;
  title: string;
  status?: string;
  reservationId?: string | null;
  meta?: Record<string, unknown>;
}

export interface CalendarConflict {
  code: string;
  severity: 'block' | 'warn';
  message: string;
  overridable?: boolean;
}

export interface CalendarFiltersState {
  categoryId: string;
  transmission: string;
  fuelType: string;
  carStatus: string;
  location: string;
  reservationStatus: string;
  eventType: string;
  staffUserId: string;
}

export interface DayOperationsPayload {
  date: string;
  cars: CalendarCar[];
  freeCars: CalendarCar[];
  busyCars: CalendarCar[];
  maintenance: CalendarCar[];
  cleaning: CalendarCar[];
  pickups: Array<Record<string, unknown>>;
  returns: Array<Record<string, unknown>>;
  paidNotConfirmed: Array<Record<string, unknown>>;
  insuranceWarnings: Array<Record<string, unknown>>;
  problems: Array<{ type: string; carId?: string; reservationId?: string; label: string }>;
}
