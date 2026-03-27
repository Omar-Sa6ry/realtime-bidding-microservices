import { Injectable } from '@nestjs/common';
import { NotificationStrategy } from './interface/notification.strategy';
import { BidCreatedStrategy } from './bid-created.strategy';
import { OutbidStrategy } from './outbid.strategy';
import { AuctionEndedStrategy } from './auction-ended.strategy';
import { BidWonStrategy } from './bid-won.strategy';

@Injectable()
export class NotificationStrategyFactory {
  private strategies: Map<string, NotificationStrategy> = new Map();

  constructor(
    private readonly bidCreated: BidCreatedStrategy,
    private readonly outbid: OutbidStrategy,
    private readonly auctionEnded: AuctionEndedStrategy,
    private readonly bidWon: BidWonStrategy,
  ) {
    this.strategies.set('bid.created', this.bidCreated);
    this.strategies.set('bid.outbid', this.outbid);
    this.strategies.set('auction.ended', this.auctionEnded);
    this.strategies.set('bid.won', this.bidWon);
  }

  getStrategy(event: string): NotificationStrategy {
    const strategy = this.strategies.get(event);
    if (!strategy)
      throw new Error(`Notification strategy for event "${event}" not found.`);

    return strategy;
  }
}
