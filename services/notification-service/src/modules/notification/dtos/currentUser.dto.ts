import { Field, ObjectType } from '@nestjs/graphql';
import { Expose } from 'class-transformer';


@ObjectType({ description: 'Minimal representation of the authenticated user' })
export class CurrentUserDtoN {
  @Field(() => String, { description: 'Unique user ID' })
  @Expose()
  id: string;

  @Field(() => String, { description: 'Email address of the user' })
  @Expose()
  email: string;
}
