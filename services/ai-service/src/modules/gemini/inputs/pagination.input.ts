import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class PaginationInputA {
  @Field(() => Int, { defaultValue: 1 })
  page?: number;

  @Field(() => Int, { defaultValue: 10 })
  limit?: number;
}
