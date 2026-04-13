import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AiMessageChunkResponse {
  @Field(() => String)
  chunk: string;

  @Field(() => Boolean)
  isFinal: boolean;

  @Field(() => String, { nullable: true })
  threadId?: string;

  @Field(() => String)
  userId: string;
}
