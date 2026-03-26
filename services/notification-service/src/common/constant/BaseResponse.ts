import { Field, ObjectType } from '@nestjs/graphql';
import { Expose } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';


@ObjectType()
export class BaseResponseN {
  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  @Expose()
  message?: string;

  @IsOptional()
  @IsBoolean()
  @Field({ nullable: true })
  @Expose()
  success?: boolean;

  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  @Expose()
  timeStamp?: string;

  @IsOptional()
  @IsInt()
  @Field({ nullable: true })
  @Expose()
  statusCode?: number;
}
