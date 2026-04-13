import { Resolver, Query, Mutation, Subscription, Args } from '@nestjs/graphql';
import { Inject, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { NotificationSubService } from './notification.service';
import {
  NotificationResponse,
  NotificationsResponse,
  NotificationCount,
} from './dtos/notificationResponse.dto';
import { FindNotificationInput } from './inputs/findNotification.input';
import { PaginationInput } from './inputs/pagination.dto';
import { Auth, CurrentUser, Permission } from '@bidding-micro/shared';
import { CurrentUserDtoN } from './dtos/currentUser.dto';
import { AiMessageChunkResponse } from './dtos/aiMessageChunk.dto';
import { RedisPubSub } from 'graphql-redis-subscriptions';

@Resolver()
export class NotificationResolver implements OnModuleInit {
  private notificationService: NotificationSubService;
  private pubSub: RedisPubSub;

  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit() {
    this.notificationService = this.moduleRef.get(NotificationSubService, {
      strict: false,
    });
    this.pubSub = this.moduleRef.get('PUB_SUB', { strict: false });
  }

  @Subscription(() => NotificationResponse, {
    filter: (payload, variables, context) => {
      const currentUserId = context?.user?.id || context?.req?.user?.id;
      return payload.notificationCreated.userId === currentUserId;
    },
  })
  notificationCreated() {
    return this.pubSub.asyncIterator('NOTIFICATION_CREATED');
  }

  @Subscription(() => AiMessageChunkResponse, {
    filter: (payload, variables, context) => {
      const user = context?.user || context?.req?.user;
      const currentUserId = user?.id || user?._id;
      const match = payload.aiMessageChunk.userId === currentUserId;
      console.log(`[Subscription Filter] Payload UID: ${payload.aiMessageChunk.userId}, Context UID: ${currentUserId}, Object: ${JSON.stringify(user)}, Match: ${match}`);
      return match;
    },
  })
  aiMessageChunk() {
    return this.pubSub.asyncIterator('AI_MESSAGE_CHUNK');
  }

  @Auth([Permission.READ_NOTIFICATION])
  @Query(() => NotificationsResponse)
  async getUserNotifications(
    @CurrentUser() user: CurrentUserDtoN,
    @Args('findNotificationInput', {
      type: () => FindNotificationInput,
      nullable: true,
    })
    findNotificationInput?: FindNotificationInput,
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
  ): Promise<NotificationsResponse> {
    return this.notificationService.getUserNotifications(
      user.id,
      findNotificationInput,
      pagination,
    );
  }

  @Auth([Permission.READ_NOTIFICATION])
  @Query(() => NotificationCount)
  async getUnreadNotificationCount(
    @CurrentUser() user: CurrentUserDtoN,
  ): Promise<NotificationCount> {
    return this.notificationService.getUnreadCount(user.id);
  }

  @Auth([Permission.UPDATE_NOTIFICATION])
  @Mutation(() => NotificationResponse)
  async markNotificationAsRead(
    @Args('id') id: string,
    @CurrentUser() user: CurrentUserDtoN,
  ): Promise<NotificationResponse> {
    return this.notificationService.markAsRead(id, user.id);
  }

  @Auth([Permission.UPDATE_NOTIFICATION])
  @Mutation(() => NotificationsResponse)
  async markAllNotificationsAsRead(
    @CurrentUser() user: CurrentUserDtoN,
  ): Promise<NotificationsResponse> {
    return this.notificationService.markAllAsRead(user.id);
  }

  @Auth([Permission.DELETE_NOTIFICATION])
  @Mutation(() => NotificationResponse)
  async deleteNotification(
    @Args('id') id: string,
    @CurrentUser() user: CurrentUserDtoN,
  ): Promise<NotificationResponse> {
    return this.notificationService.deleteNotification(id, user.id);
  }
}
