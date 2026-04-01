import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GeminiService } from './gemini.service';
import { SendMessageResponse } from './dtos/sendMessage.dto';
import { Permission, Auth, CurrentUser } from '@bidding-micro/shared';
import { CurrentUserDto } from '@bts-soft/core';

@Resolver()
export class GeminiResolver {
  constructor(private readonly geminiService: GeminiService) {}

  @Mutation(() => SendMessageResponse)
  @Auth([Permission.SEND_MESSAGE])
  async sendMessage(
    @CurrentUser() user: CurrentUserDto,
    @Args('auctionId', { type: () => String }) auctionId: string,
    @Args('text', { type: () => String }) text: string,
  ): Promise<SendMessageResponse> {
    return this.geminiService.sendMessage({ auctionId, userId: user.id, text });
  }
}
