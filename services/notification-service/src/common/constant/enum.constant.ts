import { registerEnumType } from '@nestjs/graphql';

export enum NotificationType {
  AUCTION_WON = 'AUCTION_WON',
  OUTBID = 'OUTBID',
}


registerEnumType(NotificationType, {
  name: 'NotificationType',
  description: 'Notification types in the system',
});
