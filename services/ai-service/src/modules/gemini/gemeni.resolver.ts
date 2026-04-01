import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GeminiService } from './gemini.service';
import {
  GetChatMessagesResponse,
  GetChatThreadsResponse,
  SendMessageResponse,
} from './dtos/aiService.dto';
import { Permission, Auth, CurrentUser } from '@bidding-micro/shared';
import { CurrentUserDto } from '@bts-soft/core';
import { UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PaginationInputA } from './inputs/pagination.input';

@Resolver()
export class GeminiResolver {
  constructor(private readonly geminiService: GeminiService) {}

  @Mutation(() => SendMessageResponse)
  @Auth([Permission.SEND_MESSAGE])
  @UseGuards(ThrottlerGuard)
  async sendMessage(
    @CurrentUser() user: CurrentUserDto,
    @Args('auctionId', { type: () => String }) auctionId: string,
    @Args('text', { type: () => String }) text: string,
  ): Promise<SendMessageResponse> {
    return this.geminiService.sendMessage({ auctionId, userId: user.id, text });
  }

  @Query(() => GetChatThreadsResponse)
  @Auth([Permission.VIEW_CHAT_THREADS])
  async getUserChatThreads(
    @CurrentUser() user: CurrentUserDto,
    @Args('pagination', { type: () => PaginationInputA, nullable: true })
    pagination?: PaginationInputA,
  ): Promise<GetChatThreadsResponse> {
    return this.geminiService.getUserChatThreads(user.id, pagination);
  }

  @Query(() => GetChatMessagesResponse)
  @Auth([Permission.VIEW_CHAT_HISTORY])
  async getChatMessages(
    @CurrentUser() user: CurrentUserDto,
    @Args('threadId', { type: () => String }) threadId: string,
    @Args('pagination', { type: () => PaginationInputA, nullable: true })
    pagination?: PaginationInputA,
  ): Promise<GetChatMessagesResponse> {
    return this.geminiService.getChatMessages(threadId, user.id, pagination);
  }
}
