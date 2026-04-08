import { Test, TestingModule } from '@nestjs/testing';
import { GrpcExceptionFilter } from './grpc-exception.filter';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';

describe('GrpcExceptionFilter', () => {
  let filter: GrpcExceptionFilter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GrpcExceptionFilter],
    }).compile();

    filter = module.get<GrpcExceptionFilter>(GrpcExceptionFilter);
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  describe('catch', () => {
    it('should return RpcException error if exception is instance of RpcException', (done) => {
      const rpcError = { code: status.NOT_FOUND, message: 'Not Found' };
      const exception = new RpcException(rpcError);
      const host = {} as any;

      filter.catch(exception, host).subscribe({
        error: (err) => {
          expect(err).toEqual(rpcError);
          done();
        },
      });
    });

    it('should map 400 to INVALID_ARGUMENT', (done) => {
      const exception = { status: 400, message: 'Invalid input' };
      const host = {} as any;

      filter.catch(exception, host).subscribe({
        error: (err) => {
          expect(err.code).toBe(status.INVALID_ARGUMENT);
          expect(err.message).toBe('Invalid input');
          done();
        },
      });
    });

    it('should map 401 to UNAUTHENTICATED', (done) => {
      const exception = { statusCode: 401, message: 'Unauthorized' };
      const host = {} as any;

      filter.catch(exception, host).subscribe({
        error: (err) => {
          expect(err.code).toBe(status.UNAUTHENTICATED);
          expect(err.message).toBe('Unauthorized');
          done();
        },
      });
    });

    it('should map 403 to PERMISSION_DENIED', (done) => {
      const exception = { status: 403, message: 'Forbidden' };
      const host = {} as any;

      filter.catch(exception, host).subscribe({
        error: (err) => {
          expect(err.code).toBe(status.PERMISSION_DENIED);
          expect(err.message).toBe('Forbidden');
          done();
        },
      });
    });

    it('should map 404 to NOT_FOUND', (done) => {
      const exception = { status: 404, message: 'Not Found' };
      const host = {} as any;

      filter.catch(exception, host).subscribe({
        error: (err) => {
          expect(err.code).toBe(status.NOT_FOUND);
          expect(err.message).toBe('Not Found');
          done();
        },
      });
    });

    it('should map 409 to ALREADY_EXISTS', (done) => {
      const exception = { status: 409, message: 'Conflict' };
      const host = {} as any;

      filter.catch(exception, host).subscribe({
        error: (err) => {
          expect(err.code).toBe(status.ALREADY_EXISTS);
          expect(err.message).toBe('Conflict');
          done();
        },
      });
    });

    it('should map 429 to RESOURCE_EXHAUSTED', (done) => {
      const exception = { status: 429, message: 'Too many requests' };
      const host = {} as any;

      filter.catch(exception, host).subscribe({
        error: (err) => {
          expect(err.code).toBe(status.RESOURCE_EXHAUSTED);
          expect(err.message).toBe('Too many requests');
          done();
        },
      });
    });

    it('should map unknown status to INTERNAL', (done) => {
      const exception = { status: 500, message: 'Server error' };
      const host = {} as any;

      filter.catch(exception, host).subscribe({
        error: (err) => {
          expect(err.code).toBe(status.INTERNAL);
          expect(err.message).toBe('Server error');
          done();
        },
      });
    });

    it('should use default message if none provided', (done) => {
      const exception = { status: 500 };
      const host = {} as any;

      filter.catch(exception, host).subscribe({
        error: (err) => {
          expect(err.code).toBe(status.INTERNAL);
          expect(err.message).toBe('Internal server error');
          done();
        },
      });
    });

    it('should log the error', (done) => {
      const exception = { status: 404, message: 'Not Found' };
      const host = {} as any;
      const loggerSpy = jest.spyOn(filter['logger'], 'error').mockImplementation();

      filter.catch(exception, host).subscribe({
        error: () => {
          expect(loggerSpy).toHaveBeenCalledWith(`[gRPC Error] ${status.NOT_FOUND}: Not Found`);
          loggerSpy.mockRestore();
          done();
        },
      });
    });
  });
});
