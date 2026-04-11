import { Test, TestingModule } from '@nestjs/testing';
import { NotificationStrategyFactory } from './notification-strategy.factory';
import { BidCreatedStrategy } from './bid-created.strategy';
import { OutbidStrategy } from './outbid.strategy';
import { AuctionEndedStrategy } from './auction-ended.strategy';
import { BidWonStrategy } from './bid-won.strategy';

describe('NotificationStrategyFactory', () => {
  let factory: NotificationStrategyFactory;
  let mockBidCreated: Partial<BidCreatedStrategy>;
  let mockOutbid: Partial<OutbidStrategy>;
  let mockAuctionEnded: Partial<AuctionEndedStrategy>;
  let mockBidWon: Partial<BidWonStrategy>;

  beforeEach(async () => {
    mockBidCreated = {};
    mockOutbid = {};
    mockAuctionEnded = {};
    mockBidWon = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationStrategyFactory,
        { provide: BidCreatedStrategy, useValue: mockBidCreated },
        { provide: OutbidStrategy, useValue: mockOutbid },
        { provide: AuctionEndedStrategy, useValue: mockAuctionEnded },
        { provide: BidWonStrategy, useValue: mockBidWon },
      ],
    }).compile();

    factory = module.get<NotificationStrategyFactory>(NotificationStrategyFactory);
  });

  it('should be defined', () => {
    expect(factory).toBeDefined();
  });

  it('should return BidCreatedStrategy for "bid.created"', () => {
    expect(factory.getStrategy('bid.created')).toBe(mockBidCreated);
  });

  it('should return OutbidStrategy for "bid.outbid"', () => {
    expect(factory.getStrategy('bid.outbid')).toBe(mockOutbid);
  });

  it('should return AuctionEndedStrategy for "auction.ended"', () => {
    expect(factory.getStrategy('auction.ended')).toBe(mockAuctionEnded);
  });

  it('should return BidWonStrategy for "bid.won"', () => {
    expect(factory.getStrategy('bid.won')).toBe(mockBidWon);
  });

  it('should throw error for unknown event', () => {
    expect(() => factory.getStrategy('unknown')).toThrow(
      'Notification strategy for event "unknown" not found.',
    );
  });
});
