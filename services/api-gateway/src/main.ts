import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  
  const port = process.env.PORT_GATEWAY || 3001;
  await app.listen(port);
  console.log(`API Gateway is running on: http://localhost:${port}/graphql`);
}
bootstrap();
