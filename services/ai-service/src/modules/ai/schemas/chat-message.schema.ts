import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ObjectType, Field } from '@nestjs/graphql';
import { ChatRole } from '../../../common/constants/role.enum';

@ObjectType()
@Schema({ timestamps: true })
export class ChatMessage extends Document {
  @Field(() => String)
  @Prop({ required: true, type: Types.ObjectId, ref: 'ChatThread' })
  threadId: Types.ObjectId;

  @Field(() => ChatRole)
  @Prop({ required: true, enum: ChatRole })
  role: ChatRole;

  @Field(() => String)
  @Prop({ required: true })
  content: string;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
