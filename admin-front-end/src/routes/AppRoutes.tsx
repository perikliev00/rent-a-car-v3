import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { AdminLayout } from '../components/layout/AdminLayout';
import { AdminRoute } from '../auth/AdminRoute';
import { LoginPage } from '../pages/auth/LoginPage';
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
import { NotFoundPage } from '../pages/NotFoundPage';

export function AppRoutes() {
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
