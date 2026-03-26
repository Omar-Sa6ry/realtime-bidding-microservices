import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { NotificationService } from './notification.service';
import { Notification } from './entity/notification.entity';
import { CreateNotificationInput } from './inputs/createNotification.input';
import { FindNotificationInput } from './inputs/findNotification.input';
import { PaginationInput } from './inputs/pagination.dto';
import {
  NotificationCount,
  NotificationResponse,
  NotificationsResponse,
} from './dtos/notificationResponse.dto';
import { Auth, CurrentUser, Permission } from '@bidding-micro/shared';
import { CurrentUserDto } from './dtos/currentUser.dto';

@Resolver(() => Notification)
export class NotificationResolver {
  constructor(private readonly notificationService: NotificationService) {}

  @Mutation(() => NotificationResponse)
  @Auth([Permission.CREATE_NOTIFICATION])
  async createNotification(
    @Args('input') input: CreateNotificationInput,
    @CurrentUser() user: CurrentUserDto,
  ) {
    return this.notificationService.createAndNotify(input, user.id);
  }

  @Query(() => NotificationResponse)
  @Auth([Permission.READ_NOTIFICATION])
  async getNotificationById(
    @Args('id') id: string,
    @CurrentUser() user: CurrentUserDto,
  ) {
    return this.notificationService.getById(id, user.id);
  }

  @Query(() => NotificationsResponse)
  @Auth([Permission.READ_NOTIFICATION])
  async getUserNotifications(
    @Args('input') input: FindNotificationInput,
    @Args('pagination', { nullable: true }) pagination: PaginationInput,
    @CurrentUser() user: CurrentUserDto,
  ) {
    return this.notificationService.getUserNotifications(
      user.id,
      input,
      pagination,
    );
  }

  @Query(() => NotificationCount)
  @Auth([Permission.READ_NOTIFICATION])
  async getUnreadNotificationCount(@CurrentUser() user: CurrentUserDto) {
    return this.notificationService.getUnreadCount(user.id);
  }

  @Mutation(() => NotificationResponse)
  @Auth([Permission.UPDATE_NOTIFICATION])
  async markNotificationAsRead(
    @Args('id') id: string,
    @CurrentUser() user: CurrentUserDto,
  ) {
    return this.notificationService.markAsRead(id, user.id);
  }

  @Mutation(() => NotificationsResponse)
  @Auth([Permission.UPDATE_NOTIFICATION])
  async markAllNotificationsAsRead(@CurrentUser() user: CurrentUserDto) {
    return this.notificationService.markAllAsRead(user.id);
  }

  @Mutation(() => NotificationResponse)
  @Auth([Permission.DELETE_NOTIFICATION])
  async deleteNotification(
    @Args('id') id: string,
    @CurrentUser() user: CurrentUserDto,
  ) {
    return this.notificationService.deleteNotification(id, user.id);
  }
}
