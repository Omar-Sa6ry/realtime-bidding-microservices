import { Field, ObjectType } from '@nestjs/graphql';
import { Exclude } from 'class-transformer';

@ObjectType()
export class UserDto {
  @Field(() => String)
  id: string;

  @Field(() => String)
  firstName: string;

  @Field(() => String)
  lastName: string;

  @Field(() => String)
  email: string;

  @Exclude()
  password?: string;

  @Field(() => String)
  country: string;

  @Field(() => Number, { defaultValue: 0 })
  balance: number;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}
