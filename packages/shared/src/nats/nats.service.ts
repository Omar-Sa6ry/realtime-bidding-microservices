import { Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class NatsService {
  private readonly logger = new Logger(NatsService.name);
  private client: ClientProxy;

  constructor(private readonly tokenName: string) {
    // Client will be set by the module via setClient()
  }

  setClient(client: ClientProxy) {
    this.client = client;
  }

  /**
   * Send a request and wait for a response (request-reply).
   */
  async send<TResponse = any>(pattern: string, data: any): Promise<TResponse> {
    try {
      return await firstValueFrom(this.client.send<TResponse>(pattern, data));
    } catch (error) {
      this.logger.error(`NATS send failed [${pattern}]`, error?.stack);
      throw error;
    }
  }

  /**
   * Fire-and-forget event emit (pub/sub).
   */
  emit(pattern: string, data: any): void {
    try {
      this.client.emit(pattern, data);
      this.logger.debug(`Event emitted: ${pattern}`);
    } catch (error) {
      this.logger.error(`NATS emit failed [${pattern}]`, error?.stack);
    }
  }
}

