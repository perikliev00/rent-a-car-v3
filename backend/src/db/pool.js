const { createInstrumentedPool } = require('./instrumentedPool');

const pool = createInstrumentedPool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
