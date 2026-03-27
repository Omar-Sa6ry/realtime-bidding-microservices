import { Injectable, Inject, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { I18nService } from 'nestjs-i18n';

interface AuctionGrpcService {
  getAuction(data: { auction_id: string }): import('rxjs').Observable<any>;
}

@Injectable()
export class AuctionService implements OnModuleInit {
  private auctionGrpcService: AuctionGrpcService;

  constructor(
    private readonly i18n: I18nService,
    @Inject('GRPC_AUCTION_SERVICE') private client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.auctionGrpcService = this.client.getService<AuctionGrpcService>('AuctionService');
  }

  async findById(auctionId: string) {
    try {
      const response = await lastValueFrom(
        this.auctionGrpcService.getAuction({ auction_id: auctionId }),
      );

      if (!response || !response.exists) {
        throw new NotFoundException(this.i18n.t('notification.AUCTION_NOT_FOUND'));
      }

      return response;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new NotFoundException(this.i18n.t('notification.AUCTION_NOT_FOUND'));
    }
  }
}
