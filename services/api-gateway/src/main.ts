import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function waitForService(url: string, retries = 120, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ __typename }' }),
      });
      if (res.ok) {
        const body = await res.json();
        if (body?.data?.__typename) {
          console.log(`Service at ${url} is ready.`);
          return;
        }
      }
    } catch (err) {
      // console.log(`Waiting for ${url}...`);
    }
    await new Promise((r) => setTimeout(r, delay));
  }
  console.warn(
    `Service at ${url} not available after ${retries} attempts, starting anyway...`,
  );
}

async function bootstrap() {
  // Wait for subgraph services to be available
  await Promise.all([
    waitForService('http://user-srv:3000/user/graphql'),
    waitForService('http://auction-srv:3002/graphql'),
    waitForService('http://bidding-srv:3003/graphql'),
    waitForService('http://notification-srv:3004/graphql'),
  ]);

  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const port = process.env.PORT_GATEWAY || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`API Gateway is running on: https://bidding.test/graphql or http://localhost:${port}/graphql`);
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed, retrying in 10s...', err.message);
  setTimeout(() => bootstrap(), 10000);
});
