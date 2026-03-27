import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateNotificationInput } from './inputs/createNotification.input';
import { I18nService } from 'nestjs-i18n';
import { PaginationInput } from './inputs/pagination.dto';
import { FindNotificationInput } from './inputs/findNotification.input';
import { Notification } from './entity/notification.entity';
import { UserService } from '../user/user.service';
import { ChannelType, NotificationService } from '@bts-soft/notifications';
import { AuctionService } from '../auction/auction.service';
import { NotificationStrategy } from './strategies/interface/notification.strategy';
import { NotificationStrategyFactory } from './strategies/notification-strategy.factory';
import { NotificationEventData } from './strategies/interface/notification-events.interface';
import { Inject } from '@nestjs/common';
import { PUB_SUB } from '../pubsub/pubsub.module';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import {
  NotificationCount,
  NotificationResponse,
  NotificationsResponse,
} from './dtos/notificationResponse.dto';

@Injectable()
export class NotificationSubService {
  constructor(
    private readonly i18n: I18nService,
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
    private readonly auctionService: AuctionService,
    private readonly strategyFactory: NotificationStrategyFactory,

    @InjectModel(Notification.name)
    private model: Model<Notification>,

    @Inject(PUB_SUB)
    private readonly pubSub: RedisPubSub,
  ) {}

  async process(strategy: NotificationStrategy, data: NotificationEventData) {
    const { title, message } = await strategy.getContent(data, this.i18n);
    const userId = strategy.getUserId(data);
    const actionId = strategy.getActionId
      ? strategy.getActionId(data)
      : undefined;

    const type = strategy.getType(data);

    const notification = await this.model.create({
      type,
      title,
      message,
      userId: new Types.ObjectId(userId),
      ...(actionId && { actionId: new Types.ObjectId(actionId) }),
    });

    // publish event for websocket
    this.pubSub.publish('NOTIFICATION_CREATED', {
      notificationCreated: notification,
    });

    // send notification via email via bts-sotf package
    const user = await this.userService.findById(userId);
    this.sentNotifications(user, title, message);

    return notification;
  }

  async getById(id: string, userId: string): Promise<NotificationResponse> {
    const notification = await this.model.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });

    if (!notification)
      throw new NotFoundException(this.i18n.t('notification.NOT_FOUND'));

    return {
      data: notification.toObject({ getters: true }) as unknown as Notification,
      message: this.i18n.t('notification.RETRIEVED'),
    };
  }

  async getUserNotifications(
    userId: string,
    findNotificationInput: FindNotificationInput,
    pagination?: PaginationInput,
  ): Promise<NotificationsResponse> {
    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };

    if (findNotificationInput.type) filter.type = findNotificationInput.type;

    if (findNotificationInput.title)
      filter.title = new RegExp(findNotificationInput.title, 'i');

    if (findNotificationInput.actionId) {
      await this.auctionService.findById(findNotificationInput.actionId);
      filter.actionId = new Types.ObjectId(findNotificationInput.actionId);
    }

    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 10;

    const notifications = await this.model
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    if (!notifications)
      throw new NotFoundException(this.i18n.t('notification.NOT_FOUNDS'));

    return {
      items: notifications.map((n) =>
        n.toObject({ getters: true }),
      ) as unknown as Notification[],
      message: this.i18n.t('notification.RETRIEVED'),
    };
  }

  async getUnreadCount(userId: string): Promise<NotificationCount> {
    const count = await this.model.countDocuments({
      userId: new Types.ObjectId(userId),
      isRead: false,
    });

    return {
      data: count,
      message: this.i18n.t('notification.RETRIEVED'),
    };
  }

  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<NotificationResponse> {
    const notification = await this.model.findOneAndUpdate(
      {
        _id: new Types.ObjectId(notificationId),
        userId: new Types.ObjectId(userId),
      },
      { isRead: true },
      { new: true },
    );

    if (!notification)
      throw new NotFoundException(this.i18n.t('notification.NOT_FOUND'));

    return {
      data: notification.toObject({ getters: true }) as unknown as Notification,
      message: this.i18n.t('notification.UPDATED'),
    };
  }

  async markAllAsRead(userId: string): Promise<NotificationsResponse> {
    await this.model.updateMany(
      {
        userId: new Types.ObjectId(userId),
        isRead: false,
      },
      { isRead: true },
    );

    const notifications = await this.model
      .find({ userId: new Types.ObjectId(userId), isRead: true })
      .sort({ createdAt: -1 })
      .limit(20);

    if (!notifications)
      throw new NotFoundException(this.i18n.t('notification.NOT_FOUND'));

    return {
      items: notifications.map((n) =>
        n.toObject({ getters: true }),
      ) as unknown as Notification[],
      message: this.i18n.t('notification.UPDATED'),
    };
  }

  async deleteNotification(
    notificationId: string,
    userId: string,
  ): Promise<NotificationResponse> {
    const notification = await this.model.findOneAndDelete({
      _id: new Types.ObjectId(notificationId),
      userId: new Types.ObjectId(userId),
    });

    if (!notification)
      throw new NotFoundException(this.i18n.t('notification.NOT_FOUND'));

    return {
      data: null,
      message: this.i18n.t('notification.DELETED'),
    };
  }

  async createBidNotification(data: NotificationEventData) {
    const strategy = this.strategyFactory.getStrategy('bid.created');
    return this.process(strategy, data);
  }

  async createOutbidNotification(data: NotificationEventData) {
    const strategy = this.strategyFactory.getStrategy('bid.outbid');
    return this.process(strategy, data);
  }

  async createAuctionEndedNotification(data: NotificationEventData) {
    const strategy = this.strategyFactory.getStrategy('auction.ended');
    return this.process(strategy, data);
  }

  async createBidWonNotification(data: NotificationEventData) {
    const strategy = this.strategyFactory.getStrategy('bid.won');
    return this.process(strategy, data);
  }

  // Private Methods
  private async validateEntities(userId: string, actionId?: string) {
    await this.userService.findById(userId);

    if (actionId) await this.auctionService.findById(actionId);
  }

  private sentNotifications(user: any, title: string, body: string) {
    this.notificationService.send(ChannelType.EMAIL, {
      recipientId: user.email,
      title: title,
      body: body,
    });
  }
}
