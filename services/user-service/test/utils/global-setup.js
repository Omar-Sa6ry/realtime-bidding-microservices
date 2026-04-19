'use strict';

const { PostgreSqlContainer } = require('@testcontainers/postgresql');
const { GenericContainer, Wait } = require('testcontainers');

module.exports = async function globalSetup() {
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRE = '1h';
  process.env.REFRESH_TOKEN_SECRET = 'test-secret-refresh';
  process.env.NODE_ENV = 'test';
  process.env.JWT_EXPIRES_IN = '3600';
  process.env.REDIS_MAX_RETRIES = '0';

  console.log('\nStarting PostgreSQL Testcontainer');
  const postgresContainer = await new PostgreSqlContainer('postgres:15-alpine')
    .withDatabase('smart_cv_test')
    .withUsername('testuser')
    .withPassword('testpassword')
    .withWaitStrategy(Wait.forListeningPorts().withStartupTimeout(300000))
    .start();

  console.log('Starting Redis Testcontainer...');
  const redisContainer = await new GenericContainer('redis:alpine')
    .withExposedPorts(6379)
    .start();

  const pgHost =
    postgresContainer.getHost() === 'localhost'
      ? '127.0.0.1'
      : postgresContainer.getHost();

  const redisHost =
    redisContainer.getHost() === 'localhost'
      ? '127.0.0.1'
      : redisContainer.getHost();

  const redisPort = redisContainer.getMappedPort(6379);

  process.env.DB_HOST = pgHost;
  process.env.DB_PORT = postgresContainer.getPort().toString();
  process.env.DB_NAME = postgresContainer.getDatabase();
  process.env.DB_USERNAME = postgresContainer.getUsername();
  process.env.POSTGRES_PASSWORD = postgresContainer.getPassword();
  process.env.REDIS_HOST = redisHost;
  process.env.REDIS_PORT = redisPort.toString();
  process.env.REDIS_URL = `redis://${redisHost}:${redisPort}`;

  global.__PG_CONTAINER__ = postgresContainer;
  global.__REDIS_CONTAINER__ = redisContainer;

  console.log('Containers started. Ready for tests.\n');
};
