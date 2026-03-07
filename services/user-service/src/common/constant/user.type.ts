import { Field, ObjectType } from '@nestjs/graphql';
import { Role } from './enum.constant';

@ObjectType()
export class UserDto {
  @Field(() => String)
  id: string;

  @Field(() => String)
  firstName?: string;

  @Field(() => String)
  lastName?: string;

  @Field(() => String)
  email: string;

  @Field(() => Role)
  role: Role;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

export enum UserEvents {
  GET_USER_BY_ID = 'user.get.by.id',
  GET_USER_BY_EMAIL = 'user.get.by.email',
  USER_UPDATED = 'user.updated',
  USER_DATA_EXISTED = 'user.dataExists',
  CREATE_USER_DATA = 'user.createData',
  USER_ROLE_UPDATED = 'user.role.updated',
  FIND_USERS_WITH_IS = 'user.findUsersWithIds',
  CHECK_IF_INSTRACTOR = 'user.checkIfInstractor',
}
