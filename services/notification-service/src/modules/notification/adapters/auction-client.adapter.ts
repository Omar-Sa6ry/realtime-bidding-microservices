import { Injectable } from '@nestjs/common';
import { AuctionService } from '../../auction/auction.service';

export interface IAuctionClient {
  validateAuction(auctionId: string): Promise<void>;
}

@Injectable()
export class AuctionClientAdapter implements IAuctionClient {
  constructor(private readonly auctionService: AuctionService) {}

  async validateAuction(auctionId: string): Promise<void> {
    await this.auctionService.findById(auctionId);
  }
}
