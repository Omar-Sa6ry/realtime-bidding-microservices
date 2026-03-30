import { Catch, RpcExceptionFilter, ArgumentsHost, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';
import { status } from '@grpc/grpc-js';

@Catch()
export class GrpcExceptionFilter implements RpcExceptionFilter<any> {
  private readonly logger = new Logger(GrpcExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost): Observable<any> {
    const errorResponse = {
      code: status.INTERNAL,
      message: 'Internal server error',
    };

    if (exception instanceof RpcException) {
      return throwError(() => exception.getError());
    }

    const status_code = exception.status || exception.statusCode || 500;
    const message = exception.message || 'Internal server error';

    switch (status_code) {
      case 400:
        errorResponse.code = status.INVALID_ARGUMENT;
        break;
      case 401:
        errorResponse.code = status.UNAUTHENTICATED;
        break;
      case 403:
        errorResponse.code = status.PERMISSION_DENIED;
        break;
      case 404:
        errorResponse.code = status.NOT_FOUND;
        break;
      case 409:
        errorResponse.code = status.ALREADY_EXISTS;
        break;
      case 429:
        errorResponse.code = status.RESOURCE_EXHAUSTED;
        break;
      default:
        errorResponse.code = status.INTERNAL;
    }

    errorResponse.message = message;

    this.logger.error(`[gRPC Error] ${errorResponse.code}: ${message}`);

    return throwError(() => ({
      code: errorResponse.code,
      message: errorResponse.message,
    }));
  }
}
