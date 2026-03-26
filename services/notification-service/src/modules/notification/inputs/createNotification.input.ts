import { InputType, Field, ID } from '@nestjs/graphql';
import { NotificationType } from 'src/common/constant/enum.constant';

@InputType()
export class CreateNotificationInput {
  @Field(() => NotificationType)
  type: NotificationType;

  @Field()
  title: string;

  @Field()
  message: string;

  @Field(() => String, { nullable: true })
  referenceId?: string;
}
