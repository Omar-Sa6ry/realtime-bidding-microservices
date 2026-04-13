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

      context: (args: any) => {
        const req = args.req || args.extra?.request;
        const connection = args.connection;
        const extra = args.extra;

        if (connection) {
          return connection.context;
        }

        if (extra) {
          return extra; 
        }

        // Fallback token parsing if middleware missed it
        let user = req?.user;
        if (!user && req?.headers?.authorization) {
          const authHeader = req.headers.authorization;
          if (authHeader.startsWith('Bearer ')) {
            try {
              const token = authHeader.split(' ')[1];
              user = JSON.parse(
                Buffer.from(token.split('.')[1], 'base64').toString('utf8'),
              );
              console.log('[AppContext] Parsed user from header:', user?.id);
            } catch (e) {}
          }
        }

        return {
          req,
          user,
          language: req?.headers?.['accept-language'] || 'en',
        };
      },

      playground: true,
      debug: false,
      csrfPrevention: false,

      subscriptions: {
        'graphql-ws': {
          path: '/graphql',
          onConnect: (ctx: any) => {
            const { connectionParams, extra } = ctx;

            let user: any = {};
            const authHeader = connectionParams?.authorization || connectionParams?.Authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
              try {
                const token = authHeader.split(' ')[1];
                user = JSON.parse(
                  Buffer.from(token.split('.')[1], 'base64').toString('utf8'),
                );
              } catch (e) {
                console.error('[WS] Token parse error:', e.message);
              }
            }

            console.log(`[WS-New] Connection. User ID: ${user?.id}`);
            
            // For graphql-ws, we attach user to extra so it's available in context factory
            extra.user = user;
            extra.language = connectionParams?.['accept-language'] || 'en';
            
            return {
              user,
              language: extra.language,
            };
          },
        },
        'subscriptions-transport-ws': {
          path: '/graphql',
          onConnect: (connectionParams: any) => {
            let user = connectionParams?.user || {};
            const authHeader = connectionParams?.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
              try {
                const token = authHeader.split(' ')[1];
                user = JSON.parse(
                  Buffer.from(token.split('.')[1], 'base64').toString('utf8'),
                );
              } catch (e) {}
            }

            console.log(
              `[WS-Old] Subscription connection attempt. Params: ${JSON.stringify(connectionParams)}`,
            );
            return {
              user,
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
