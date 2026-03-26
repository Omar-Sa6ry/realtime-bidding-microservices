import { InputType, Field, ID } from '@nestjs/graphql';
import { NotificationType } from 'src/common/constant/enum.constant';

@InputType()
export class FindNotificationInput {
  @Field(() => NotificationType, { nullable: true })
  type?: NotificationType;

  @Field({ nullable: true })
  title?: string;

  @Field(() => String, { nullable: true })
  referenceId?: string;
}
