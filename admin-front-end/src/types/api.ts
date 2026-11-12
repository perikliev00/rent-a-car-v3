/**
 * Shared TypeScript contracts for admin API payloads (cars, orders, RBAC, payments).
 */
export type LocationId =
  // Contribute this line to the enclosing declaration or statement.
  | 'office'
  // Contribute this line to the enclosing declaration or statement.
  | 'sunny-beach'
  // Contribute this line to the enclosing declaration or statement.
  | 'sveti-vlas'
  // Contribute this line to the enclosing declaration or statement.
  | 'nesebar'
  // Contribute this line to the enclosing declaration or statement.
  | 'burgas'
  // Contribute this line to the enclosing declaration or statement.
  | 'burgas-airport'
  // Contribute this line to the enclosing declaration or statement.
  | 'sofia'
  // Contribute this line to the enclosing declaration or statement.
  | 'sofia-airport'
  // Contribute this line to the enclosing declaration or statement.
  | 'varna'
  // Contribute this line to the enclosing declaration or statement.
  | 'varna-airport'
  // Contribute this line to the enclosing declaration or statement.
  | 'plovdiv'
  // Contribute this line to the enclosing declaration or statement.
  | 'eleni'
  // Contribute this line to the enclosing declaration or statement.
  | 'ravda';

// Export the transmission type.
export type Transmission = 'Automatic' | 'Manual';
// Export the fuel type type.
export type FuelType = 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric';
// Export the order status type.
export type OrderStatus = 'pending' | 'active' | 'expired' | 'cancelled';
// Export the contact status type.
export type ContactStatus = 'new' | 'ready' | 'done';
// Export the user role type.
export type UserRole = 'user' | 'staff' | 'admin';

// Export the role summary interface.
export interface RoleSummary {
  // Provide the id field value.
  id: string;
  // Provide the slug field value.
  slug: string;
  // Provide the name field value.
  name: string;
  // Contribute this line to the enclosing declaration or statement.
  description?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  isSystem?: boolean;
}

// Export the permission summary interface.
export interface PermissionSummary {
  // Provide the id field value.
  id: string;
  // Provide the key field value.
  key: string;
  // Provide the name field value.
  name: string;
  // Contribute this line to the enclosing declaration or statement.
  description?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  category?: string | null;
}

// Export the api success interface.
export interface ApiSuccess<T> {
  // Provide the success field value.
  success: true;
  // Provide the data field value.
  data: T;
}

// Export the api error body interface.
export interface ApiErrorBody {
  // Provide the success field value.
  success: false;
  // Provide the error field value.
  error: { code: string; message: string };
}

// Export the api response type.
export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

// Export the location option interface.
export interface LocationOption {
  // Provide the id field value.
  id: LocationId;
  // Provide the label field value.
  label: string;
}

// Export the delivery fees type.
export type DeliveryFees = Record<LocationId, number>;

// Export the car fleet status type.
export type CarFleetStatus =
  // Contribute this line to the enclosing declaration or statement.
  | 'available'
  // Contribute this line to the enclosing declaration or statement.
  | 'reserved'
  // Contribute this line to the enclosing declaration or statement.
  | 'rented'
  // Contribute this line to the enclosing declaration or statement.
  | 'needs_cleaning'
  // Contribute this line to the enclosing declaration or statement.
  | 'needs_inspection'
  // Contribute this line to the enclosing declaration or statement.
  | 'in_maintenance'
  // Contribute this line to the enclosing declaration or statement.
  | 'damaged'
  // Contribute this line to the enclosing declaration or statement.
  | 'inactive';

// Export the fuel level type.
export type FuelLevel = 'empty' | 'quarter' | 'half' | 'three_quarters' | 'full';

