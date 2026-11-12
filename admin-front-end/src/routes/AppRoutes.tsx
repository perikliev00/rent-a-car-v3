/**
 * Top-level React Router map for login, admin shell, and role task pages.
 */
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
// Import named exports from '../components/layout/AdminLayout'.
import { AdminLayout } from '../components/layout/AdminLayout';
// Import named exports from '../auth/AdminRoute'.
import { AdminRoute } from '../auth/AdminRoute';
// Import named exports from '../pages/auth/LoginPage'.
import { LoginPage } from '../pages/auth/LoginPage';
// Import named exports from '../pages/admin/AdminDashboardPage'.
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';
// Import named exports from '../pages/admin/AdminCarsPage'.
import { AdminCarsPage } from '../pages/admin/AdminCarsPage';
// Import named exports from '../pages/admin/AdminCarDetailPage'.
import { AdminCarDetailPage } from '../pages/admin/AdminCarDetailPage';
// Import named exports from '../pages/admin/AdminFleetAlertsPage'.
import { AdminFleetAlertsPage } from '../pages/admin/AdminFleetAlertsPage';
// Import named exports from '../pages/admin/AdminOrdersPage'.
import { AdminOrdersPage } from '../pages/admin/AdminOrdersPage';
// Import named exports from '../pages/admin/AdminOrderCreatePage'.
import { AdminOrderCreatePage } from '../pages/admin/AdminOrderCreatePage';
// Import named exports from '../pages/admin/AdminOrderDetailPage'.
import { AdminOrderDetailPage } from '../pages/admin/AdminOrderDetailPage';
// Import named exports from '../pages/admin/AdminOrderEditPage'.
import { AdminOrderEditPage } from '../pages/admin/AdminOrderEditPage';
// Import named exports from '../pages/admin/AdminContactsPage'.
import { AdminContactsPage } from '../pages/admin/AdminContactsPage';
// Import named exports from '../pages/admin/AdminPaymentsPage'.
import { AdminPaymentsPage } from '../pages/admin/AdminPaymentsPage';
// Import named exports from '../pages/admin/AdminAnalyticsPage'.
import { AdminAnalyticsPage } from '../pages/admin/AdminAnalyticsPage';
// Import named exports from '../pages/admin/AdminNotificationsPage'.
import { AdminNotificationsPage } from '../pages/admin/AdminNotificationsPage';
// Import named exports from '../pages/admin/AdminAuditLogsPage'.
import { AdminAuditLogsPage } from '../pages/admin/AdminAuditLogsPage';
// Import named exports from '../pages/admin/AdminReservationOpsPage'.
import { AdminReservationOpsPage } from '../pages/admin/AdminReservationOpsPage';
// Import named exports from '../pages/admin/AdminPricingSettingsPage'.
import { AdminPricingSettingsPage } from '../pages/admin/AdminPricingSettingsPage';
// Import named exports from '../pages/admin/AdminUsersPage'.
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';
// Import named exports from '../pages/admin/AdminRolesPage'.
import { AdminRolesPage } from '../pages/admin/AdminRolesPage';
// Import named exports from '../pages/admin/AdminCalendarPage'.
import { AdminCalendarPage } from '../pages/admin/AdminCalendarPage';
// Import named exports from '../pages/admin/tasks/ManagerTasksPage'.
import { ManagerTasksPage } from '../pages/admin/tasks/ManagerTasksPage';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  DriverTasksPage,
  // Contribute this line to the enclosing declaration or statement.
  CleanerTasksPage,
  // Contribute this line to the enclosing declaration or statement.
  ReceptionistTasksPage,
// Contribute this line to the enclosing declaration or statement.
} from '../pages/admin/tasks/RoleTasksPages';
// Import named exports from '../pages/NotFoundPage'.
import { NotFoundPage } from '../pages/NotFoundPage';

/**
 * App route tree: public login, staff-guarded `/admin/*`, and catch-all 404.
 * Root `/` redirects into the admin dashboard.
 */
export function AppRoutes() {
  // Return control to the caller with the following value.
  return (
    <BrowserRouter>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/admin" replace />} />
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
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
