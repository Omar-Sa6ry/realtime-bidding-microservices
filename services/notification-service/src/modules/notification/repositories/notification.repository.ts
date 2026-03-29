import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification } from '../entity/notification.entity';
import { PaginationInput } from '../inputs/pagination.dto';

@Injectable()
export class NotificationRepository {
  constructor(
    @InjectModel(Notification.name)
    private readonly model: Model<Notification>,
  ) {}

  async create(data: Partial<Notification>): Promise<Notification> {
    const notification = await this.model.create(data);
    
    return notification.toObject({ getters: true }) as unknown as Notification;
  }

  async findById(id: string, userId: string): Promise<Notification | null> {
    const notification = await this.model.findOne({
      _id: new Types.ObjectId(id),
      userId: userId,
    });

    return notification
      ? (notification.toObject({ getters: true }) as unknown as Notification)
      : null;
  }

  async find(
    filter: any,
    pagination?: PaginationInput,
  ): Promise<Notification[]> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 10;

    const notifications = await this.model
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return notifications.map(
      (n) => n.toObject({ getters: true }) as unknown as Notification,
    );
  }

  async count(filter: any): Promise<number> {
    return this.model.countDocuments(filter);
  }

  async update(
    filter: any,
    data: Partial<Notification>,
  ): Promise<Notification | null> {
    const notification = await this.model.findOneAndUpdate(filter, data, {
      new: true,
    });

    return notification
      ? (notification.toObject({ getters: true }) as unknown as Notification)
      : null;
  }

  async updateMany(
    filter: any,
    data: Partial<Notification>,
  ): Promise<void> {
    await this.model.updateMany(filter, data);
  }

  async delete(filter: any): Promise<Notification | null> {
    const notification = await this.model.findOneAndDelete(filter);

    return notification
      ? (notification.toObject({ getters: true }) as unknown as Notification)
      : null;
  }
}
