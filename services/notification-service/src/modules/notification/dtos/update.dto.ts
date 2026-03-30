import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class BidUpdate {
  @Field(() => ID)
  auctionId: string;
  @Field()
  amount: number;
  @Field()
  userId: string;
}

@ObjectType()
export class AuctionUpdate {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  startingPrice: number;
}