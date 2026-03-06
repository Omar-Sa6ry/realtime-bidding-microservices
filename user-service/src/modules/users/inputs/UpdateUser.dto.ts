import { CapitalTextField, IdField } from '@bts-soft/core';
import { Field, InputType } from '@nestjs/graphql';
import { CreateImageDto } from '@bts-soft/upload';
import { IsOptional, IsString } from 'class-validator';

@InputType()
export class UpdateUserDto {
  @IdField('userId', 26)
  id: string;

  @CapitalTextField('First name', 3, 100, true)
  firstName?: string;

  @CapitalTextField('First name', 3, 100, true)
  lastName?: string;

  @Field(() => String)
  @IsString()
  @IsOptional()
  country?: string;

  @Field(() => CreateImageDto, { nullable: true })
  avatar?: CreateImageDto;
}
