/**
 * Shared TypeScript types for fleet calendar cars, events, and day ops.
 */
export type CalendarViewMode = 'day' | 'week' | 'month';

// Export the calendar event type type.
export type CalendarEventType =
  // Contribute this line to the enclosing declaration or statement.
  | 'reservation'
  // Contribute this line to the enclosing declaration or statement.
  | 'pickup'
  // Contribute this line to the enclosing declaration or statement.
  | 'return'
  // Contribute this line to the enclosing declaration or statement.
  | 'maintenance'
  // Contribute this line to the enclosing declaration or statement.
  | 'cleaning'
  // Contribute this line to the enclosing declaration or statement.
  | 'blocked'
  // Contribute this line to the enclosing declaration or statement.
  | 'manual_review'
  // Contribute this line to the enclosing declaration or statement.
  | 'payment_issue'
  // Contribute this line to the enclosing declaration or statement.
  | 'task';

// Export the calendar car interface.
export interface CalendarCar {
  // Provide the id field value.
  id: string;
  // Provide the name field value.
  name: string;
  // Provide the transmission field value.
  transmission: string;
  // Provide the fuel type field value.
  fuelType: string;
  // Provide the status field value.
  status: string;
  // Provide the current location field value.
  currentLocation: string | null;
  // Provide the category id field value.
  categoryId: string | null;
  // Provide the category name field value.
  categoryName: string | null;
}

// Export the calendar event interface.
export interface CalendarEvent {
  // Provide the id field value.
  id: string;
  // Provide the type field value.
  type: CalendarEventType | string;
  // Provide the car id field value.
  carId: string | null;
  // Provide the start field value.
  start: string;
  // Provide the end field value.
  end: string;
  // Provide the title field value.
  title: string;
  // Contribute this line to the enclosing declaration or statement.
  status?: string;
  // Contribute this line to the enclosing declaration or statement.
  reservationId?: string | null;
  // Continue the surrounding logic with this statement.
  meta?: Record<string, unknown>;
}

// Export the calendar conflict interface.
export interface CalendarConflict {
  // Provide the code field value.
  code: string;
  // Provide the severity field value.
  severity: 'block' | 'warn';
  // Provide the message field value.
  message: string;
  // Contribute this line to the enclosing declaration or statement.
  overridable?: boolean;
}

// Export the calendar filters state interface.
export interface CalendarFiltersState {
  // Provide the category id field value.
  categoryId: string;
  // Provide the transmission field value.
  transmission: string;
  // Provide the fuel type field value.
  fuelType: string;
  // Provide the car status field value.
  carStatus: string;
  // Provide the location field value.
  location: string;
  // Provide the reservation status field value.
  reservationStatus: string;
  // Provide the event type field value.
  eventType: string;
  // Provide the staff user id field value.
  staffUserId: string;
}

// Export the day operations payload interface.
export interface DayOperationsPayload {
  // Provide the date field value.
  date: string;
  // Provide the cars field value.
  cars: CalendarCar[];
  // Provide the free cars field value.
  freeCars: CalendarCar[];
  // Provide the busy cars field value.
  busyCars: CalendarCar[];
  // Provide the maintenance field value.
  maintenance: CalendarCar[];
  // Provide the cleaning field value.
  cleaning: CalendarCar[];
  // Provide the pickups field value.
  pickups: Array<Record<string, unknown>>;
  // Provide the returns field value.
  returns: Array<Record<string, unknown>>;
  // Provide the paid not confirmed field value.
  paidNotConfirmed: Array<Record<string, unknown>>;
  // Provide the insurance warnings field value.
  insuranceWarnings: Array<Record<string, unknown>>;
  // Provide the problems field value.
  problems: Array<{ type: string; carId?: string; reservationId?: string; label: string }>;
}