// Export the car service type type.
export type CarServiceType =
  // Contribute this line to the enclosing declaration or statement.
  | 'oil_change'
  // Contribute this line to the enclosing declaration or statement.
  | 'tires'
  // Contribute this line to the enclosing declaration or statement.
  | 'brakes'
  // Contribute this line to the enclosing declaration or statement.
  | 'inspection'
  // Contribute this line to the enclosing declaration or statement.
  | 'bodywork'
  // Contribute this line to the enclosing declaration or statement.
  | 'other';

// Export the damage report status type.
export type DamageReportStatus = 'unresolved' | 'resolved';

// Export the car compliance type type.
export type CarComplianceType =
  // Contribute this line to the enclosing declaration or statement.
  | 'civil_insurance'
  // Contribute this line to the enclosing declaration or statement.
  | 'casco'
  // Contribute this line to the enclosing declaration or statement.
  | 'vignette'
  // Contribute this line to the enclosing declaration or statement.
  | 'technical_inspection'
  // Contribute this line to the enclosing declaration or statement.
  | 'vehicle_tax'
  // Contribute this line to the enclosing declaration or statement.
  | 'registration_certificate'
  // Contribute this line to the enclosing declaration or statement.
  | 'fire_extinguisher'
  // Contribute this line to the enclosing declaration or statement.
  | 'first_aid_kit'
  // Contribute this line to the enclosing declaration or statement.
  | 'warning_triangle'
  // Contribute this line to the enclosing declaration or statement.
  | 'leasing'
  // Contribute this line to the enclosing declaration or statement.
  | 'other';

// Export the car compliance status type.
export type CarComplianceStatus = 'valid' | 'expired' | 'missing';

// Export the car compliance item interface.
export interface CarComplianceItem {
  // Provide the id field value.
  id: number;
  // Provide the car id field value.
  carId: string;
  // Provide the item type field value.
  itemType: CarComplianceType | string;
  // Provide the label field value.
  label: string;
  // Provide the title field value.
  title: string | null;
  // Provide the reference number field value.
  referenceNumber: string | null;
  // Provide the issued at field value.
  issuedAt: string | null;
  // Provide the expires at field value.
  expiresAt: string | null;
  // Provide the notes field value.
  notes: string | null;
  // Provide the has document field value.
  hasDocument: boolean;
  // Provide the status field value.
  status: CarComplianceStatus;
  // Provide the created by user id field value.
  createdByUserId: number | null;
  // Contribute this line to the enclosing declaration or statement.
  createdAt?: string;
  // Contribute this line to the enclosing declaration or statement.
  updatedAt?: string;
}

// Export the car date block interface.
export interface CarDateBlock {
  // Provide the start date field value.
  startDate: string;
  // Provide the end date field value.
  endDate: string;
}

// Export the car interface.
export interface Car {
  // Provide the id field value.
  id: string;
  // Provide the name field value.
  name: string;
  // Provide the image field value.
  image: string;
  // Provide the transmission field value.
  transmission: string;
  // Contribute this line to the enclosing declaration or statement.
  price?: number;
  // Contribute this line to the enclosing declaration or statement.
  pricePerDay?: number;
  // Contribute this line to the enclosing declaration or statement.
  priceTier_1_3?: number;
  // Contribute this line to the enclosing declaration or statement.
  priceTier_7_31?: number;
  // Contribute this line to the enclosing declaration or statement.
  priceTier_31_plus?: number;
  // Provide the seats field value.
  seats: number;
  // Provide the fuel type field value.
  fuelType: string;
  // Provide the availability field value.
  availability: boolean;
  // Contribute this line to the enclosing declaration or statement.
  status?: CarFleetStatus;
  // Contribute this line to the enclosing declaration or statement.
  registrationNumber?: string;
  // Contribute this line to the enclosing declaration or statement.
  vin?: string;
  // Contribute this line to the enclosing declaration or statement.
  mileage?: number;
  // Contribute this line to the enclosing declaration or statement.
  fuelLevel?: FuelLevel;
  // Contribute this line to the enclosing declaration or statement.
  currentLocation?: string;
  // Contribute this line to the enclosing declaration or statement.
  insuranceExpiry?: string;
  // Contribute this line to the enclosing declaration or statement.
  technicalInspectionExpiry?: string;
  // Provide the category field value.
  category: string;
  // Contribute this line to the enclosing declaration or statement.
  categoryId?: number;
  // Contribute this line to the enclosing declaration or statement.
  isDeleted?: boolean;
  // Contribute this line to the enclosing declaration or statement.
  deletedAt?: string;
  // Contribute this line to the enclosing declaration or statement.
  createdAt?: string;
  // Contribute this line to the enclosing declaration or statement.
  updatedAt?: string;
  // Contribute this line to the enclosing declaration or statement.
  dates?: CarDateBlock[];
}

