import {
  Resolver,
  Query,
  Mutation,
  Args,
  Subscription,
  ID,
} from '@nestjs/graphql';
import { NotificationSubService } from './notification.service';
import { Notification } from './entity/notification.entity';
import { FindNotificationInput } from './inputs/findNotification.input';
import { PaginationInput } from './inputs/pagination.dto';
import {
  NotificationCount,
  NotificationResponse,
  NotificationsResponse,
} from './dtos/notificationResponse.dto';
import { Auth, CurrentUser, Permission } from '@bidding-micro/shared';
import { CurrentUserDtoN } from './dtos/currentUser.dto';
import { Inject } from '@nestjs/common';
import { PUB_SUB } from '../pubsub/pubsub.module';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { AuctionUpdate, BidUpdate, AiMessageChunk } from './dtos/update.dto';

@Resolver(() => Notification)
export class NotificationResolver {
  constructor(
    private readonly notificationService: NotificationSubService,
    @Inject(PUB_SUB) private readonly pubSub: RedisPubSub,
  ) {}

  @Subscription(() => NotificationResponse, {
    filter: (payload, variables, context) => {
      const currentUserId = context?.user?.id || context?.req?.user?.id;
      return payload.notificationCreated.userId.toString() === currentUserId;
    },
    resolve: (payload) => payload.notificationCreated,
  })
  async notificationCreated(): Promise<AsyncIterator<NotificationResponse>> {
    return await this.pubSub.asyncIterator('NOTIFICATION_CREATED');
  }

  @Subscription(() => BidUpdate, {
    filter: (payload, variables) => {
      return payload.bidUpdated.auctionId === variables.auctionId;
    },
    resolve: (payload) => payload.bidUpdated,
  })
  async bidUpdated(
    @Args('auctionId', { type: () => ID }) auctionId: string,
  ): Promise<AsyncIterator<BidUpdate>> {
    return await this.pubSub.asyncIterator(`BID_UPDATED_${auctionId}`);
  }

  @Subscription(() => AuctionUpdate, {
    resolve: (payload) => payload.auctionCreated,
  })
  async auctionCreated(): Promise<AsyncIterator<AuctionUpdate>> {
    return await this.pubSub.asyncIterator('AUCTION_CREATED');
  }

  @Subscription(() => AiMessageChunk, {
    filter: (payload, variables, context) => {
      const currentUserId = context?.user?.id || context?.req?.user?.id;
      const payloadUserId = payload.aiMessageChunk.userId;
      console.log(
        `[Sub Filter] aiMessageChunk — currentUserId: ${currentUserId}, payloadUserId: ${payloadUserId}, match: ${payloadUserId === currentUserId}`,
      );
      return payloadUserId === currentUserId;
    },
    resolve: (payload) => {
      console.log(
        `[Sub Resolve] aiMessageChunk — chunk: ${payload.aiMessageChunk.chunk?.substring(0, 20)}...`,
      );
      return payload.aiMessageChunk;
    },
  })
  async aiMessageChunk(): Promise<AsyncIterator<AiMessageChunk>> {
    return await this.pubSub.asyncIterator('AI_MESSAGE_CHUNK');
  }

  @Query(() => NotificationResponse)
  @Auth([Permission.READ_NOTIFICATION])
  async getNotificationById(
    @Args('id') id: string,
    @CurrentUser() user: CurrentUserDtoN,
  ): Promise<NotificationResponse> {
    return this.notificationService.getById(id, user.id);
  }

  @Query(() => NotificationsResponse)
  @Auth([Permission.READ_NOTIFICATION])
  async getUserNotifications(
    @CurrentUser() user: CurrentUserDtoN,
    @Args('input', { nullable: true }) input?: FindNotificationInput,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ): Promise<NotificationsResponse> {
    return this.notificationService.getUserNotifications(
      user.id,
      input,
      pagination,
    );
  }

  @Query(() => NotificationCount)
  @Auth([Permission.READ_NOTIFICATION])
  async getUnreadNotificationCount(@CurrentUser() user: CurrentUserDtoN) {
    return this.notificationService.getUnreadCount(user.id);
  }

  @Mutation(() => NotificationResponse)
  @Auth([Permission.UPDATE_NOTIFICATION])
  async markNotificationAsRead(
    @Args('id') id: string,
    @CurrentUser() user: CurrentUserDtoN,
  ): Promise<NotificationResponse> {
    return this.notificationService.markAsRead(id, user.id);
  }

  @Mutation(() => NotificationsResponse)
  @Auth([Permission.UPDATE_NOTIFICATION])
  async markAllNotificationsAsRead(
    @CurrentUser() user: CurrentUserDtoN,
  ): Promise<NotificationsResponse> {
    return this.notificationService.markAllAsRead(user.id);
  }

  @Mutation(() => NotificationResponse)
  @Auth([Permission.DELETE_NOTIFICATION])
  async deleteNotification(
    @Args('id') id: string,
    @CurrentUser() user: CurrentUserDtoN,
  ): Promise<NotificationResponse> {
    return this.notificationService.deleteNotification(id, user.id);
  }
}
