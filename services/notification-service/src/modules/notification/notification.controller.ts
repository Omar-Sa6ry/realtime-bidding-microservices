import { Controller, Inject } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { NotificationSubService } from './notification.service';

@Controller()
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationSubService,
    @Inject('PUB_SUB') private readonly pubSub: RedisPubSub,
  ) {}

  @EventPattern('bid.created')
  async handleBidCreated(@Payload() data: any) {
    console.log('[NATS] handleBidCreated received:', data);
    await this.notificationService.createBidNotification(data);
  }

  @EventPattern('bid.outbid')
  async handleBidOutbid(@Payload() data: any) {
    console.log('[NATS] handleBidOutbid received:', data);
    await this.notificationService.createOutbidNotification(data);
  }

  @EventPattern('auction.ended')
  async handleAuctionEnded(@Payload() data: any) {
    console.log('[NATS] handleAuctionEnded received:', data);
    await this.notificationService.createAuctionEndedNotification(data);
  }

  @EventPattern('bid.won')
  async handleBidWon(@Payload() data: any) {
    console.log('[NATS] handleBidWon received:', data);
    await this.notificationService.createBidWonNotification(data);
  }

  @EventPattern('ai.message.chunk')
  async handleAiMessageChunk(@Payload() data: any) {
    console.log('[NATS] handleAiMessageChunk received:', data);
    this.pubSub.publish('AI_MESSAGE_CHUNK', {
      aiMessageChunk: {
        chunk: data.chunk,
        isFinal: data.isFinal,
        threadId: data.threadId,
        userId: data.userId,
      },
    });
    console.log('[NATS] AI_MESSAGE_CHUNK published to PubSub');
  }
}
