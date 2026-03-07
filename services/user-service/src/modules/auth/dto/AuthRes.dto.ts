import { BaseResponse } from '@bts-soft/core';
import { Field, ObjectType } from '@nestjs/graphql';
import { Expose } from 'class-transformer';
import { User } from '../../users/entity/user.entity';

@ObjectType()
export class AuthOutPut {
  @Field(() => User)
  @Expose()
  user: User;

  @Field()
  @Expose()
  token: string;
}

@ObjectType()
export class AuthResponse extends BaseResponse {
  @Field(() => AuthOutPut, { nullable: true })
  @Expose()
  data?: AuthOutPut | null;
}
