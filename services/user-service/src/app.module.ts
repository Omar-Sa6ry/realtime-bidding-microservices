import { join } from 'path';
import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { AppResolver } from './app.resolver';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/users/users.module';
import { DatabaseModule } from './modules/infra/database/database';
import { TranslationModule } from './modules/infra/translation/translation.module';
import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter, ThrottlerModule } from '@bts-soft/core';
import { ConfigModule } from '@nestjs/config';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule,
    TranslationModule,
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      path: '/user/graphql',

      autoSchemaFile: {
        path: join(process.cwd(), 'src/schema.gql'),
        federation: 2,
      },
      buildSchemaOptions: {
        orphanedTypes: [],
        directives: [
          {
            name: 'tag',
            locations: [
              'FIELD_DEFINITION',
              'OBJECT',
              'INTERFACE',
              'UNION',
              'ARGUMENT_DEFINITION',
              'SCALAR',
              'ENUM',
              'ENUM_VALUE',
              'INPUT_OBJECT',
              'INPUT_FIELD_DEFINITION',
            ],
            args: {
              name: { type: 'String!' },
            },
          } as any,
        ],
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

      formatError: (error) => {
        return {
          message: error.message,
          extensions: {
            ...error.extensions,
            stacktrace: undefined,
            locations: undefined,
            path: undefined,
          },
        };
      },
    }),
    DatabaseModule,
    TranslationModule,
    UserModule,
    AuthModule,
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
