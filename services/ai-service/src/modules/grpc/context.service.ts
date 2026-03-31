import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as microservices from '@nestjs/microservices';
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
    @Inject('GRPC_USER_SERVICE') private readonly userClient: microservices.ClientGrpc,
    @Inject('GRPC_AUCTION_SERVICE') private readonly auctionClient: microservices.ClientGrpc,
    @Inject('GRPC_BIDDING_SERVICE') private readonly biddingClient: microservices.ClientGrpc,
  ) {}

  onModuleInit() {
    this.userService = this.userClient.getService<UserService>('UserService');

    this.auctionService =
      this.auctionClient.getService<AuctionService>('AuctionService');
      
    this.biddingService =
      this.biddingClient.getService<BiddingService>('BiddingService');
  }

  async getAiContext(auctionId: string, userId: string) {
    this.logger.log(`Fetching AI context for Auction: ${auctionId}, User: ${userId}`);

    const [auctionData, bidsData, userData] = await Promise.allSettled([
      firstValueFrom(this.auctionService.getAuction({ auction_id: auctionId })),
      firstValueFrom(this.biddingService.getUserBids({ auction_id: auctionId, user_id: userId })),
      firstValueFrom(this.userService.getUser({ id: userId })),
    ]);

    return {
      auction: auctionData.status === 'fulfilled' ? auctionData.value : null,
      userBids: bidsData.status === 'fulfilled' ? bidsData.value.bids : [],
      user: userData.status === 'fulfilled' ? userData.value.user : null,
    };
  }
}
