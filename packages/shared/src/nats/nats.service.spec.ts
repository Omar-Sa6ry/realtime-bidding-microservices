import { Test, TestingModule } from '@nestjs/testing';
import { NatsService } from './nats.service';
import { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';

describe('NatsService', () => {
  let service: NatsService;
  let clientMock: jest.Mocked<ClientProxy>;

  beforeEach(async () => {
    clientMock = {
      send: jest.fn(),
      emit: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: NatsService,
          useValue: new NatsService('TEST_TOKEN'),
        },
      ],
    }).compile();

    service = module.get<NatsService>(NatsService);
    service.setClient(clientMock);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should set client', () => {
    const newClient = {} as ClientProxy;
    service.setClient(newClient);
    expect(service['client']).toBe(newClient);
  });

  describe('send', () => {
    it('should send data and return response on success', async () => {
      const pattern = 'test.pattern';
      const data = { foo: 'bar' };
      const expectedResponse = { result: 'success' };

      clientMock.send.mockReturnValue(of(expectedResponse));

      const response = await service.send(pattern, data);

      expect(clientMock.send).toHaveBeenCalledWith(pattern, data);
      expect(response).toEqual(expectedResponse);
    });

    it('should throw error and log it on failure', async () => {
      const pattern = 'test.pattern';
      const data = { foo: 'bar' };
      const error = new Error('NATS error');
      error.stack = 'test-stack';
      
      clientMock.send.mockReturnValue(throwError(() => error));
      const loggerSpy = jest.spyOn(service['logger'], 'error').mockImplementation();

      await expect(service.send(pattern, data)).rejects.toThrow(error);
      expect(loggerSpy).toHaveBeenCalledWith(
        `NATS send failed [${pattern}]`,
        error.stack,
      );
      
      loggerSpy.mockRestore();
    });

    it('should log error even if error has no stack', async () => {
        const pattern = 'test.pattern';
        const data = { foo: 'bar' };
        const error = { message: 'Some error' };
        
        clientMock.send.mockReturnValue(throwError(() => error));
        const loggerSpy = jest.spyOn(service['logger'], 'error').mockImplementation();
  
        await expect(service.send(pattern, data)).rejects.toEqual(error);
        expect(loggerSpy).toHaveBeenCalledWith(
          `NATS send failed [${pattern}]`,
          undefined,
        );
        
        loggerSpy.mockRestore();
      });
  });

  describe('emit', () => {
    it('should emit data and log success', () => {
      const pattern = 'test.event';
      const data = { event: 'data' };
      const loggerSpy = jest.spyOn(service['logger'], 'debug').mockImplementation();

      service.emit(pattern, data);

      expect(clientMock.emit).toHaveBeenCalledWith(pattern, data);
      expect(loggerSpy).toHaveBeenCalledWith(`Event emitted: ${pattern}`);
      
      loggerSpy.mockRestore();
    });

    it('should log error on failure but not throw', () => {
      const pattern = 'test.event';
      const data = { event: 'data' };
      const error = new Error('NATS emit error');
      error.stack = 'emit-stack';
      
      clientMock.emit.mockImplementation(() => {
        throw error;
      });
      const loggerSpy = jest.spyOn(service['logger'], 'error').mockImplementation();

      expect(() => service.emit(pattern, data)).not.toThrow();
      expect(loggerSpy).toHaveBeenCalledWith(
        `NATS emit failed [${pattern}]`,
        error.stack,
      );
      
      loggerSpy.mockRestore();
    });

    it('should log error even if error has no stack on emit', () => {
        const pattern = 'test.event';
        const data = { event: 'data' };
        const error = { message: 'Some emit error' };
        
        clientMock.emit.mockImplementation(() => {
          throw error;
        });
        const loggerSpy = jest.spyOn(service['logger'], 'error').mockImplementation();
  
        expect(() => service.emit(pattern, data)).not.toThrow();
        expect(loggerSpy).toHaveBeenCalledWith(
          `NATS emit failed [${pattern}]`,
          undefined,
        );
        
        loggerSpy.mockRestore();
      });
  });
});
