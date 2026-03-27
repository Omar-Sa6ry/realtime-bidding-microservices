import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationSubService } from './notification.service';

@Controller()
export class NotificationController {
  constructor(private readonly notificationService: NotificationSubService) {}

  @EventPattern('bid.created')
  async handleBidCreated(@Payload() data: Record<string, unknown>) {
    await this.notificationService.createBidNotification(data);
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
}
