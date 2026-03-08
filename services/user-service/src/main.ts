import { join } from 'path';
import { json } from 'express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { initializeTransactionalContext } from 'typeorm-transactional';
import { setupInterceptors } from '@bts-soft/core';
import { setupGraphqlUpload } from '@bts-soft/upload';
import { I18nValidationException } from 'nestjs-i18n';
import { DataSource } from 'typeorm';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  try {
    initializeTransactionalContext();

    const app = await NestFactory.create(AppModule);
    app.enableCors();

    setupGraphqlUpload(app as any, 1_000_000, 1);
    setupInterceptors(app as any);

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        stopAtFirstError: true,
        exceptionFactory: (errors) => new I18nValidationException(errors),
      }),
    );

    // app.use('/google/callback', bodyParser.raw({ type: 'application/json' }));
    app.use(json());

    const dataSource = app.get(DataSource);
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.NATS,
      options: {
        servers: [process.env.NATS_URL || 'nats://localhost:4222'],
        queue: 'user-service',
      },
    });

    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.GRPC,
      options: {
        package: 'user',
        protoPath: join(process.cwd(), '../../proto/user.proto'),
        url: '0.0.0.0:50051',
      },
    });

    await app.startAllMicroservices();
    await app.listen(process.env.PORT_USER ?? 3000);
  } catch (error) {
    console.error(error);
    throw new BadRequestException(error);
  }
}

bootstrap();
