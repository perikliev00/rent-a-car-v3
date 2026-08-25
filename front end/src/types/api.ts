export type LocationId =
  | 'office'
  | 'sunny-beach'
  | 'sveti-vlas'
  | 'nesebar'
  | 'burgas'
  | 'burgas-airport'
  | 'sofia'
  | 'sofia-airport'
  | 'varna'
  | 'varna-airport'
  | 'plovdiv'
  | 'eleni'
  | 'ravda';

export type Transmission = 'Automatic' | 'Manual';
export type FuelType = 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric';
export type OrderStatus = 'pending' | 'active' | 'expired' | 'cancelled';
export type ContactStatus = 'new' | 'ready' | 'done';
export type UserRole = 'user' | 'staff' | 'admin';

export interface RoleSummary {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  isSystem?: boolean;
}

export interface PermissionSummary {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  category?: string | null;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  error: { code: string; message: string };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

export interface LocationOption {
  id: LocationId;
  label: string;
}

export type DeliveryFees = Record<LocationId, number>;

export type CarFleetStatus =
  | 'available'
  | 'reserved'
  | 'rented'
  | 'needs_cleaning'
  | 'needs_inspection'
  | 'in_maintenance'
  | 'damaged'
  | 'inactive';

export type FuelLevel = 'empty' | 'quarter' | 'half' | 'three_quarters' | 'full';

export type CarServiceType =
  | 'oil_change'
  | 'tires'
  | 'brakes'
  | 'inspection'
  | 'bodywork'
  | 'other';

export type DamageReportStatus = 'unresolved' | 'resolved';

export type CarComplianceType =
  | 'civil_insurance'
  | 'casco'
  | 'vignette'
  | 'technical_inspection'
  | 'vehicle_tax'
  | 'registration_certificate'
  | 'fire_extinguisher'
  | 'first_aid_kit'
  | 'warning_triangle'
  | 'leasing'
  | 'other';

export type CarComplianceStatus = 'valid' | 'expired' | 'missing';

export interface CarComplianceItem {
  id: number;
  carId: string;
  itemType: CarComplianceType | string;
  label: string;
  title: string | null;
  referenceNumber: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
  documentUrl: string | null;
  status: CarComplianceStatus;
  createdByUserId: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CarDateBlock {
  startDate: string;
  endDate: string;
}

export interface Car {
  id: string;
  name: string;
  image: string;
  transmission: string;
  price?: number;
  pricePerDay?: number;
  priceTier_1_3?: number;
  priceTier_7_31?: number;
  priceTier_31_plus?: number;
  seats: number;
  fuelType: string;
  availability: boolean;
  status?: CarFleetStatus;
  registrationNumber?: string;
  vin?: string;
  mileage?: number;
  fuelLevel?: FuelLevel;
  currentLocation?: string;
  insuranceExpiry?: string;
  technicalInspectionExpiry?: string;
  category: string;
  categoryId?: number;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  dates?: CarDateBlock[];
}

export interface CarServiceRecord {
  id: number;
  carId: string;
  serviceType: CarServiceType | string;
  description: string | null;
  cost: number | null;
  mileage: number | null;
  serviceDate: string;
  nextServiceDate: string | null;
  createdByUserId: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CarDamageReport {
  id: number;
  carId: string;
  reservationId: string | null;
  description: string;
  photos: string[];
  repairCost: number | null;
  reportedByUserId: number | null;
  status: DamageReportStatus;
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string | null;
}

export interface CarDocument {
  id: number;
  carId: string;
  name: string;
  url: string;
  uploadedByUserId: number | null;
  createdAt?: string;
}

export interface SearchCar extends Car {
  rentalDays: number;
  deliveryPrice: number;
  returnPrice: number;
  totalPrice: number;
  dayPrice: number;
  unitPrice: number;
}

export interface CarFilters {
  categoryId: string;
  transmission: string;
  fuelType: string;
  priceMin: string;
  priceMax: string;
  seatsMin: string;
  seatsMax: string;
}

export interface Pagination {
  currentPage: number;
  totalPages: number;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  roles?: string[];
  permissions?: string[];
  /**
   * Unverified accounts get a limited session: the account portal is fail-closed and
   * guest bookings cannot be claimed until the email address is confirmed.
   */
  emailVerified?: boolean;
}

export interface AdminStaffUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
  roles: RoleSummary[];
  permissions?: string[];
}

export interface RolePermissionMatrixEntry {
  roleId: string;
  roleSlug: string;
  permissionKeys: string[];
  permissionIds: string[];
}

export interface ExistingReservationSummary {
  carName: string;
  pickupDate: string;
  returnDate: string;
  totalPrice: string | null;
}

export interface PriceLine {
  code: string;
  label: string;
  amount: number;
  type: string;
}

export interface PriceBreakdown {
  lines: PriceLine[];
  totalPrice: number;
  deposit: number;
  currency: string;
}

export interface PriceSnapshot extends PriceBreakdown {
  rentalDays?: number;
  dayPrice?: number;
  selectedExtras?: string[];
  hotelDelivery?: boolean;
}

export interface OrderPageData {
  title: string;
  car: Car | null;
  pickupDate: string;
  pickupTime: string;
  returnDate: string;
  returnTime: string;
  pickupLocation: LocationId;
  returnLocation: LocationId;
  pickupLocationDisplay: string;
  returnLocationDisplay: string;
  pickupDateISO: string;
  returnDateISO: string;
  rentalDays: number;
  deliveryPrice: number;
  returnPrice: number;
  totalPrice: number;
  deposit?: number;
  priceBreakdown?: PriceBreakdown | null;
  priceSnapshot?: PriceSnapshot | null;
  selectedExtras?: string[];
  hotelDelivery?: boolean;
  fullName: string;
  phoneNumber: string;
  email: string;
  address: string;
  hotelName: string;
  existingReservation: ExistingReservationSummary | null;
  releaseRedirect: string;
  message: string | null;
}

export interface Order {
  id: string;
  reservationId?: string;
  carId: string | Car;
  pickupDate: string;
  pickupTime?: string;
  returnDate: string;
  returnTime?: string;
  pickupLocation: LocationId | string;
  returnLocation: LocationId | string;
  rentalDays: number;
  deliveryPrice: number;
  returnPrice: number;
  totalPrice: number;
  deposit?: number;
  priceSnapshot?: PriceSnapshot | null;
  selectedExtras?: string[];
  hotelDelivery?: boolean;
  fullName: string;
  phoneNumber: string;
  email: string;
  address: string;
  hotelName?: string;
  stripeSessionId?: string;
  status: OrderStatus;
  expiredAt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: ContactStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactPayload {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export interface PaymentEventRow {
  id: number;
  event_id: string | null;
  event_type: string;
  stripe_session_id: string | null;
  reservation_id: number | null;
  status: string;
  payload: unknown | null;
  created_at: string;
}

export interface PaymentFailureRow {
  id: number;
  reason: string;
  correlation_id: string | null;
  stripe_session_id: string | null;
  reservation_id: number | null;
  event_id: string | null;
  context: unknown | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface CreateOrderBody {
  carId: number;
  pickupDate: string;
  returnDate: string;
  pickupLocation: LocationId;
  returnLocation: LocationId;
  pickupTime?: string;
  returnTime?: string;
  extras?: string[];
  hotelDelivery?: boolean;
}

export interface CheckoutBody extends CreateOrderBody {
  fullName: string;
  phoneNumber: string;
  email: string;
  address: string;
  hotelName?: string;
  lateReturn?: boolean;
  fuelFee?: boolean;
}

export interface CheckoutSuccessData {
  title: string;
  confirmed: boolean;
  bookingStatus: string;
  stripeSessionId: string;
  orderReference: string | null;
  orderId: number | null;
  reservationId: string | number | null;
  supportEmail: string;
  supportPhone: string;
  pickupSummary: string | null;
  message: string;
}

export interface SearchParams {
  pickupDate: string;
  returnDate: string;
  pickupTime: string;
  returnTime: string;
  pickupLocation: LocationId;
  returnLocation: LocationId;
  extras?: string[];
  hotelDelivery?: boolean;
}

export function getCarFromOrder(order: Order): Car | null {
  if (typeof order.carId === 'object' && order.carId !== null) {
    return order.carId;
  }
  return null;
}

export function getCarIdString(carId: string | Car): string {
  return typeof carId === 'object' ? carId.id : carId;
}
