import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloGatewayDriver, ApolloGatewayDriverConfig } from '@nestjs/apollo';
import { IntrospectAndCompose } from '@apollo/gateway';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      server: {
        playground: true,
        introspection: true,
      },
      gateway: {
        supergraphSdl: new IntrospectAndCompose({
          subgraphs: [
            { name: 'user', url: 'http://user-srv:3000/user/graphql' },
          ],
        }),
      },
      formatError: (error: any) => {
        // If the subgraph already formatted it, return its extensions directly
        if (error.extensions?.response) {
            return error.extensions.response;
        }
        return {
          message: error.message,
          success: false,
          statusCode: error.extensions?.response?.statusCode || error.extensions?.statusCode || 500,
          error: error.extensions?.response?.error || error.extensions?.code || 'Gateway Error',
          timeStamp: new Date().toISOString(),
          path: error.path,
        };
      },
    } as ApolloGatewayDriverConfig),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
