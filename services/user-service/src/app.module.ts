import { join } from 'path';
import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { AppResolver } from './app.resolver';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/users/users.module';
import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter, ThrottlerModule } from '@bts-soft/core';
import { ConfigModule } from '@nestjs/config';
import {
  ApolloFederationDriver,
  ApolloFederationDriverConfig,
} from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { DatabaseModule } from './common/database/database';
import { TranslationModule } from './common/translation/translation.module';
import { PaymentModule } from './modules/payment/payment.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule,
    TranslationModule,
    DatabaseModule,

    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      path: '/user/graphql',

      autoSchemaFile: {
        path: join(process.cwd(), 'src/schema.gql'),
        federation: 2,
      },

      context: ({ req }) => ({
        req,
        user: req.user,
        language: req.headers['accept-language'] || 'en',
      }),

      playground: true,
      debug: false,
      csrfPrevention: false,

      installSubscriptionHandlers: true,
      subscriptions: {
        'subscriptions-transport-ws': {
          path: '/graphql',
          keepAlive: 10000,
        },
        'graphql-ws': true,
      },

      formatError: (error: any) => {
        const originalError = error.extensions?.originalError as any;
        const msg = originalError?.message || error.message;
        const code =
          error.extensions?.statusCode || originalError?.statusCode || 400;

        return {
          success: false,
          statusCode: code,
          message: Array.isArray(msg) ? msg[0] : msg,
          timeStamp: new Date().toISOString(),
        } as any;
      },
    }),

    UserModule,
    AuthModule,
    PaymentModule,
  ],
  providers: [
    AppService,
    AppResolver,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
