import { BaseResponse } from '@bts-soft/core';
import { Field, Int, ObjectType, Directive } from '@nestjs/graphql';
import { IsOptional } from 'class-validator';
import { ChatMessage } from '../../ai/schemas/chat-message.schema';
import { ChatThread } from '../../ai/schemas/chat-thread.schema';

@Directive('@shareable')
@ObjectType()
export class AIPaginationInfo {
  @Field(() => Int)
  totalItems: number;

  @Field(() => Int)
  currentPage: number;

  @Field(() => Int)
  totalPages: number;
}

@ObjectType()
export class SendMessageChunkDto {
  @Field(() => Boolean)
  isFinal: boolean;

  @Field(() => String)
  userId: string;

  @Field(() => String)
  threadId: string;
}

@ObjectType()
export class SendMessageResponse extends BaseResponse {
  @Field(() => SendMessageChunkDto, { nullable: true })
  data: SendMessageChunkDto;
}

@ObjectType()
export class GetChatMessagesResponse extends BaseResponse {
  @Field(() => [ChatMessage], { nullable: true })
  items: ChatMessage[];

  @IsOptional()
  @Field(() => AIPaginationInfo, { nullable: true })
  pagination?: AIPaginationInfo;
}

@ObjectType()
export class GetChatThreadsResponse extends BaseResponse {
  @Field(() => [ChatThread], { nullable: true })
  items: ChatThread[];

  @IsOptional()
  @Field(() => AIPaginationInfo, { nullable: true })
  pagination?: AIPaginationInfo;
}
