import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Expose } from 'class-transformer';
import { IsOptional } from 'class-validator';
import { Notification } from '../entity/notification.entity';
import { BaseResponse } from 'src/common/constant/BaseResponse';
import { PaginationInfo } from './pagintion';

@ObjectType()
export class NotificationResponse extends BaseResponse {
  @Field(() => Notification, { nullable: true })
  @Expose()
  data?: Notification | null;
}

@ObjectType()
export class NotificationsResponse extends BaseResponse {
  @Field(() => [Notification], { nullable: true })
  items: Notification[];

  @IsOptional()
  @Field(() => PaginationInfo, { nullable: true })
  pagination?: PaginationInfo;
}

@ObjectType()
export class NotificationCount extends BaseResponse {
  @Field(() => Int, { nullable: true })
  data: number;
}
