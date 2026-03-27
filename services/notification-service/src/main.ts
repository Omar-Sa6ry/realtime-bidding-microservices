import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { I18nValidationException } from 'nestjs-i18n';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      stopAtFirstError: true,
      exceptionFactory: (errors) => {
        return new I18nValidationException(errors);
      },
    }),
  );

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'user',
      protoPath: join(process.cwd(), '../../proto/user.proto'),
      url: '0.0.0.0:50051',
      loader: {
        keepCase: true,
      },
    },
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.NATS,
    options: {
      servers: [process.env.NATS_URL || 'nats://nats-srv:4222'],
    },
  });

  await app.startAllMicroservices();

  await app.listen(process.env.PORT_NOTIFICATION || 3004);
}
bootstrap();
