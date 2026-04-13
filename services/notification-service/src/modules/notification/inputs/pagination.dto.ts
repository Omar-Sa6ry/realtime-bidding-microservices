import { Field, InputType, Int } from '@nestjs/graphql';
import { Page, Limit } from '@bidding-micro/shared';
import { IsNumber, IsOptional, Min } from 'class-validator';

@InputType()
export class PaginationInput {
  @Field(() => Int, { defaultValue: Page })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page: number = Page;

  @Field(() => Int, { defaultValue: Limit })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit: number = Limit;
}