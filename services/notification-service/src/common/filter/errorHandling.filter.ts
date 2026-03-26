import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';

@Catch()
export class HttpExceptionFilter implements GqlExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    console.log(exception);

    return new GraphQLError(exception.message, {
      extensions: {
        ...exception.extensions,
        success: false,
        statusCode: exception.extensions?.statusCode || 500,
        timeStamp: new Date().toISOString().split('T')[0],
        code: exception.extensions?.code || 'INTERNAL_SERVER_ERROR',
        stacktrace: undefined,
        error: undefined,
        locations: undefined,
        path: undefined,
      },
    });
  }
}
