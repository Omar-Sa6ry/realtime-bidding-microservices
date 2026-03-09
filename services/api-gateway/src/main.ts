import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function waitForService(url: string, retries = 60, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ __typename }' }),
      });
      if (res.ok) {
        console.log(`Service at ${url} is ready`);
        return;
      }
    } catch {
      // service not ready yet
    }
    console.log(
      `Waiting for ${url} (attempt ${i + 1}/${retries})...`,
    );
    await new Promise((r) => setTimeout(r, delay));
  }
  console.warn(`Service at ${url} not available after ${retries} attempts, starting anyway...`);
}

async function bootstrap() {
  // Wait for subgraph services to be available
  await waitForService('http://user-srv:3000/user/graphql');

  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const port = process.env.PORT_GATEWAY || 3001;
  await app.listen(port);
  console.log(`API Gateway is running on: http://localhost:${port}/graphql`);
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed, retrying in 10s...', err.message);
  setTimeout(() => bootstrap(), 10000);
});

