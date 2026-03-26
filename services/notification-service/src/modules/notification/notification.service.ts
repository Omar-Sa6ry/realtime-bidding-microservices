import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateNotificationInput } from './inputs/createNotification.input';
import {
  NotificationCount,
  NotificationResponse,
  NotificationsResponse,
} from './dtos/notificationResponse.dto';
import { I18nService } from 'nestjs-i18n';
import { PaginationInput } from './inputs/pagination.dto';
import { FindNotificationInput } from './inputs/findNotification.input';
import { Notification } from './entity/notification.entity';

@Injectable()
export class NotificationService {
  constructor(
    private readonly i18n: I18nService,

    @InjectModel(Notification.name)
    private model: Model<Notification>,
  ) {}

  async createAndNotify(
    data: CreateNotificationInput,
    userId: string,
  ): Promise<NotificationResponse> {
    const notification = await this.model.create({
      type: data.type,
      title: data.title,
      message: data.message,
      userId: new Types.ObjectId(userId),
      ...(data.referenceId && {
        referenceId: new Types.ObjectId(data.referenceId),
      }),
    });

    return {
      data: notification,
      statusCode: 201,
      message: this.i18n.t('notification.CREATED'),
    };
  }

async getById(id: string, userId: string): Promise<NotificationResponse> {
  const notification = await this.model.findOne({
    _id: new Types.ObjectId(id),
    userId: new Types.ObjectId(userId),
  });

  if(!notification) 
    throw new NotFoundException(this.i18n.t('notification.NOT_FOUND'));
  
  return {
    data: notification.toObject({ getters: true }) as any,
    message: this.i18n.t('notification.RETRIEVED'),
  };
}

  async getUserNotifications(
    userId: string,
    findNotificationInput: FindNotificationInput,
    pagination: PaginationInput,
  ): Promise<NotificationsResponse> {
    const filter: any = {
      userId: new Types.ObjectId(userId),
    };

    if (findNotificationInput.type) 
      filter.type = findNotificationInput.type;
    
    if (findNotificationInput.title) 
      filter.title = new RegExp(findNotificationInput.title, 'i');
    
    if (findNotificationInput.referenceId) 
      filter.referenceId = new Types.ObjectId(findNotificationInput.referenceId);
    

    const page = pagination.page
    const limit = pagination.limit

    const notifications = await this.model
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);


    if (!notifications)
      throw new NotFoundException(this.i18n.t('notification.NOT_FOUNDS'));
    
    return {
      items: notifications.map((n) => n.toObject({ getters: true })) as any,
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

    if(!notification) 
      throw new NotFoundException(this.i18n.t('notification.NOT_FOUND'));
    
    return {
      data: notification.toObject({ getters: true }) as any,
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
      items: notifications.map((n) => n.toObject({ getters: true })) as any,
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

    if(!notification) 
      throw new NotFoundException(this.i18n.t('notification.NOT_FOUND'));
    

    return {
      data: null,
      message: this.i18n.t('notification.DELETED'),
    };
  }
}
