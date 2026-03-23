import { PaymentMethod, Auth, CurrentUser, Permission } from '@bidding-micro/shared';
import { CurrentUserDto } from '@bts-soft/core';
import { PaymentService } from './payment.service';
import { Args, Float, Mutation, Resolver } from '@nestjs/graphql';
import { UrlResponse } from '../users/dto/UserResponse.dto';

@Resolver()
export class PaymentResolver {
  constructor(private readonly paymentService: PaymentService) {}

  @Mutation(() => UrlResponse, {
    name: 'rechargeWallet',
    description: 'Generates a payment checkout URL to recharge user balance',
  })
  @Auth([Permission.RECHARGE_WALLET])
  async rechargeWallet(
    @Args('amount', { type: () => Float }) amount: number,
    @Args('method', {
      type: () => PaymentMethod,
      defaultValue: PaymentMethod.STRIPE,
    })
    method: PaymentMethod,
    @CurrentUser() user: CurrentUserDto,
  ): Promise<UrlResponse> {
    const items = [{ name: 'Wallet Recharge', price: amount, quantity: 1 }];
    const url = await this.paymentService.createSession(
      method,
      user.id,
      amount,
      items,
    );
    return { data: url };
  }
}
