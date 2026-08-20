const { createInstrumentedPool } = require('./instrumentedPool');

function isUsablePool(pool) {
  return Boolean(pool) && pool.ended !== true && pool.ending !== true;
}

function createPool() {
  const isTest = process.env.NODE_ENV === 'test';
  return createInstrumentedPool({
    connectionString: process.env.DATABASE_URL,
    ...(isTest
      ? {
          max: 5,
          idleTimeoutMillis: 1000,
          allowExitOnIdle: true,
        }
      : {}),
  });
}

function getPool() {
  if (process.env.NODE_ENV === 'test') {
    if (isUsablePool(global.__luxridePgPool)) {
      return global.__luxridePgPool;
    }
    const testPool = createPool();
    global.__luxridePgPool = testPool;
    return testPool;
  }

  if (!getPool._prod || !isUsablePool(getPool._prod)) {
    getPool._prod = createPool();
  }
  return getPool._prod;
}

module.exports = getPool();
