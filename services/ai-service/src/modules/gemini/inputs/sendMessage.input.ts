import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class SendMessageInput {
  @Field()
  auctionId: string;

  @Field()
  userId: string;
  @Field()
  text: string;

  @Field({ nullable: true })
  language?: string;
}
