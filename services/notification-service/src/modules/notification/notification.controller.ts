import { Controller, Inject } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationSubService } from './notification.service';
import { PUB_SUB } from '../pubsub/pubsub.module';
import { RedisPubSub } from 'graphql-redis-subscriptions';

@Controller()
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationSubService,
    @Inject(PUB_SUB) private readonly pubSub: RedisPubSub,
  ) {}

  @EventPattern('bid.created')
  async handleBidCreated(@Payload() data: any) {
    await this.notificationService.createBidNotification(data);

    this.pubSub.publish(`BID_UPDATED_${data.auctionId}`, {
      bidUpdated: {
        auctionId: data.auctionId,
        amount: data.amount,
        userId: data.userId,
      },
    });
  }

  @EventPattern('auction.create')
  async handleAuctionCreated(@Payload() data: any) {
    // Broadcast new auction to everyone
    this.pubSub.publish('AUCTION_CREATED', {
      auctionCreated: {
        id: data.id,
        title: data.title,
        startingPrice: data.startingPrice,
      },
    });
  }

  @EventPattern('bid.outbid')
  async handleBidOutbid(@Payload() data: Record<string, unknown>) {
    await this.notificationService.createOutbidNotification(data);
  }

  @EventPattern('bid.won')
  async handleBidWon(@Payload() data: Record<string, unknown>) {
    await this.notificationService.createBidWonNotification(data);
  }

  @EventPattern('auction.ended')
  async handleAuctionEnded(@Payload() data: Record<string, unknown>) {
    await this.notificationService.createAuctionEndedNotification(data);
  }

  @EventPattern('ai.message.chunk')
  async handleAiMessageChunk(@Payload() data: any) {
    this.pubSub.publish('AI_MESSAGE_CHUNK', {
      aiMessageChunk: data,
    });
  }
}
