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

  console.log('\nBootstrapping NestJS Application');

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
  console.log('App ready, Shared across all suites.\n');
}


jest.setTimeout(300000);

beforeAll(async () => {
  await initApp();
});


afterAll(async () => {
  const app = (global as any).__APP__;
  if (app) {
    await app.close();
  }
});

export const getApp = (): INestApplication => {
  return (global as any).__APP__;
};
