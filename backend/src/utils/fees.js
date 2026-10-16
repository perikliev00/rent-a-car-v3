/**
 * Re-export of fee calculation helpers from the pricing package.
 * Prefer importing from `./pricing/calculateFees` for new code; this alias keeps older callers working.
 */
module.exports = require('./pricing/calculateFees');
