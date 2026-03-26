import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Expose } from 'class-transformer';
import { Notification } from '../entity/notification.entity';
import { BaseResponseN } from 'src/common/constant/BaseResponse';
import { PaginationInfoN } from './pagintion';
import { IsOptional } from 'class-validator';

@ObjectType()
export class NotificationResponse extends BaseResponseN {
  @Field(() => Notification, { nullable: true })
  @Expose()
  data?: Notification | null;
}

@ObjectType()
export class NotificationsResponse extends BaseResponseN {
  @Field(() => [Notification], { nullable: true })
  items: Notification[];

  @IsOptional()
  @Field(() => PaginationInfoN, { nullable: true })
  pagination?: PaginationInfoN;
}

@ObjectType()
export class NotificationCount extends BaseResponseN {
  @Field(() => Int, { nullable: true })
  data: number;
}
