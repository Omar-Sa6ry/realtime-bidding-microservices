import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloGatewayDriver, ApolloGatewayDriverConfig } from '@nestjs/apollo';
import { IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      context: ({ req }: any) => {
        return { req };
      },
      server: {
        playground: true,
        introspection: true,

        formatError: (error: any) => {
          const subgraphError = error.extensions?.response?.body?.errors?.[0];

          if (subgraphError) {
            return {
              success: false,
              statusCode: subgraphError.statusCode || 400,
              message: subgraphError.message,
              timeStamp: subgraphError.timeStamp || new Date().toISOString(),
            } as any;
          }

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
      },

      gateway: {
        supergraphSdl: new IntrospectAndCompose({
          subgraphs: [
            { name: 'user', url: 'http://user-srv:3000/user/graphql' },
          ],
        }),

        buildService: ({ url }) => {
          return new RemoteGraphQLDataSource({
            url,
            willSendRequest({ request, context }: any) {
              if (context.req?.headers?.authorization) {
                request.http.headers.set(
                  'authorization',
                  context.req.headers.authorization,
                );
              }
            },
          });
        },
      },
    } as ApolloGatewayDriverConfig),
  ],
  providers: [],
})
export class AppModule {}
