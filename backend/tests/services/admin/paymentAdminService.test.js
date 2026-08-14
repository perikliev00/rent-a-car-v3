const fs = require('fs');
const path = require('path');
const { RECONCILE_SCRIPT_PATH } = require('../../../src/services/admin/paymentAdminService');

describe('paymentAdminService reconcile script path', () => {
  test('RECONCILE_SCRIPT_PATH points at backend/scripts/reconcileStripeSessions.js', () => {
    expect(fs.existsSync(RECONCILE_SCRIPT_PATH)).toBe(true);
    expect(path.basename(RECONCILE_SCRIPT_PATH)).toBe('reconcileStripeSessions.js');
    expect(RECONCILE_SCRIPT_PATH.replace(/\\/g, '/')).toMatch(/\/scripts\/reconcileStripeSessions\.js$/);
    expect(RECONCILE_SCRIPT_PATH.replace(/\\/g, '/')).not.toMatch(/\/src\/scripts\//);
  });
});
