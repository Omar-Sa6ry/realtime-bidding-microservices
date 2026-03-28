import { Resolver, Query, Mutation, Args, Subscription } from '@nestjs/graphql';
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

@Resolver(() => Notification)
export class NotificationResolver {
  constructor(
    private readonly notificationService: NotificationSubService,
    @Inject(PUB_SUB) private readonly pubSub: RedisPubSub,
  ) {}

  @Subscription(() => NotificationResponse, {
    filter: (payload, variables) => {
      return payload.notificationCreated.userId.toString() === variables.userId;
    },
    resolve: (payload) => payload.notificationCreated,
  })
  async notificationCreated(
    @Args('userId') userId: string,
  ): Promise<AsyncIterator<NotificationResponse>> {
    return await this.pubSub.asyncIterator('NOTIFICATION_CREATED');
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
