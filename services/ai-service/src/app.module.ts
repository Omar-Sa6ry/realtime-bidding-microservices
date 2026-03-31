import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import {
  ApolloFederationDriver,
  ApolloFederationDriverConfig,
} from '@nestjs/apollo';
import { MongooseModule } from '@nestjs/mongoose';
import { join } from 'path';
import { AppService } from './app.service';
import { AppResolver } from './app.resolver';
import { APP_FILTER } from '@nestjs/core';
import {
  HttpExceptionFilter,
  ThrottlerModule,
  TranslationModule,
} from '@bts-soft/core';
import { ChatThread, ChatThreadSchema } from './schemas/chat-thread.schema';
import { ChatMessage, ChatMessageSchema } from './schemas/chat-message.schema';
import { PubSubModule } from './common/pubsub/pubsub.module';
import { GrpcClientsModule } from './modules/grpc/grpc-clients.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    MongooseModule.forRootAsync({
      inject: [ConfigService],

      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI'),
      }),
    }),

    MongooseModule.forFeature([
      { name: ChatThread.name, schema: ChatThreadSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
    ]),

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

    ThrottlerModule,
    PubSubModule,
    GrpcClientsModule,
    TranslationModule,
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
