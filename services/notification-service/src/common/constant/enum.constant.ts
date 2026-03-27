import { registerEnumType } from '@nestjs/graphql';

export enum NotificationType {
  BID_PLACED = 'BID_PLACED',
  AUCTION_WON = 'AUCTION_WON',
  OUTBID = 'OUTBID',
}


registerEnumType(NotificationType, {
  name: 'NotificationType',
  description: 'Notification types in the system',
});