// Export the car service record interface.
export interface CarServiceRecord {
  // Provide the id field value.
  id: number;
  // Provide the car id field value.
  carId: string;
  // Provide the service type field value.
  serviceType: CarServiceType | string;
  // Provide the description field value.
  description: string | null;
  // Provide the cost field value.
  cost: number | null;
  // Provide the mileage field value.
  mileage: number | null;
  // Provide the service date field value.
  serviceDate: string;
  // Provide the next service date field value.
  nextServiceDate: string | null;
  // Provide the created by user id field value.
  createdByUserId: number | null;
  // Contribute this line to the enclosing declaration or statement.
  createdAt?: string;
  // Contribute this line to the enclosing declaration or statement.
  updatedAt?: string;
}

// Export the car damage report interface.
export interface CarDamageReport {
  // Provide the id field value.
  id: number;
  // Provide the car id field value.
  carId: string;
  // Provide the reservation id field value.
  reservationId: string | null;
  // Provide the description field value.
  description: string;
  // Provide the photos field value.
  photos: string[];
  // Provide the repair cost field value.
  repairCost: number | null;
  // Provide the reported by user id field value.
  reportedByUserId: number | null;
  // Provide the status field value.
  status: DamageReportStatus;
  // Contribute this line to the enclosing declaration or statement.
  createdAt?: string;
  // Contribute this line to the enclosing declaration or statement.
  updatedAt?: string;
  // Contribute this line to the enclosing declaration or statement.
  resolvedAt?: string | null;
}

// Export the car document interface.
export interface CarDocument {
  // Provide the id field value.
  id: number;
  // Provide the car id field value.
  carId: string;
  // Provide the name field value.
  name: string;
  // Provide the original filename field value.
  originalFilename: string;
  // Provide the mime type field value.
  mimeType: string;
  // Provide the size bytes field value.
  sizeBytes: number | null;
  // Provide the has file field value.
  hasFile: boolean;
  // Provide the uploaded by user id field value.
  uploadedByUserId: number | null;
  // Contribute this line to the enclosing declaration or statement.
  createdAt?: string;
}

// Export the search car interface.
export interface SearchCar extends Car {
  // Provide the rental days field value.
  rentalDays: number;
  // Provide the delivery price field value.
  deliveryPrice: number;
  // Provide the return price field value.
  returnPrice: number;
  // Provide the total price field value.
  totalPrice: number;
  // Provide the day price field value.
  dayPrice: number;
  // Provide the unit price field value.
  unitPrice: number;
}

// Export the car filters interface.
export interface CarFilters {
  // Provide the category id field value.
  categoryId: string;
  // Provide the transmission field value.
  transmission: string;
  // Provide the fuel type field value.
  fuelType: string;
  // Provide the price min field value.
  priceMin: string;
  // Provide the price max field value.
  priceMax: string;
  // Provide the seats min field value.
  seatsMin: string;
  // Provide the seats max field value.
  seatsMax: string;
}

// Export the pagination interface.
export interface Pagination {
  // Provide the current page field value.
  currentPage: number;
  // Provide the total pages field value.
  totalPages: number;
}

