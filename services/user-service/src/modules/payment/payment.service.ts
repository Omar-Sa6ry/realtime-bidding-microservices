import { Injectable, BadRequestException } from '@nestjs/common';
import { PaymentMethod } from '@bidding-micro/shared';
import {
  IPaymentStrategy,
  PaymentItem,
} from './interfaces/payment-strategy.interface';
import { StripeService } from './stripe.service';

@Injectable()
export class PaymentService {
  private strategies: Map<PaymentMethod, IPaymentStrategy> = new Map();

  constructor(private readonly stripeService: StripeService) {
    this.strategies.set(PaymentMethod.STRIPE, this.stripeService);
  }

  async createSession(
    method: PaymentMethod,
    userId: string,
    amount: number,
    items: PaymentItem[],
  ): Promise<string> {
    const strategy = this.strategies.get(method);
    if (!strategy) {
      throw new BadRequestException(
        `Payment method ${method} is not supported`,
      );
    }

    return await strategy.createSession(userId, amount, items);
  }

  getStrategy(method: PaymentMethod): IPaymentStrategy {
    const strategy = this.strategies.get(method);
    if (!strategy) {
      throw new BadRequestException(
        `Payment method ${method} is not supported`,
      );
    }
    return strategy;
  }
}
