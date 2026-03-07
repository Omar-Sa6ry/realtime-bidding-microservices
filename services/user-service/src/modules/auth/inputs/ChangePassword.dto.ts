import { PasswordField } from '@bts-soft/core';
import { InputType } from '@nestjs/graphql';

@InputType()
export class ChangePasswordDto {
  @PasswordField(1, 16)
  password: string;

  @PasswordField()
  newPassword: string;
}
