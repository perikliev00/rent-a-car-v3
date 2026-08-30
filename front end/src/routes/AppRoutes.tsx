import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PublicLayout } from '../components/layout/PublicLayout';
import { AdminLayout } from '../components/layout/AdminLayout';
import { AdminRoute } from '../auth/AdminRoute';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { HomePage } from '../pages/public/HomePage';
import { SearchResultsPage } from '../pages/public/SearchResultsPage';
import { CarDetailPage } from '../pages/public/CarDetailPage';
import { OrderPage } from '../pages/public/OrderPage';
import { CheckoutPage } from '../pages/public/CheckoutPage';
import { CheckoutSuccessPage } from '../pages/public/CheckoutSuccessPage';
import { CheckoutCancelPage } from '../pages/public/CheckoutCancelPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { SignupPage } from '../pages/auth/SignupPage';
import { VerifyEmailPage } from '../pages/auth/VerifyEmailPage';
import { AccountDashboardPage } from '../pages/account/AccountDashboardPage';
import { AccountReservationsPage } from '../pages/account/AccountReservationsPage';
import { AccountReservationDetailPage } from '../pages/account/AccountReservationDetailPage';
import { AccountDocumentsPage } from '../pages/account/AccountDocumentsPage';
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';
import { AdminCarsPage } from '../pages/admin/AdminCarsPage';
import { AdminCarDetailPage } from '../pages/admin/AdminCarDetailPage';
import { AdminFleetAlertsPage } from '../pages/admin/AdminFleetAlertsPage';
import { AdminOrdersPage } from '../pages/admin/AdminOrdersPage';
import { AdminOrderCreatePage } from '../pages/admin/AdminOrderCreatePage';
import { AdminOrderDetailPage } from '../pages/admin/AdminOrderDetailPage';
import { AdminOrderEditPage } from '../pages/admin/AdminOrderEditPage';
import { AdminContactsPage } from '../pages/admin/AdminContactsPage';
import { AdminPaymentsPage } from '../pages/admin/AdminPaymentsPage';
import { AdminAnalyticsPage } from '../pages/admin/AdminAnalyticsPage';
import { AdminNotificationsPage } from '../pages/admin/AdminNotificationsPage';
import { AdminAuditLogsPage } from '../pages/admin/AdminAuditLogsPage';
import { AdminReservationOpsPage } from '../pages/admin/AdminReservationOpsPage';
import { AdminPricingSettingsPage } from '../pages/admin/AdminPricingSettingsPage';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';
import { AdminRolesPage } from '../pages/admin/AdminRolesPage';
import { AdminCalendarPage } from '../pages/admin/AdminCalendarPage';
import { ManagerTasksPage } from '../pages/admin/tasks/ManagerTasksPage';
import {
  DriverTasksPage,
  CleanerTasksPage,
  ReceptionistTasksPage,
} from '../pages/admin/tasks/RoleTasksPages';
import {
  AboutPage,
  FaqPage,
  TermsPage,
  PrivacyPage,
  HowToBookPage,
  SupportPage,
  ContactPage,
} from '../pages/static/StaticPages';
import { NotFoundPage } from '../pages/NotFoundPage';

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="search" element={<SearchResultsPage />} />
          <Route path="cars/:carId" element={<CarDetailPage />} />
          <Route path="order/:carId" element={<OrderPage />} />
          <Route path="checkout/:carId" element={<CheckoutPage />} />
          <Route path="checkout/success" element={<CheckoutSuccessPage />} />
          <Route path="checkout/cancel" element={<CheckoutCancelPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route path="verify-email" element={<VerifyEmailPage />} />
          <Route
            path="account"
            element={
              <ProtectedRoute>
                <AccountDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="account/reservations"
            element={
              <ProtectedRoute>
                <AccountReservationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="account/reservations/:id"
            element={
              <ProtectedRoute>
                <AccountReservationDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="account/documents"
            element={
              <ProtectedRoute>
                <AccountDocumentsPage />
              </ProtectedRoute>
            }
          />
          <Route path="about" element={<AboutPage />} />
          <Route path="faq" element={<FaqPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="how-to-book" element={<HowToBookPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="reservations" element={<AdminReservationOpsPage />} />
          <Route path="calendar" element={<AdminCalendarPage />} />
          <Route path="tasks" element={<ManagerTasksPage />} />
          <Route path="tasks/driver" element={<DriverTasksPage />} />
          <Route path="tasks/cleaner" element={<CleanerTasksPage />} />
          <Route path="tasks/receptionist" element={<ReceptionistTasksPage />} />
          <Route path="cars" element={<AdminCarsPage />} />
          <Route path="cars/:id" element={<AdminCarDetailPage />} />
          <Route path="pricing" element={<AdminPricingSettingsPage />} />
          <Route path="fleet-alerts" element={<AdminFleetAlertsPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="orders/new" element={<AdminOrderCreatePage />} />
          <Route path="orders/:id" element={<AdminOrderDetailPage />} />
          <Route path="orders/:id/edit" element={<AdminOrderEditPage />} />
          <Route path="contacts" element={<AdminContactsPage />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
          <Route path="notifications" element={<AdminNotificationsPage />} />
          <Route path="audit-logs" element={<AdminAuditLogsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="roles" element={<AdminRolesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
