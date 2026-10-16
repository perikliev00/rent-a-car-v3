/**
 * Re-export of the shared application logger (`utils/logger`) for config-path imports.
 * Prefer this when other config modules need logging without depending on `utils/` directly.
 */
module.exports = require('../utils/logger');
