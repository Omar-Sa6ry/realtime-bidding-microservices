import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { User } from '../entity/user.entity';
import { Expose } from 'class-transformer';
import { IsOptional } from 'class-validator';
import { BaseResponse, PaginationInfo } from '@bts-soft/core';

@ObjectType()
export class UserResponse extends BaseResponse {
  @Field(() => User, { nullable: true })
  @Expose()
  data?: User;
}

@ObjectType()
export class UsersResponse extends BaseResponse {
  @Field(() => [User], { nullable: true })
  items: User[];

  @IsOptional()
  @Field(() => PaginationInfo, { nullable: true })
  pagination?: PaginationInfo;
}

@ObjectType()
export class UserCountPercentage {
  @Field(() => Float)
  totalUsers: number;

  @Field(() => Float)
  usersThisMonth: number;

  @Field(() => Float)
  percentageIncrease: number;
}

@ObjectType()
export class UserCountPercentageResponse extends BaseResponse {
  @Field(() => UserCountPercentage, { nullable: true })
  @Expose()
  data: UserCountPercentage;
}

@ObjectType()
export class UserCount extends BaseResponse {
  @Field(() => User, { nullable: true })
  @Expose()
  user: User;

  @Field(() => Int, { nullable: true })
  coursesCount: number;
}

@ObjectType()
export class CountUserResponse extends BaseResponse {
  @Field(() => [UserCount], { nullable: true })
  @Expose()
  items: UserCount[];

  @IsOptional()
  @Field(() => PaginationInfo, { nullable: true })
  pagination?: PaginationInfo;
}
