import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { AppResolver } from './app.resolver';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import {
  ApolloFederationDriver,
  ApolloFederationDriverConfig,
} from '@nestjs/apollo';
import { join } from 'path';
import { APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TranslationModule } from './common/translation/translation.module';
import { NotificationSubModule } from './modules/notification/notification.module';
import { MongooseModule } from '@nestjs/mongoose';
import { RedisModule } from '@bts-soft/cache';
import { HttpExceptionFilterN } from './common/filter/errorHandling.filter';
import { PubSubModule } from './modules/pubsub/pubsub.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI'),
      }),
    }),

    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      path: '/graphql',

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

      subscriptions: {
        'graphql-ws': {
          path: '/graphql',
          onConnect: (context: any) => {
            const { connectionParams, extra } = context;
            console.log(
              `[WS-New] Subscription connection attempt. Params: ${JSON.stringify(connectionParams)}`,
            );
            return {
              req: extra.request,
              language: connectionParams?.['accept-language'] || 'en',
            };
          },
        },
        'subscriptions-transport-ws': {
          path: '/graphql',
          onConnect: (connectionParams: any) => {
            console.log(
              `[WS-Old] Subscription connection attempt. Params: ${JSON.stringify(connectionParams)}`,
            );
            return {
              user: connectionParams?.user || {},
              language: connectionParams?.['accept-language'] || 'en',
            };
          },
        },
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

    TranslationModule,
    RedisModule,
    PubSubModule,
    NotificationSubModule,
  ],
  providers: [
    AppService,
    AppResolver,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilterN,
    },
  ],
})
export class AppModule {}
