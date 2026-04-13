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
    const doc = new this.model(data);
    const notification = await doc.save();
    return notification.toObject({ getters: true }) as unknown as Notification;
  }

  async findById(id: string, userId: string): Promise<Notification | null> {
    try {
      const oid = typeof id === 'string' ? new Types.ObjectId(id) : id;
      const query: any = { _id: oid };
      if (userId) query.userId = userId;

      const notification = await this.model.findOne(query).exec();

      return notification
        ? (notification.toObject({ getters: true }) as unknown as Notification)
        : null;
    } catch (e) {
      return null;
    }
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
      .limit(limit)
      .exec();

    return notifications.map(
      (n) => n.toObject({ getters: true }) as unknown as Notification,
    );
  }

  async count(filter: any): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  async update(
    filter: any,
    data: Partial<Notification>,
  ): Promise<Notification | null> {
    try {
      const id = filter._id;
      const userId = filter.userId;
      const oid = typeof id === 'string' ? new Types.ObjectId(id) : id;
      
      const doc = await this.model.findOne({ _id: oid }).exec();
      if (!doc) {
        console.log(`[Repository] update: NOT FOUND ID=${oid} (original=${id})`);
        return null;
      }
      
      const docUserId = String(doc.get('userId'));
      const filterUserId = String(userId);
      
      if (userId && docUserId !== filterUserId) {
        console.log(`[Repository] update: OWNER MISMATCH. DocUID=${docUserId}, FilterUID=${filterUserId}`);
        return null;
      }

      const updated = await this.model.findOneAndUpdate({ _id: oid }, data, { new: true }).exec();
      return updated
        ? (updated.toObject({ getters: true }) as unknown as Notification)
        : null;
    } catch (e) {
      console.log(`[Repository] update: ERROR: ${e.message}`);
      return null;
    }
  }

  async updateMany(
    filter: any,
    data: Partial<Notification>,
  ): Promise<void> {
    await this.model.updateMany(filter, data).exec();
  }

  async delete(filter: any): Promise<Notification | null> {
    try {
      const id = filter._id;
      const userId = filter.userId;
      const oid = typeof id === 'string' ? new Types.ObjectId(id) : id;
      
      const doc = await this.model.findOne({ _id: oid }).exec();
      if (!doc) {
        console.log(`[Repository] delete: NOT FOUND ID=${oid}`);
        return null;
      }
      
      const docUserId = String(doc.get('userId'));
      const filterUserId = String(userId);
      
      if (userId && docUserId !== filterUserId) {
        console.log(`[Repository] delete: OWNER MISMATCH. DocUID=${docUserId}, FilterUID=${filterUserId}`);
        return null;
      }

      const deleted = await this.model.findOneAndDelete({ _id: oid }).exec();
      return deleted
        ? (deleted.toObject({ getters: true }) as unknown as Notification)
        : null;
    } catch (e) {
      return null;
    }
  }
}
