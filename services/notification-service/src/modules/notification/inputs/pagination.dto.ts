import { Field, InputType, Int } from '@nestjs/graphql';
import { Page, Limit } from '@bidding-micro/shared';

@InputType()
export class PaginationInput {
  @Field(() => Int, { defaultValue: Page })
  page: number;

  @Field(() => Int, { defaultValue: Limit })
  limit: number;
}