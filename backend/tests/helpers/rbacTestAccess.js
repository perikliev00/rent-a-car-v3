const ALL_PERMISSIONS = [
  'can_view_orders',
  'can_edit_orders',
  'can_cancel_orders',
  'can_refund_payments',
  'can_manage_cars',
  'can_manage_users',
  'can_view_revenue',
  'can_export_reports',
  'can_manage_settings',
  'can_view_reservations_ops',
  'can_change_reservation_status',
  'can_manage_checklists',
  'can_manage_payments_monitor',
  'can_view_audit_logs',
  'can_manage_pricing',
  'can_manage_contacts',
  'can_manage_fleet_alerts',
  'can_view_calendar',
  'can_view_own_calendar_tasks',
  'can_move_calendar_reservations',
  'can_resize_calendar_reservations',
  'can_create_calendar_blocks',
  'can_create_calendar_tasks',
  'can_assign_calendar_staff',
  'can_mark_calendar_pickup',
  'can_mark_calendar_return',
  'can_view_calendar_customer_phone',
  'can_view_calendar_customer_documents',
  'can_override_calendar_conflicts',
  'can_manage_notifications',
];

const ownerAccess = {
  roles: ['owner'],
  permissions: ALL_PERMISSIONS,
  roleDetails: [{ id: '1', slug: 'owner', name: 'Owner' }],
};

/**
 * Jest mock factory for rbacService that grants owner access to admin id=1
 * while keeping customers (other ids) without staff grants.
 */
function createOwnerRbacMock() {
  const actual = jest.requireActual('../../src/services/rbac/rbacService');
  return {
    ...actual,
    getUserAccess: jest.fn().mockImplementation(async (userId) => {
      if (Number(userId) === 1) {
        return ownerAccess;
      }
      return { roles: [], permissions: [], roleDetails: [] };
    }),
  };
}

module.exports = {
  ALL_PERMISSIONS,
  ownerAccess,
  createOwnerRbacMock,
};
