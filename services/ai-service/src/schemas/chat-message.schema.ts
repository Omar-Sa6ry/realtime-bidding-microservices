import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ChatThread } from './chat-thread.schema';
import { ObjectType, Field } from '@nestjs/graphql';

ObjectType();
@Schema({ timestamps: true })
export class ChatMessage extends Document {
  @Field()
  @Prop({ type: Types.ObjectId, ref: 'ChatThread', required: true })
  threadId: Types.ObjectId;

  @Field(() => String)
  @Prop({ required: true, enum: ['user', 'model'] })
  role: string;

  @Field(() => String)
  @Prop({ required: true })
  content: string;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