// Export the user interface.
export interface User {
  // Provide the id field value.
  id: string;
  // Provide the email field value.
  email: string;
  // Provide the role field value.
  role: UserRole;
  // Contribute this line to the enclosing declaration or statement.
  roles?: string[];
  // Contribute this line to the enclosing declaration or statement.
  permissions?: string[];
  // Contribute this line to the enclosing declaration or statement.
  emailVerified?: boolean;
}

// Export the admin staff user interface.
export interface AdminStaffUser {
  // Provide the id field value.
  id: string;
  // Provide the email field value.
  email: string;
  // Provide the role field value.
  role: UserRole;
  // Contribute this line to the enclosing declaration or statement.
  createdAt?: string;
  // Contribute this line to the enclosing declaration or statement.
  updatedAt?: string;
  // Provide the roles field value.
  roles: RoleSummary[];
  // Contribute this line to the enclosing declaration or statement.
  permissions?: string[];
}

// Export the role permission matrix entry interface.
export interface RolePermissionMatrixEntry {
  // Provide the role id field value.
  roleId: string;
  // Provide the role slug field value.
  roleSlug: string;
  // Provide the permission keys field value.
  permissionKeys: string[];
  // Provide the permission ids field value.
  permissionIds: string[];
}

// Export the existing reservation summary interface.
export interface ExistingReservationSummary {
  // Provide the car name field value.
  carName: string;
  // Provide the pickup date field value.
  pickupDate: string;
  // Provide the return date field value.
  returnDate: string;
  // Provide the total price field value.
  totalPrice: string | null;
}

// Export the price line interface.
export interface PriceLine {
  // Provide the code field value.
  code: string;
  // Provide the label field value.
  label: string;
  // Provide the amount field value.
  amount: number;
  // Provide the type field value.
  type: string;
}

// Export the price breakdown interface.
export interface PriceBreakdown {
  // Provide the lines field value.
  lines: PriceLine[];
  // Provide the total price field value.
  totalPrice: number;
  // Provide the deposit field value.
  deposit: number;
  // Provide the currency field value.
  currency: string;
}

// Export the price snapshot interface.
export interface PriceSnapshot extends PriceBreakdown {
  // Contribute this line to the enclosing declaration or statement.
  rentalDays?: number;
  // Contribute this line to the enclosing declaration or statement.
  dayPrice?: number;
  // Contribute this line to the enclosing declaration or statement.
  selectedExtras?: string[];
  // Contribute this line to the enclosing declaration or statement.
  hotelDelivery?: boolean;
}

// Export the order page data interface.
export interface OrderPageData {
  // Provide the title field value.
  title: string;
  // Provide the car field value.
  car: Car | null;
  // Provide the pickup date field value.
  pickupDate: string;
  // Provide the pickup time field value.
  pickupTime: string;
  // Provide the return date field value.
  returnDate: string;
  // Provide the return time field value.
  returnTime: string;
  // Provide the pickup location field value.
  pickupLocation: LocationId;
  // Provide the return location field value.
  returnLocation: LocationId;
  // Provide the pickup location display field value.
  pickupLocationDisplay: string;
  // Provide the return location display field value.
  returnLocationDisplay: string;
  // Provide the pickup date iso field value.
  pickupDateISO: string;
  // Provide the return date iso field value.
  returnDateISO: string;
  // Provide the rental days field value.
  rentalDays: number;
  // Provide the delivery price field value.
  deliveryPrice: number;
  // Provide the return price field value.
  returnPrice: number;
  // Provide the total price field value.
  totalPrice: number;
  // Contribute this line to the enclosing declaration or statement.
  deposit?: number;
  // Contribute this line to the enclosing declaration or statement.
  priceBreakdown?: PriceBreakdown | null;
  // Contribute this line to the enclosing declaration or statement.
  priceSnapshot?: PriceSnapshot | null;
  // Contribute this line to the enclosing declaration or statement.
  selectedExtras?: string[];
  // Contribute this line to the enclosing declaration or statement.
  hotelDelivery?: boolean;
  // Provide the full name field value.
  fullName: string;
  // Provide the phone number field value.
  phoneNumber: string;
  // Provide the email field value.
  email: string;
  // Provide the address field value.
  address: string;
  // Provide the hotel name field value.
  hotelName: string;
  // Provide the existing reservation field value.
  existingReservation: ExistingReservationSummary | null;
  // Provide the release redirect field value.
  releaseRedirect: string;
  // Provide the message field value.
  message: string | null;
}

