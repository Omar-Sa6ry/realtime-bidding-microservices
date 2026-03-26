import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Expose } from 'class-transformer';

@ObjectType({ description: 'Metadata describing pagination details' })
export class PaginationInfo {
  @Field(() => Int, { description: 'Total number of pages' })
  @Expose()
  totalPages: number;

  @Field(() => Int, { description: 'Current page number' })
  @Expose()
  currentPage: number;

  @Field(() => Int, { description: 'Total number of records/items' })
  @Expose()
  totalItems: number;
}
