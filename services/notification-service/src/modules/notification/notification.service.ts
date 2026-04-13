import { Injectable, NotFoundException, Inject, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { I18nService } from 'nestjs-i18n';
import { PaginationInput } from './inputs/pagination.dto';
import { FindNotificationInput } from './inputs/findNotification.input';
import { Notification } from './entity/notification.entity';
import { NotificationStrategy } from './strategies/interface/notification.strategy';
import { NotificationStrategyFactory } from './strategies/notification-strategy.factory';
import { NotificationEventData } from './strategies/interface/notification-events.interface';
import { PUB_SUB } from '../pubsub/pubsub.module';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import {
  NotificationCount,
  NotificationResponse,
  NotificationsResponse,
} from './dtos/notificationResponse.dto';
import { NotificationRepository } from './repositories/notification.repository';
import { EmailAdapter } from './adapters/email.adapter';
import { UserClientAdapter } from './adapters/user-client.adapter';
import { AuctionClientAdapter } from './adapters/auction-client.adapter';

@Injectable()
export class NotificationSubService implements OnModuleInit {
  private i18n: I18nService;
  private strategyFactory: NotificationStrategyFactory;
  private repository: NotificationRepository;
  private emailAdapter: EmailAdapter;
  private userClient: UserClientAdapter;
  private auctionClient: AuctionClientAdapter;
  private pubSub: RedisPubSub;

  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit() {
    this.i18n = this.moduleRef.get(I18nService, { strict: false });
    this.strategyFactory = this.moduleRef.get(NotificationStrategyFactory, {
      strict: false,
    });
    this.repository = this.moduleRef.get(NotificationRepository, {
      strict: false,
    });
    this.emailAdapter = this.moduleRef.get(EmailAdapter, { strict: false });
    this.userClient = this.moduleRef.get(UserClientAdapter, { strict: false });
    this.auctionClient = this.moduleRef.get(AuctionClientAdapter, {
      strict: false,
    });
    this.pubSub = this.moduleRef.get<RedisPubSub>('PUB_SUB', { strict: false });
  }

  async process(strategy: NotificationStrategy, data: NotificationEventData) {
    console.log('SubService process started with data:', data);
    const { title, message } = await strategy.getContent(data, this.i18n);
    console.log('Content generated:', { title, message });
    const userId = strategy.getUserId(data);
    console.log('Resulting userId from strategy:', userId);
    const actionId = strategy.getActionId
      ? strategy.getActionId(data)
      : undefined;

    const type = strategy.getType(data);
    const createData = {
      type,
      title,
      message,
      userId,
      ...(actionId && { actionId }),
    };
    console.log('Final object passed to repository.create:', createData);

    const notification = await this.repository.create(createData as any);

    // Real-time broadcast
    this.pubSub.publish('NOTIFICATION_CREATED', {
      notificationCreated: notification,
    });

    const user = await this.userClient.getUserByUserId(userId);
    this.emailAdapter.sendEmail(user.email, title, message);

    return notification;
  }

  async getById(id: string, userId: string): Promise<NotificationResponse> {
    const notification = await this.repository.findById(id, userId);

    if (!notification)
      throw new NotFoundException(this.i18n.t('notification.NOT_FOUND'));

    return {
      data: notification,
      message: this.i18n.t('notification.RETRIEVED'),
    };
  }

  async getUserNotifications(
    userId: string,
    findNotificationInput?: FindNotificationInput,
    pagination?: PaginationInput,
  ): Promise<NotificationsResponse> {
    const filter: any = { userId };

    if (findNotificationInput?.type) filter.type = findNotificationInput.type;

    if (findNotificationInput?.title)
      filter.title = new RegExp(findNotificationInput.title, 'i');

    if (findNotificationInput?.actionId) {
      await this.auctionClient.validateAuction(findNotificationInput.actionId);
      filter.actionId = findNotificationInput.actionId;
    }

    const notifications = await this.repository.find(filter, pagination);

    return {
      items: notifications,
      message: this.i18n.t('notification.RETRIEVED'),
    };
  }

  async getUnreadCount(userId: string): Promise<NotificationCount> {
    const count = await this.repository.count({ userId, isRead: false });

    return {
      data: count,
      message: this.i18n.t('notification.RETRIEVED'),
    };
  }

  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<NotificationResponse> {
    const notification = await this.repository.update(
      { _id: notificationId, userId },
      { isRead: true },
    );

    if (!notification)
      throw new NotFoundException(this.i18n.t('notification.NOT_FOUND'));

    return {
      data: notification,
      message: this.i18n.t('notification.UPDATED'),
    };
  }

  async markAllAsRead(userId: string): Promise<NotificationsResponse> {
    await this.repository.updateMany({ userId, isRead: false }, { isRead: true });

    const notifications = await this.repository.find({ userId, isRead: true }, { page: 1, limit: 20 });

    return {
      items: notifications,
      message: this.i18n.t('notification.UPDATED'),
    };
  }

  async deleteNotification(
    notificationId: string,
    userId: string,
  ): Promise<NotificationResponse> {
    const notification = await this.repository.delete({ _id: notificationId, userId });

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
}
