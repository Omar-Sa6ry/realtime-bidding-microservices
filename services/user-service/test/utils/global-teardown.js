module.exports = async function globalTeardown() {
  console.log('\nCleaning up Testcontainers');

  console.log('Stopping PostgreSQL Testcontainer');
  if (global.__PG_CONTAINER__) {
    try {
      await global.__PG_CONTAINER__.stop();
    } catch (_) {}
  }

  console.log('Stopping Redis Testcontainer');
  if (global.__REDIS_CONTAINER__) {
    try {
      await global.__REDIS_CONTAINER__.stop();
    } catch (_) {}
  }

  console.log('All done.\n');
};
