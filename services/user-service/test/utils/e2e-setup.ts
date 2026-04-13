import { initializeTransactionalContext } from 'typeorm-transactional';

try {
  initializeTransactionalContext();
} catch {}

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { StripeService } from '../../src/modules/payment/stripe.service';

let initialized = false;

async function initApp(): Promise<void> {
  if (initialized) return;
  initialized = true;

  console.log('\n[E2E Setup] Bootstrapping NestJS Application (singleton)...');

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(StripeService)
    .useValue({
      createSession: jest
        .fn()
        .mockResolvedValue('https://checkout.stripe.com/test_session_url'),
      verifyWebhook: jest.fn(),
    })
    .compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  (global as any).__APP__ = app;
  console.log('[E2E Setup] ✅ App ready.  Shared across all suites.\n');
}

// ── Jest hooks ─────────────────────────────────────────────────────────────
// 5 min per individual test (container ops can be slow)
jest.setTimeout(300000);

beforeAll(async () => {
  // Containers are already running (started by globalSetup).
  // Just ensure the NestJS app is booted.
  await initApp();
});

// No afterAll here — the app and containers are torn down by globalTeardown.js
// which runs once after ALL suites complete.

// ── Helper exported for spec files ─────────────────────────────────────────
export const getApp = (): INestApplication => {
  return (global as any).__APP__;
};
