import { EmailField, PasswordField } from '@bts-soft/core';
import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class LoginDto {
  @EmailField()
  email: string;

  @PasswordField()
  password: string;

  @Field({ nullable: true })
  rememberMe?: boolean;
}
