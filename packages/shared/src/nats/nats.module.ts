import { DynamicModule, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NatsService } from './nats.service';

export interface NatsModuleOptions {
  /** Injection token to use with @Inject() - e.g. 'USER_NATS_SERVICE' */
  name: string;
  /** NATS queue group for this service - enables load balancing */
  queue: string;
}

@Module({})
export class NatsClientModule {
  static register(options: NatsModuleOptions): DynamicModule {
    return {
      module: NatsClientModule,
      imports: [
        ClientsModule.register([
          {
            name: options.name,
            transport: Transport.NATS,
            options: {
              servers: [process.env.NATS_URL || 'nats://localhost:4222'],
              queue: options.queue,
            },
          },
        ]),
      ],
      providers: [
        {
          provide: NatsService,
          useFactory: (client: any) => {
            const service = new NatsService(options.name);
            service.setClient(client);
            return service;
          },
          inject: [options.name],
        },
      ],
      exports: [NatsService, ClientsModule],
    };
  }
}

