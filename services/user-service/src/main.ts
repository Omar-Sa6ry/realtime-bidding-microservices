import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { initializeTransactionalContext } from 'typeorm-transactional';
import { setupInterceptors } from '@bts-soft/core';
import { I18nValidationException } from 'nestjs-i18n';
import { DataSource } from 'typeorm';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { graphqlUploadExpress } from 'graphql-upload-minimal';

async function bootstrap() {
  try {
    initializeTransactionalContext();

    const app = await NestFactory.create(AppModule);
    app.enableCors();

    app.use(graphqlUploadExpress({ maxFileSize: 100_000_000, maxFiles: 5 })); // 100 MB max
    setupInterceptors(app as any);

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

    // app.use('/google/callback', bodyParser.raw({ type: 'application/json' }));
    // app.use(json());

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
    await app.listen(process.env.PORT_USER ?? 3000, '0.0.0.0');
  } catch (error) {
    console.error(error);
    throw new BadRequestException(error);
  }
}

bootstrap();
