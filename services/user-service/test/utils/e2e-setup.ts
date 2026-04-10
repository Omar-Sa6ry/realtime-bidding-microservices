import { initializeTransactionalContext } from 'typeorm-transactional';

process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRE = '1h';
process.env.REFRESH_TOKEN_SECRET = 'test-secret-refresh';
process.env.NODE_ENV = 'test';
process.env.JWT_EXPIRES_IN = '3600';
process.env.REDIS_MAX_RETRIES = '0';

try {
  initializeTransactionalContext();
} catch (e) {
  // Already initialized
}

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { AppModule } from '../../src/app.module';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { StripeService } from '../../src/modules/payment/stripe.service';
import { RedisService } from '@bts-soft/core';

let postgresContainer: StartedPostgreSqlContainer;
let redisContainer: StartedTestContainer;
let app: INestApplication;

// Increase Jest global timeout
jest.setTimeout(300000);

beforeAll(async () => {
  console.log('\nStarting PostgreSQL Testcontainer...');
  postgresContainer = await new PostgreSqlContainer('postgres:15-alpine')
    .withDatabase('smart_cv_test')
    .withUsername('testuser')
    .withPassword('testpassword')
    .start();

  console.log('Starting Redis Testcontainer...');
  redisContainer = await new GenericContainer('redis:alpine')
    .withExposedPorts(6379)
    .start();

  const pgHost = postgresContainer.getHost() === 'localhost' ? '127.0.0.1' : postgresContainer.getHost();
  process.env.DB_HOST = pgHost;
  process.env.DB_PORT = postgresContainer.getPort().toString();
  process.env.DB_NAME = postgresContainer.getDatabase();
  process.env.DB_USERNAME = postgresContainer.getUsername();
  process.env.POSTGRES_PASSWORD = postgresContainer.getPassword();

  const redisHost = redisContainer.getHost() === 'localhost' ? '127.0.0.1' : redisContainer.getHost();
  process.env.REDIS_HOST = redisHost;
  process.env.REDIS_PORT = redisContainer.getMappedPort(6379).toString();
  process.env.REDIS_URL = `redis://${redisHost}:${process.env.REDIS_PORT}`;

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(StripeService)
    .useValue({
      createSession: jest.fn().mockResolvedValue('https://checkout.stripe.com/test_session_url'),
      verifyWebhook: jest.fn(),
    })
    .compile();

  app = moduleFixture.createNestApplication();
  await app.init();

  (global as any).__APP__ = app;
  console.log('App successfully initialized with Testcontainers and Mocks.');
});

afterAll(async () => {
  console.log('\nStopping Nest Application...');
  if (app) {
    try {
      const redisService = app.get(RedisService, { strict: false });
      if (redisService) {
        if (typeof (redisService as any).disconnect === 'function') {
          await (redisService as any).disconnect();
        } else if (typeof (redisService as any).quit === 'function') {
          await (redisService as any).quit();
        }
      }
    } catch (e) {
      // RedisService not available or already closed
    }
    await app.close();
  }

  // Small delay to allow background connections to settle
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('Stopping PostgreSQL Testcontainer...');
  if (postgresContainer) await postgresContainer.stop();

  console.log('Stopping Redis Testcontainer...');
  if (redisContainer) await redisContainer.stop();
  
  delete (global as any).__APP__;
});

export const getApp = (): INestApplication => {
  return (global as any).__APP__;
};
