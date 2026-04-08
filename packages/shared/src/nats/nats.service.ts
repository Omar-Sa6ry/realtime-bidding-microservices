import { Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class NatsService {
  private readonly logger = new Logger(NatsService.name);
  private client: ClientProxy;

  constructor(private readonly tokenName: string) {
  }

  setClient(client: ClientProxy) {
    this.client = client;
  }

  async send<TResponse = any>(pattern: string, data: any): Promise<TResponse> {
    try {
      return await firstValueFrom(this.client.send<TResponse>(pattern, data));
    } catch (error) {
      this.logger.error(`NATS send failed [${pattern}]`, error?.stack);
      throw error;
    }
  }

  emit(pattern: string, data: any): void {
    try {
      this.client.emit(pattern, data);
      this.logger.debug(`Event emitted: ${pattern}`);
    } catch (error) {
      this.logger.error(`NATS emit failed [${pattern}]`, error?.stack);
    }
  }
}
