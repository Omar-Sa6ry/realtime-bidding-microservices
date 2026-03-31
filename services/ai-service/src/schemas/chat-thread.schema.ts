import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@ObjectType()
@Schema({ timestamps: true })
export class ChatThread extends Document {
  @Field(() => String)
  @Prop({ required: true })
  userId: string;

  @Field(() => String)
  @Prop({ required: true })
  auctionId: string;

  @Field(() => String)
  @Prop({ default: 'Auction Support' })
  title: string;
}

export const ChatThreadSchema = SchemaFactory.createForClass(ChatThread);
