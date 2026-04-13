import { InputType, Field } from '@nestjs/graphql';
import { NotificationType } from 'src/common/constant/enum.constant';
import { IsEnum, IsOptional, IsString } from 'class-validator';

@InputType()
export class FindNotificationInput {
  @Field(() => NotificationType, { nullable: true })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  title?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  actionId?: string;
}
