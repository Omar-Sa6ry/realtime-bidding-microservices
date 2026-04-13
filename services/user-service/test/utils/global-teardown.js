'use strict';

module.exports = async function globalTeardown() {
  console.log('\n[Global Teardown] Closing NestJS Application');

  const app = global.__APP__;
  if (app) {
    try {
      await Promise.race([
        app.close(),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    } catch (e) {
      console.error('[Global Teardown] Error while closing app:', e.message);
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log('[Global Teardown] Stopping PostgreSQL Testcontainer');
  if (global.__PG_CONTAINER__) {
    try {
      await global.__PG_CONTAINER__.stop();
    } catch (_) {}
  }

  console.log('[Global Teardown] Stopping Redis Testcontainer');
  if (global.__REDIS_CONTAINER__) {
    try {
      await global.__REDIS_CONTAINER__.stop();
    } catch (_) {}
  }

  console.log('[Global Teardown] All done.\n');
};
