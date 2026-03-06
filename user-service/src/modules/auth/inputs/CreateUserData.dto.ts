import { CapitalTextField, EmailField, PasswordField } from '@bts-soft/core';
import { Field, InputType } from '@nestjs/graphql';
import { IsString, IsOptional } from 'class-validator';
import { CreateImageDto } from '@bts-soft/upload';

@InputType()
export class CreateUserDto {
  @CapitalTextField('First name')
  firstName: string;

  @CapitalTextField('Last name')
  lastName: string;

  @EmailField()
  email: string;

  @PasswordField()
  password: string;

  @Field(() => CreateImageDto, { nullable: true })
  avatar?: CreateImageDto;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  country?: string;
}