// Export the order interface.
export interface Order {
  // Provide the id field value.
  id: string;
  // Contribute this line to the enclosing declaration or statement.
  reservationId?: string;
  // Provide the car id field value.
  carId: string | Car;
  // Provide the pickup date field value.
  pickupDate: string;
  // Contribute this line to the enclosing declaration or statement.
  pickupTime?: string;
  // Provide the return date field value.
  returnDate: string;
  // Contribute this line to the enclosing declaration or statement.
  returnTime?: string;
  // Provide the pickup location field value.
  pickupLocation: LocationId | string;
  // Provide the return location field value.
  returnLocation: LocationId | string;
  // Provide the rental days field value.
  rentalDays: number;
  // Provide the delivery price field value.
  deliveryPrice: number;
  // Provide the return price field value.
  returnPrice: number;
  // Provide the total price field value.
  totalPrice: number;
  // Contribute this line to the enclosing declaration or statement.
  deposit?: number;
  // Contribute this line to the enclosing declaration or statement.
  priceSnapshot?: PriceSnapshot | null;
  // Contribute this line to the enclosing declaration or statement.
  selectedExtras?: string[];
  // Contribute this line to the enclosing declaration or statement.
  hotelDelivery?: boolean;
  // Provide the full name field value.
  fullName: string;
  // Provide the phone number field value.
  phoneNumber: string;
  // Provide the email field value.
  email: string;
  // Provide the address field value.
  address: string;
  // Contribute this line to the enclosing declaration or statement.
  hotelName?: string;
  // Contribute this line to the enclosing declaration or statement.
  stripeSessionId?: string;
  // Provide the status field value.
  status: OrderStatus;
  // Contribute this line to the enclosing declaration or statement.
  expiredAt?: string;
  // Provide the is deleted field value.
  isDeleted: boolean;
  // Contribute this line to the enclosing declaration or statement.
  deletedAt?: string;
  // Contribute this line to the enclosing declaration or statement.
  createdAt?: string;
  // Contribute this line to the enclosing declaration or statement.
  updatedAt?: string;
}

// Export the contact interface.
export interface Contact {
  // Provide the id field value.
  id: string;
  // Provide the name field value.
  name: string;
  // Provide the email field value.
  email: string;
  // Contribute this line to the enclosing declaration or statement.
  phone?: string;
  // Provide the subject field value.
  subject: string;
  // Provide the message field value.
  message: string;
  // Provide the status field value.
  status: ContactStatus;
  // Provide the created at field value.
  createdAt: string;
  // Provide the updated at field value.
  updatedAt: string;
}

// Export the create contact payload interface.
export interface CreateContactPayload {
  // Provide the name field value.
  name: string;
  // Provide the email field value.
  email: string;
  // Contribute this line to the enclosing declaration or statement.
  phone?: string;
  // Provide the subject field value.
  subject: string;
  // Provide the message field value.
  message: string;
}

// Export the payment event row interface.
export interface PaymentEventRow {
  // Provide the id field value.
  id: number;
  // Provide the event id field value.
  event_id: string | null;
  // Provide the event type field value.
  event_type: string;
  // Provide the stripe session id field value.
  stripe_session_id: string | null;
  // Provide the reservation id field value.
  reservation_id: number | null;
  // Provide the status field value.
  status: string;
  // Provide the payload field value.
  payload: unknown | null;
  // Provide the created at field value.
  created_at: string;
}

