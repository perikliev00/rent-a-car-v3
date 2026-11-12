// Create the all permissions constant.
const ALL_PERMISSIONS = [
  // Supply the literal value used by the enclosing expression.
  'can_view_orders',
  // Supply the literal value used by the enclosing expression.
  'can_edit_orders',
  // Supply the literal value used by the enclosing expression.
  'can_cancel_orders',
  // Supply the literal value used by the enclosing expression.
  'can_refund_payments',
  // Supply the literal value used by the enclosing expression.
  'can_manage_cars',
  // Supply the literal value used by the enclosing expression.
  'can_manage_users',
  // Supply the literal value used by the enclosing expression.
  'can_view_revenue',
  // Supply the literal value used by the enclosing expression.
  'can_export_reports',
  // Supply the literal value used by the enclosing expression.
  'can_manage_settings',
  // Supply the literal value used by the enclosing expression.
  'can_view_reservations_ops',
  // Supply the literal value used by the enclosing expression.
  'can_change_reservation_status',
  // Supply the literal value used by the enclosing expression.
  'can_manage_checklists',
  // Supply the literal value used by the enclosing expression.
  'can_manage_payments_monitor',
  // Supply the literal value used by the enclosing expression.
  'can_view_audit_logs',
  // Supply the literal value used by the enclosing expression.
  'can_manage_pricing',
  // Supply the literal value used by the enclosing expression.
  'can_manage_contacts',
  // Supply the literal value used by the enclosing expression.
  'can_manage_fleet_alerts',
  // Supply the literal value used by the enclosing expression.
  'can_view_calendar',
  // Supply the literal value used by the enclosing expression.
  'can_view_own_calendar_tasks',
  // Supply the literal value used by the enclosing expression.
  'can_move_calendar_reservations',
  // Supply the literal value used by the enclosing expression.
  'can_resize_calendar_reservations',
  // Supply the literal value used by the enclosing expression.
  'can_create_calendar_blocks',
  // Supply the literal value used by the enclosing expression.
  'can_create_calendar_tasks',
  // Supply the literal value used by the enclosing expression.
  'can_assign_calendar_staff',
  // Supply the literal value used by the enclosing expression.
  'can_mark_calendar_pickup',
  // Supply the literal value used by the enclosing expression.
  'can_mark_calendar_return',
  // Supply the literal value used by the enclosing expression.
  'can_view_calendar_customer_phone',
  // Supply the literal value used by the enclosing expression.
  'can_view_calendar_customer_documents',
  // Supply the literal value used by the enclosing expression.
  'can_override_calendar_conflicts',
  // Supply the literal value used by the enclosing expression.
  'can_manage_notifications',
];

// Create the owner access constant.
const ownerAccess = {
  // Provide the roles field value.
  roles: ['owner'],
  // Provide the permissions field value.
  permissions: ALL_PERMISSIONS,
  // Provide the role details field value.
  roleDetails: [{ id: '1', slug: 'owner', name: 'Owner' }],
};

/**
 * Jest mock factory for rbacService that grants owner access to admin id=1
 * while keeping customers (other ids) without staff grants.
 */
function createOwnerRbacMock() {
  // Create the actual constant.
  const actual = jest.requireActual('../../src/services/rbac/rbacService');
  // Return the resulting value to the caller.
  return {
    // Spread actual into the surrounding structure.
    ...actual,
    // Provide the get user access field value.
    getUserAccess: jest.fn().mockImplementation(async (userId) => {
      // Evaluate the condition and enter the branch when it is true.
      if (Number(userId) === 1) {
        // Return the resulting value to the caller.
        return ownerAccess;
      }
      // Return the resulting value to the caller.
      return { roles: [], permissions: [], roleDetails: [] };
    }),
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  ALL_PERMISSIONS,
  // Contribute this line to the enclosing declaration or statement.
  ownerAccess,
  // Contribute this line to the enclosing declaration or statement.
  createOwnerRbacMock,
};
