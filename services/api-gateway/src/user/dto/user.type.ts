import { Field, ObjectType, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class UserType {
  @Field()
  id: string;

  @Field({ nullable: true })
  username?: string;

  @Field()
  email: string;

  @Field(() => Float, { defaultValue: 0 })
  balance: number;
}

@ObjectType()
export class AuthPayload {
  @Field(() => UserType)
  user: UserType;

  @Field()
  token: string;
}

@ObjectType()
export class AuthResponse {
  @Field(() => AuthPayload, { nullable: true })
  data?: AuthPayload;

  @Field({ nullable: true })
  message?: string;

  @Field(() => Int, { nullable: true })
  statusCode?: number;
}

@ObjectType()
export class UserResponse {
  @Field(() => UserType, { nullable: true })
  data?: UserType;

  @Field({ nullable: true })
  message?: string;

  @Field(() => Int, { nullable: true })
  statusCode?: number;
}
