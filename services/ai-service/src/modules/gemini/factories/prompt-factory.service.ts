import { Injectable } from '@nestjs/common';
import { IPromptStrategy } from '../strategies/prompt-strategy.interface';
import { AuctionPromptStrategy } from '../strategies/auction-prompt.strategy';

@Injectable()
export class PromptFactory {
  getStrategy(contextType: string = 'auction'): IPromptStrategy {
    switch (contextType) {
      case 'auction':
        return new AuctionPromptStrategy();
      default:
        return new AuctionPromptStrategy();
    }
  }
}