// Export the payment failure row interface.
export interface PaymentFailureRow {
  // Provide the id field value.
  id: number;
  // Provide the reason field value.
  reason: string;
  // Provide the correlation id field value.
  correlation_id: string | null;
  // Provide the stripe session id field value.
  stripe_session_id: string | null;
  // Provide the reservation id field value.
  reservation_id: number | null;
  // Provide the event id field value.
  event_id: string | null;
  // Provide the context field value.
  context: unknown | null;
  // Provide the resolved field value.
  resolved: boolean;
  // Provide the resolved at field value.
  resolved_at: string | null;
  // Provide the created at field value.
  created_at: string;
}

// Export the create order body interface.
export interface CreateOrderBody {
  // Provide the car id field value.
  carId: number;
  // Provide the pickup date field value.
  pickupDate: string;
  // Provide the return date field value.
  returnDate: string;
  // Provide the pickup location field value.
  pickupLocation: LocationId;
  // Provide the return location field value.
  returnLocation: LocationId;
  // Contribute this line to the enclosing declaration or statement.
  pickupTime?: string;
  // Contribute this line to the enclosing declaration or statement.
  returnTime?: string;
  // Contribute this line to the enclosing declaration or statement.
  extras?: string[];
  // Contribute this line to the enclosing declaration or statement.
  hotelDelivery?: boolean;
}

// Export the checkout body interface.
export interface CheckoutBody extends CreateOrderBody {
  // Provide the full name field value.
  fullName: string;
  // Provide the phone number field value.
  phoneNumber: string;
  // Provide the email field value.
  email: string;
  // Provide the address field value.
  address: string;
  // Contribute this line to the enclosing declaration or statement.
  hotelName?: string;
  // Contribute this line to the enclosing declaration or statement.
  lateReturn?: boolean;
  // Contribute this line to the enclosing declaration or statement.
  fuelFee?: boolean;
}

// Export the checkout success data interface.
export interface CheckoutSuccessData {
  // Provide the title field value.
  title: string;
  // Provide the confirmed field value.
  confirmed: boolean;
  // Provide the booking status field value.
  bookingStatus: string;
  // Provide the stripe session id field value.
  stripeSessionId: string;
  // Provide the order reference field value.
  orderReference: string | null;
  // Provide the order id field value.
  orderId: number | null;
  // Provide the reservation id field value.
  reservationId: string | number | null;
  // Provide the support email field value.
  supportEmail: string;
  // Provide the support phone field value.
  supportPhone: string;
  // Provide the pickup summary field value.
  pickupSummary: string | null;
  // Provide the message field value.
  message: string;
}

// Export the search params interface.
export interface SearchParams {
  // Provide the pickup date field value.
  pickupDate: string;
  // Provide the return date field value.
  returnDate: string;
  // Provide the pickup time field value.
  pickupTime: string;
  // Provide the return time field value.
  returnTime: string;
  // Provide the pickup location field value.
  pickupLocation: LocationId;
  // Provide the return location field value.
  returnLocation: LocationId;
  // Contribute this line to the enclosing declaration or statement.
  extras?: string[];
  // Contribute this line to the enclosing declaration or statement.
  hotelDelivery?: boolean;
}

/**
 * When `order.carId` is populated as a nested Car object, return it; else null.
 * @param order - Order that may embed or reference a car
 */
export function getCarFromOrder(order: Order): Car | null {
  // Populated join shape from some admin order payloads.
  if (typeof order.carId === 'object' && order.carId !== null) {
    // Return the resulting value to the caller.
    return order.carId;
  }
  // Return the resulting value to the caller.
  return null;
}

/**
 * Normalize a car id whether the field is a string id or a Car object.
 * @param carId - String id or populated Car
 */
export function getCarIdString(carId: string | Car): string {
  // Return the resulting value to the caller.
  return typeof carId === 'object' ? carId.id : carId;
}
