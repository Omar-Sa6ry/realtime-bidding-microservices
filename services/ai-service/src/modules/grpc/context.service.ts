import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as microservices from '@nestjs/microservices';
import { RedisService } from '@bts-soft/core';
import { firstValueFrom } from 'rxjs';
import {
  AuctionService,
  BiddingService,
  UserService,
} from './interfaces/grpc-services.interface';

@Injectable()
export class ContextService implements OnModuleInit {
  private readonly logger = new Logger(ContextService.name);
  private userService: UserService;
  private auctionService: AuctionService;
  private biddingService: BiddingService;

  constructor(
    @Inject('GRPC_USER_SERVICE')
    private readonly userClient: microservices.ClientGrpc,
    @Inject('GRPC_AUCTION_SERVICE')
    private readonly auctionClient: microservices.ClientGrpc,
    @Inject('GRPC_BIDDING_SERVICE')
    private readonly biddingClient: microservices.ClientGrpc,
    private readonly redisService: RedisService,
  ) {}

  onModuleInit() {
    this.userService = this.userClient.getService<UserService>('UserService');

    this.auctionService =
      this.auctionClient.getService<AuctionService>('AuctionService');

    this.biddingService =
      this.biddingClient.getService<BiddingService>('BiddingService');
  }

  async getAiContext(auctionId: string, userId: string) {
    const cacheKey = `ai_context:auction:${auctionId}`;

    let auction: any = null;
    const cachedAuction = await this.redisService.get(cacheKey);

    if (cachedAuction) {
      this.logger.debug(`Cache hit for auction ${auctionId}`);
      auction =
        typeof cachedAuction === 'string'
          ? JSON.parse(cachedAuction)
          : cachedAuction;
    }

    const [auctionData, bidsData, userData] = await Promise.allSettled([
      auction
        ? Promise.resolve(auction)
        : firstValueFrom(
            this.auctionService.getAuction({ auction_id: auctionId }),
          ),
      firstValueFrom(
        this.biddingService.getUserBids({
          auction_id: auctionId,
          user_id: userId,
        }),
      ),
      firstValueFrom(this.userService.getUser({ id: userId })),
    ]);

    const finalAuction =
      auctionData.status === 'fulfilled' ? auctionData.value : null;

    if (!auction && finalAuction)
      this.redisService.set(cacheKey, JSON.stringify(finalAuction), 60); // Cache for 60s

    return {
      auction: finalAuction,
      userBids:
        bidsData.status === 'fulfilled' ? bidsData.value.bids || [] : [],
      user: userData.status === 'fulfilled' ? userData.value.user : null,
    };
  }
}
