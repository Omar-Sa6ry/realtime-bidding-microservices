import { BaseResponse } from '@bts-soft/core';
import { Field, ObjectType } from '@nestjs/graphql';

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
