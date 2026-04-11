import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { NotificationType } from 'src/common/constant/enum.constant';

export type NotificationDocument = HydratedDocument<Notification>;

@ObjectType()
@Schema({ timestamps: true })
export class Notification {
  _id: Types.ObjectId;

  @Field(() => String)
  @Prop({ required: true, index: true })
  userId: string;

  @Field(() => NotificationType)
  @Prop({ required: true, enum: NotificationType, type: String })
  type: NotificationType;

  @Field(() => String)
  @Prop({ required: true })
  title: string;

  @Field(() => String)
  @Prop({ required: true })
  message: string;

  @Field(() => Boolean)
  @Prop({ default: false })
  isRead: boolean;

  @Field(() => String, { nullable: true })
  @Prop()
  actionId?: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;

  @Field(() => String)
  get id(): string {
    return this._id.toString();
  }
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
